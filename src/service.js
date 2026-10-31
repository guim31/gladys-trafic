// -----------------------------------------------------------------------------
// The integration at runtime: the catalogs of the road segments, the live
// measures of the segments followed, the refresh timer, the devices offered
// in the Discover tab, the states of the roads added to Gladys, and the scene
// triggers.
//
// Data flow: the catalog of every active city (ticked, or with a road added
// to Gladys) is read once a day: road names, segment ids, positions. The
// Discover tab offers, for each ticked city, the roads whose name matches the
// search of the configuration (every route for Bordeaux), and the segments
// around the house. At every cycle, one request per city (per hundred
// segments) reads the live measures of the segments of the roads added only,
// filtered by the portal itself.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, fold, normalizeConfig } from './config.js';
import {
  AXIS_TYPE,
  HOME_AXIS,
  aggregate,
  axisPlatformId,
  axisStates,
  buildAxisDevice,
} from './devices.js';
import { CREDENTIALS, REPORTS, TEXT, levelName, lines, render, say } from './messages.js';
import { CredentialsError, SOURCES, SOURCE_KEYS, STATUS } from './sources.js';

const logger = createLogger({ name: 'trafic' });

// Unchanged states (a road always free) are sent again this often, or the
// dashboard shows "no recent value" after 48 hours.
export const HEARTBEAT_MS = 6 * 3600 * 1000;
export const CATALOG_MAX_AGE_MS = 24 * 3600 * 1000;
// A failed catalog read is tried again after this, the known one kept.
const CATALOG_RETRY_MS = 3600 * 1000;
// A city whose catalog was never read: tried again after this.
export const CATALOG_FIRST_RETRY_MS = 10 * 60 * 1000;
// Credentials refused: the same ones are tried again after this (the
// password may be reset on the portal without the settings changing).
export const CREDENTIALS_RETRY_MS = 3600 * 1000;
// Roads offered per city in the Discover tab (a short search term).
export const MAX_DISCOVERED = 50;
// Segments of the "around the house" device, the nearest ones.
export const MAX_HOME_SEGMENTS = 40;

export const TRIGGERS = { JAM: 'traffic_jam', CLEAR: 'traffic_clear' };
// The levels of the jam trigger (the scene filters only compare for equality:
// an event is fired for every level crossed).
export const JAM_LEVELS = { heavy: STATUS.HEAVY, congested: STATUS.CONGESTED };

/** Distance in metres between two points (equirectangular: a few km at most). */
export function distance(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return 6371000 * Math.hypot(x, y);
}

/** One city at runtime: its source, its catalog, its last measures and how they went. */
class City {
  constructor(key) {
    this.key = key;
    this.source = SOURCES[key];
    this.axes = null; // Map axisKey → { key, name, names, search, ids, segments }
    this.home = null; // { key: 'home', ids } or null
    this.catalogAt = null;
    this.catalogRetryAt = null;
    this.measures = new Map(); // segment id → measure
    this.state = {}; // the source's own memory between reads (national roads)
    this.okAt = null;
    this.error = null;
    this.credentials = null; // 'missing' | 'refused' | null (Lyon)
    this.signature = undefined; // of the credentials last given to the source
    this.refusedAt = null;
  }
}

export class Traffic {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   * @param {boolean} [options.timers] false in the tests: they call refresh()
   */
  constructor({ gladys, fetch = globalThis.fetch, now = Date.now, timers = true }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.now = now;
    this.useTimers = timers;
    this.config = normalizeConfig(DEFAULT_CONFIG);
    this.house = null; // { lat, lon } of the first located house
    this.houseError = false;
    this.cities = new Map(); // key → City
    this.levels = new Map(); // deviceId → { level, at }: last known level
    this.discoveredSignature = null;
    this.publishFailed = false;
    this.discoveryFailed = false;
    this.fireFailed = false;
    this.connectionProblem = null; // the credentials problem shown in Gladys
    this.timer = null;
    this.stopped = false;
    this.refreshing = null;
    this.loading = Promise.resolve();
  }

  // --- lifecycle --------------------------------------------------------------

  async start(config) {
    this.config = config;
    await this.locate();
    this.schedule();
    logger.info(
      `Started: ${config.cities.length} city(ies) chosen, ${this.watched().length} road(s) added`,
    );
    // The first reading in the background: the widget and the scene action
    // wait for it.
    this.loading = this.refresh({ discover: true });
  }

  /** Gladys restarted: everything again, the house and the states included. */
  async resync(config) {
    this.config = config;
    await this.locate();
    this.gladys.forgetPublishedStates?.();
    // The core holds the connection status in memory: said again if needed.
    this.connectionProblem = null;
    await this.refresh({ discover: true });
  }

  async reconfigure(config) {
    this.config = config;
    await this.locate();
    this.schedule();
    await this.refresh({ discover: true });
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.refreshing;
  }

  schedule() {
    if (!this.useTimers || this.stopped) {
      return;
    }
    clearTimeout(this.timer);
    // A callback still running when the schedule changes must not start a
    // second chain: each chain only continues while it is the current one.
    this.generation = (this.generation ?? 0) + 1;
    const generation = this.generation;
    const tick = () => {
      this.timer = setTimeout(async () => {
        await this.refresh();
        if (!this.stopped && this.generation === generation) {
          tick();
        }
      }, this.config.refreshSeconds * 1000);
      this.timer.unref?.();
    };
    tick();
  }

  /** The position of the house, for the "around the house" devices (none when off). */
  async locate() {
    if (this.config.homeRadius === 0) {
      this.house = null;
      return;
    }
    try {
      const houses = await this.gladys.getHouses();
      const located = (houses ?? []).find(
        (h) => Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude),
      );
      const house = located ? { lat: located.latitude, lon: located.longitude } : null;
      if (JSON.stringify(house) !== JSON.stringify(this.house)) {
        // Another house: the segments around it are computed again.
        for (const city of this.cities.values()) {
          city.home = null;
        }
      }
      this.house = house;
      this.houseError = false;
    } catch (err) {
      if (!this.houseError) {
        logger.warn(`Cannot read the location of the house: ${err.message}`);
      }
      this.houseError = true;
    }
  }

  // --- devices ----------------------------------------------------------------

  deviceId(key, axisKey) {
    return this.gladys.externalIds(AXIS_TYPE, axisPlatformId(key, axisKey)).device;
  }

  /** `{ key, axisKey }` of a device created in Gladys, from its params. */
  axisOfDevice(device) {
    const param = (name) => device?.params?.find?.((p) => p.name === name)?.value;
    const key = param('source');
    const axisKey = param('axis');
    return SOURCE_KEYS.includes(key) && axisKey ? { key, axisKey: String(axisKey) } : null;
  }

  /** The roads added to Gladys: `{ deviceId, key, axisKey, name }[]`. */
  watched() {
    return (this.gladys.devices ?? [])
      .map((device) => ({
        deviceId: device.external_id,
        name: device.name,
        ...this.axisOfDevice(device),
      }))
      .filter((entry) => entry.key);
  }

  /** The cities to read: the ones ticked, and the ones of the roads added. */
  activeKeys() {
    const keys = new Set([...this.config.cities, ...this.watched().map((entry) => entry.key)]);
    return SOURCE_KEYS.filter((key) => keys.has(key));
  }

  city(key) {
    if (!this.cities.has(key)) {
      this.cities.set(key, new City(key));
    }
    return this.cities.get(key);
  }

  /** The segments around the house in a city: the nearest ones within the radius. */
  homeAxis(city) {
    if (!this.house || this.config.homeRadius === 0 || !city.axes) {
      return null;
    }
    if (!city.home || city.home.radius !== this.config.homeRadius) {
      const near = [];
      for (const axis of city.axes.values()) {
        for (const segment of axis.segments) {
          if (segment.lat === null || segment.lon === null) {
            continue;
          }
          const d = distance(this.house.lat, this.house.lon, segment.lat, segment.lon);
          if (d <= this.config.homeRadius) {
            near.push({ id: segment.id, d });
          }
        }
      }
      near.sort((a, b) => a.d - b.d);
      city.home = {
        key: HOME_AXIS,
        name: HOME_AXIS,
        radius: this.config.homeRadius,
        ids: near.slice(0, MAX_HOME_SEGMENTS).map((s) => s.id),
      };
    }
    return city.home.ids.length > 0 ? city.home : null;
  }

  /** An axis of a city by its key, the house included. */
  axis(city, axisKey) {
    return axisKey === HOME_AXIS ? this.homeAxis(city) : (city.axes?.get(axisKey) ?? null);
  }

  /** The roads of a city matching the search, sorted by name. */
  matchingAxes(city) {
    const axes = [...(city.axes?.values() ?? [])];
    const matching = city.source.listAll
      ? axes
      : axes.filter((axis) =>
          this.config.terms.some((term) => fold(axis.search ?? axis.name).includes(term)),
        );
    return matching.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  /** The roads offered in the Discover tab: the first MAX_DISCOVERED matches. */
  offeredAxes(city) {
    return this.matchingAxes(city).slice(0, MAX_DISCOVERED);
  }

  /** The state of a watched road: `{ city, axis, summary }`, summary null before any read. */
  lookup(deviceId) {
    const entry = this.watched().find((w) => w.deviceId === deviceId);
    if (!entry) {
      return null;
    }
    const city = this.city(entry.key);
    const axis = this.axis(city, entry.axisKey);
    let summary = null;
    // Once the city's roads are known, a road gone from the catalog or not
    // read yet is "unknown": its last level must not stay in Gladys.
    if (city.axes) {
      summary = aggregate(
        (axis?.ids ?? []).map((id) => city.measures.get(id)),
        this.now(),
      );
      // The sum of the travel times of scattered segments is no travel time:
      // only the routes of the sources that publish one have it.
      if (!city.source.hasTravelTime) {
        summary = { ...summary, time: null, usual: null };
      }
    }
    return { entry, city, axis, summary };
  }

  /** Waits for the first reading (at most `ms`), for a widget or a scene action asked at start. */
  async firstReading(ms = 10000) {
    let timer;
    await Promise.race([
      this.loading,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
    clearTimeout(timer);
  }

  async publishDiscovered({ force = false } = {}) {
    const created = new Map(this.watched().map((entry) => [entry.deviceId, entry]));
    const devices = new Map();
    const add = (key, axis) => {
      const device = buildAxisDevice(this.gladys, key, SOURCES[key], axis, this.config.language);
      devices.set(device.external_id, device);
    };
    for (const key of this.config.cities) {
      const city = this.cities.get(key);
      if (!city?.axes) {
        continue;
      }
      for (const axis of this.offeredAxes(city)) {
        add(key, axis);
      }
      if (this.homeAxis(city)) {
        add(key, city.home);
      }
    }
    // The roads already added stay listed, whatever the search.
    for (const entry of created.values()) {
      const city = this.cities.get(entry.key);
      const axis = city && this.axis(city, entry.axisKey);
      if (axis && !devices.has(entry.deviceId)) {
        add(entry.key, axis);
      }
    }
    const list = [...devices.values()];
    const signature = JSON.stringify(list.map((d) => [d.external_id, d.name, d.features]));
    if (!force && signature === this.discoveredSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(list);
      this.discoveredSignature = signature;
      if (this.discoveryFailed) {
        this.discoveryFailed = false;
        logger.info('Discovered roads published again');
      }
    } catch (err) {
      if (!this.discoveryFailed) {
        logger.warn(`Cannot publish the discovered roads: ${err.message}`);
      }
      this.discoveryFailed = true;
    }
  }

  async publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (this.publishFailed) {
        this.publishFailed = false;
        logger.info('States published again');
      }
    } catch (err) {
      // Gladys restarting: said once, the next refresh sends them again.
      if (!this.publishFailed) {
        logger.warn(`Cannot publish ${states.length} state(s): ${err.message}`);
      }
      this.publishFailed = true;
    }
  }

  statesOf(found) {
    return axisStates(
      this.gladys,
      found.entry.key,
      found.city.source,
      found.entry.axisKey,
      found.summary,
      this.now(),
      this.config.language,
    );
  }

  /** A device was just added in Gladys: its states, all of them, now. */
  async onDeviceCreated(device) {
    const entry = this.axisOfDevice(device);
    if (!entry) {
      return;
    }
    // Its segments were not read yet: read them now, rather than in a cycle
    // (after the running one, which may not include them).
    await this.refresh({ discover: true });
    const found = this.lookup(device.external_id);
    if (found?.summary) {
      await this.publish(this.statesOf(found));
    }
    this.refreshWidget();
  }

  refreshWidget() {
    this.gladys.requestWidgetRefresh?.('traffic')?.catch?.(() => {});
  }

  // --- refresh ------------------------------------------------------------------

  /** One read of every active city; concurrent calls share it. */
  refresh({ discover = false } = {}) {
    if (!this.refreshing) {
      this.refreshing = this.refreshAll(discover)
        .catch((err) => logger.warn(`Refresh failed: ${err.message}`))
        .finally(() => {
          this.refreshing = null;
        });
      return this.refreshing;
    }
    // A discovery asked during a refresh (cities just ticked) reads again
    // right after it: the running one may not include the new cities.
    return discover ? this.refreshing.then(() => this.refresh({ discover })) : this.refreshing;
  }

  async refreshAll(forceDiscovery) {
    const watched = this.watched();
    for (const key of this.activeKeys()) {
      const city = this.city(key);
      if (this.blocked(city)) {
        continue;
      }
      await this.readCatalog(city);
      const ids = new Set();
      for (const entry of watched.filter((w) => w.key === key)) {
        for (const id of this.axis(city, entry.axisKey)?.ids ?? []) {
          ids.add(id);
        }
      }
      await this.readLive(city, [...ids]);
    }
    await this.publishDiscovered({ force: forceDiscovery });
    await this.reportConnection();
    const states = [];
    const events = [];
    for (const entry of watched) {
      const found = this.lookup(entry.deviceId);
      if (!found?.summary) {
        continue;
      }
      states.push(...this.statesOf(found));
      events.push(...this.axisEvents(found));
    }
    await this.publish(states);
    for (const { key, data } of events) {
      await this.fire(key, data);
    }
  }

  /**
   * Whether a city must not be read now: its account (Lyon) is missing, or
   * was refused less than an hour ago. New credentials are tried at once.
   */
  blocked(city) {
    if (!city.source.needsCredentials) {
      return false;
    }
    const credentials = this.config.grandLyon ?? null;
    const signature = credentials
      ? createHash('sha256').update(`${credentials.user}\n${credentials.password}`).digest('hex')
      : null;
    if (signature !== city.signature) {
      city.signature = signature;
      city.state.credentials = credentials;
      city.catalogRetryAt = null;
      city.refusedAt = null;
      city.credentials = null;
    }
    if (!credentials) {
      this.failed(city, new CredentialsError('missing'));
      return true;
    }
    return city.credentials === 'refused' && this.now() - city.refusedAt < CREDENTIALS_RETRY_MS;
  }

  /** The connection status of the integration: a Lyon account to fix, or fine. */
  async reportConnection() {
    const problem =
      this.activeKeys()
        .map((key) => this.cities.get(key)?.credentials)
        .find(Boolean) ?? null;
    if (problem === this.connectionProblem) {
      return;
    }
    try {
      if (problem) {
        await this.gladys.setConnectionStatus(false, render(CREDENTIALS, problem));
      } else {
        await this.gladys.setConnectionStatus(true);
      }
      this.connectionProblem = problem;
    } catch (err) {
      // Tried again at the next cycle.
      logger.debug(`Cannot set the connection status: ${err.message}`);
    }
  }

  /** Reads the catalog of a city when missing or a day old; a failure keeps the known one. */
  async readCatalog(city) {
    const now = this.now();
    if (city.axes && now - city.catalogAt < CATALOG_MAX_AGE_MS) {
      return;
    }
    if (!city.axes && city.catalogRetryAt !== null && now < city.catalogRetryAt) {
      return;
    }
    try {
      const segments = await city.source.catalog(this.fetch, city.state);
      // An empty list (a renamed field, a dataset being reloaded) is a
      // failure, not a city without roads.
      if (segments.length === 0) {
        throw new Error('empty segment list');
      }
      const axes = new Map();
      for (const segment of segments) {
        if (!axes.has(segment.axisKey)) {
          axes.set(segment.axisKey, {
            key: segment.axisKey,
            name: segment.axisName,
            names: segment.axisNames ?? null,
            search: segment.search ?? segment.axisName,
            ids: [],
            segments: [],
          });
        }
        const axis = axes.get(segment.axisKey);
        axis.ids.push(segment.id);
        axis.segments.push(segment);
      }
      city.axes = axes;
      city.home = null;
      city.catalogAt = now;
      logger.debug(`${city.source.name}: ${segments.length} segments, ${axes.size} roads`);
    } catch (err) {
      if (!city.axes) {
        // Never read yet: tried again in a few minutes, not at every cycle.
        city.catalogRetryAt = now + CATALOG_FIRST_RETRY_MS;
        this.failed(city, err);
        return;
      }
      // The catalog already known is still good: tried again later.
      city.catalogAt = now - CATALOG_MAX_AGE_MS + CATALOG_RETRY_MS;
      if (err instanceof CredentialsError) {
        this.failed(city, err);
        return;
      }
      logger.debug(`${city.source.name}: catalog not refreshed: ${err.message}`);
    }
  }

  /** Reads the live measures of some segments of a city; a failure is logged once. */
  async readLive(city, ids) {
    if (!city.axes) {
      return;
    }
    if (ids.length === 0) {
      this.succeeded(city);
      return;
    }
    try {
      const measures = await city.source.live(this.fetch, ids, city.state);
      // Kept for the segments not read this time (another road added since).
      for (const [id, measure] of measures) {
        city.measures.set(id, measure);
      }
      logger.debug(`${city.source.name}: ${measures.size} segments read`);
      this.succeeded(city);
    } catch (err) {
      this.failed(city, err);
    }
  }

  succeeded(city) {
    city.okAt = this.now();
    if (city.error) {
      logger.info(`${city.source.name}: data back`);
    }
    city.error = null;
    city.credentials = null;
  }

  failed(city, err) {
    // Once per failure, not at every cycle; a credentials problem that
    // changes (missing, then refused) is said again.
    const credentials = err instanceof CredentialsError ? err.reason : null;
    if (!city.error || (credentials && credentials !== city.credentials)) {
      logger.warn(`${city.source.name}: data unavailable: ${err.message}`);
    }
    city.error = err.message;
    city.credentials = credentials;
    city.refusedAt = credentials === 'refused' ? this.now() : null;
  }

  /** The trigger events of a road since its last known level. */
  axisEvents(found) {
    const { entry, city, summary } = found;
    const level = summary.level;
    if (level === STATUS.UNKNOWN) {
      return [];
    }
    const now = this.now();
    const state = this.levels.get(entry.deviceId);
    // A level known long ago (the portal back after an outage) would fire
    // changes that are no longer news.
    const window = 2 * this.config.refreshSeconds * 1000 + 30 * 60 * 1000;
    if (!state || now - state.at > window) {
      this.levels.set(entry.deviceId, { confirmed: level, candidate: level, at: now });
      return [];
    }
    // A new level counts once read twice in a row: a road hovering around a
    // threshold does not fire "jam" then "clear" at every cycle.
    const confirmed = level === state.candidate && level !== state.confirmed;
    const previous = { level: state.confirmed };
    this.levels.set(entry.deviceId, {
      confirmed: confirmed ? level : state.confirmed,
      candidate: level,
      at: now,
    });
    if (!confirmed) {
      return [];
    }
    const data = {
      axis: entry.deviceId,
      axis_name: entry.name ?? found.axis?.name ?? '',
      city: city.source.name,
      status: levelName(level, this.config.language),
      speed: summary.speed ?? 0,
    };
    const events = [];
    for (const [name, threshold] of Object.entries(JAM_LEVELS)) {
      if (previous.level < threshold && level >= threshold) {
        events.push({ key: TRIGGERS.JAM, data: { ...data, level: name } });
      }
    }
    if (previous.level >= STATUS.HEAVY && level === STATUS.FREE) {
      events.push({ key: TRIGGERS.CLEAR, data });
    }
    return events;
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      if (this.fireFailed) {
        this.fireFailed = false;
        logger.info('Scene triggers fired again');
      }
    } catch (err) {
      if (!this.fireFailed) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
      this.fireFailed = true;
    }
  }

  // --- texts ------------------------------------------------------------------

  /** "Dense · 32 km/h", "Fluide · 14.5 min", "Inconnu"… for a widget row or a sentence. */
  shortText(summary, language, { details = true } = {}) {
    if (!summary) {
      return '—';
    }
    const word = levelName(summary.level, language);
    if (!details || summary.level === STATUS.UNKNOWN || summary.level === STATUS.CLOSED) {
      return word;
    }
    if (summary.time !== null) {
      const minutes = Math.round(summary.time / 6) / 10;
      return `${word} · ${say(TEXT, language, 'minutes', { minutes })}`;
    }
    return summary.speed !== null ? `${word} · ${summary.speed} km/h` : word;
  }

  // --- configuration action -----------------------------------------------------

  status() {
    const now = this.now();
    const blocks = [];
    if (this.config.cities.length === 0) {
      blocks.push(render(REPORTS, 'noCity'));
    }
    for (const key of this.activeKeys()) {
      const city = this.city(key);
      blocks.push(
        render(REPORTS, 'city', { name: city.source.name, count: city.axes?.size ?? 0 }),
        city.okAt === null
          ? render(REPORTS, 'waiting')
          : render(REPORTS, 'read', { age: Math.round((now - city.okAt) / 1000) }),
        city.credentials
          ? render(CREDENTIALS, city.credentials)
          : city.error
            ? render(REPORTS, 'error', { error: city.error })
            : null,
      );
      const matches = city.source.listAll ? 0 : this.matchingAxes(city).length;
      if (this.config.cities.includes(key) && matches > MAX_DISCOVERED) {
        blocks.push(render(REPORTS, 'tooMany', { count: matches, max: MAX_DISCOVERED }));
      }
      const home = this.homeAxis(city);
      if (home) {
        blocks.push(render(REPORTS, 'home', { count: home.ids.length }));
      }
    }
    if (this.config.homeRadius > 0 && !this.house) {
      blocks.push(render(REPORTS, 'noHouse'));
    }
    blocks.push(render(REPORTS, 'watched', { count: this.watched().length }));
    return lines(...blocks);
  }
}
