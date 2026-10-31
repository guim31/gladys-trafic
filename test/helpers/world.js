// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake `fetch` serving the
// real answers of the four portals and the files of the national roads (captured on 2026-10-29 around 11:59 in
// Paris, see test/fixtures/sources), a manual clock, and the integration wired
// on top through registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.LOG_LEVEL ??= 'silent';

export const fixtureText = (name) =>
  readFileSync(new URL(`../fixtures/sources/${name}`, import.meta.url), 'utf8');

export const fixtureJson = (name) => JSON.parse(fixtureText(name));

// 2026-10-29 10:59:03 UTC, the time of the capture.
export const FIXTURE_TIME = 1793271543230;

// A house in the centre of Rennes (place de la République), not a real address.
export const RENNES_HOUSE = {
  id: 'h1',
  name: 'Maison',
  selector: 'maison',
  latitude: 48.1113,
  longitude: -1.68,
};

// The datasets served, by dataset id: the catalog, the live records and the id field.
const DATASETS = {
  'etat-du-trafic-en-temps-reel': {
    city: 'rennes',
    idField: 'predefinedlocationreference',
  },
  '244400404_fluidite-axes-routiers-nantes-metropole': { city: 'nantes', idField: 'cha_id' },
  sirac_flux_trafic: { city: 'strasbourg', idField: 'ident' },
  ci_tpstj_a: { city: 'bordeaux', idField: 'bm_ident' },
};

// The national roads (DIR): refDir.csv and qtvDir.xml of the Bison Futé
// server, captured on 2026-10-29 at 17:00 in Paris (the Toulouse ring road
// and a few odd rows), served on the clock of the other fixtures: the newest
// measure is moved to 4 minutes before FIXTURE_TIME.
const DIR_PATH = '/bison-fute-ouvert/publicationsDIR/QTV-DIR/';
export const DIR_LAST_MODIFIED = 'Thu, 29 Oct 2026 10:57:00 GMT';

/** The measures of qtvDir.xml as `{ id, at, flow, speed }` records (speed null: none). */
export function dirRecords(xml) {
  const records = [];
  for (const [block] of xml.matchAll(/<siteMeasurements>.*?<\/siteMeasurements>/gs)) {
    const get = (re) => re.exec(block)?.[1] ?? null;
    records.push({
      id: get(/id="([^"]*)"/),
      at: Date.parse(get(/<measurementTimeDefault>([^<]*)</)),
      flow: get(/<vehicleFlowRate>([^<]*)</),
      speed: get(/<speed>([^<]*)</),
    });
  }
  const newest = Math.max(...records.map((r) => r.at));
  for (const record of records) {
    record.at += FIXTURE_TIME - 4 * 60 * 1000 - newest;
  }
  return records;
}

/** qtvDir.xml again, from records: the head and tail of the capture around them. */
export function dirXml(records, xml = fixtureText('dir-live.xml')) {
  const start = xml.indexOf('<siteMeasurements>');
  const end = xml.lastIndexOf('</siteMeasurements>') + '</siteMeasurements>'.length;
  const blocks = records.map(
    (r) => `<siteMeasurements>
            <measurementSiteReference targetClass="MeasurementSiteRecord" id="${r.id}" version="1.0"/>
            <measurementTimeDefault>${new Date(r.at).toISOString()}</measurementTimeDefault>
            <measuredValue index="0"><measuredValue><basicData xsi:type="TrafficFlow"><vehicleFlow><vehicleFlowRate>${r.flow}</vehicleFlowRate></vehicleFlow></basicData></measuredValue></measuredValue>
            ${r.speed === null ? '' : `<measuredValue index="0"><measuredValue><basicData xsi:type="TrafficSpeed"><averageVehicleSpeed><speed>${r.speed}</speed></averageVehicleSpeed></basicData></measuredValue></measuredValue>`}
        </siteMeasurements>`,
  );
  return xml.slice(0, start) + blocks.join('\n        ') + xml.slice(end);
}

// Lyon (Grand Lyon WFS): the layer captured on 2026-10-31 at 08:35 in Paris
// (16 roads, every zoom level of their segments), read with a test account
// only the fake knows. The measures move to the clock of the other fixtures:
// the newest one 4 minutes before FIXTURE_TIME, the others as far before it.
export const LYON_ACCOUNT = {
  grandlyon_username: 'gladys-test',
  grandlyon_password: 'not a secret',
};
const LYON_AUTH = `Basic ${Buffer.from('gladys-test:not a secret').toString('base64')}`;

/** The live rows of the Lyon capture, dated on the fixture clock. */
export function lyonRecords(rows = fixtureJson('lyon-live.json')) {
  const newest = Math.max(...rows.map((r) => Date.parse(r.last_update)));
  return rows.map((r) => ({
    ...r,
    last_update: new Date(
      Date.parse(r.last_update) + FIXTURE_TIME - 4 * 60 * 1000 - newest,
    ).toISOString(),
  }));
}

/** The codes of a CQL `code IN ('a','b')` filter. */
function lyonCodes(filter) {
  return [...String(filter).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

/** The ids of an ODSQL `field in (a, "b")` clause. */
function idsOf(where) {
  const list = /\bin \((.*)\)$/.exec(where)?.[1] ?? '';
  return list.split(',').map((item) => item.trim().replace(/^"(.*)"$/, '$1'));
}

/**
 * A fake `fetch` for the Opendatasoft exports. `data[city]` holds the catalog
 * and live records served (editable by the tests); `down` is a set of cities
 * whose portal fails, `status` a map city → HTTP status. Every call is
 * recorded in `calls`.
 */
export function createFetch() {
  const data = {};
  for (const { city } of Object.values(DATASETS)) {
    data[city] =
      city === 'bordeaux'
        ? { catalog: fixtureJson('bordeaux.json'), live: fixtureJson('bordeaux.json') }
        : {
            catalog: fixtureJson(`${city}-catalog.json`),
            live: fixtureJson(`${city}-live.json`),
          };
  }
  data.lyon = { catalog: fixtureJson('lyon-catalog.json'), live: lyonRecords() };
  data.dir = {
    catalog: fixtureText('dir-ref.csv'),
    live: dirRecords(fixtureText('dir-live.xml')),
    modified: DIR_LAST_MODIFIED,
  };
  const calls = [];
  const down = new Set();
  const status = new Map();
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    const parsed = new URL(url);
    if (parsed.host === 'data.grandlyon.com') {
      return lyonAnswer(parsed, init.headers ?? {});
    }
    if (parsed.host === 'tipi.bison-fute.gouv.fr' && parsed.pathname.startsWith(DIR_PATH)) {
      return dirAnswer(parsed.pathname.slice(DIR_PATH.length), init.headers ?? {});
    }
    const dataset = /\/datasets\/([^/]+)\/exports\/json$/.exec(parsed.pathname)?.[1];
    const spec = DATASETS[dataset];
    if (!spec) {
      return new Response('not found', { status: 404 });
    }
    if (down.has(spec.city)) {
      throw new TypeError('fetch failed');
    }
    if (status.has(spec.city)) {
      return new Response('error', { status: status.get(spec.city) });
    }
    return odsAnswer(spec, parsed);
  };
  const lyonAnswer = (parsed, headers) => {
    if (down.has('lyon')) {
      throw new TypeError('fetch failed');
    }
    if (parsed.pathname !== '/geoserver/metropole-de-lyon/ows') {
      return new Response('not found', { status: 404 });
    }
    if (headers.authorization !== LYON_AUTH) {
      return new Response('{"detail":"Nom d\'utilisateur et/ou mot de passe non valide(s)."}', {
        status: 401,
      });
    }
    if (status.has('lyon')) {
      return new Response('error', { status: status.get('lyon') });
    }
    const filter = parsed.searchParams.get('CQL_FILTER');
    let features;
    if (filter) {
      const codes = new Set(lyonCodes(filter));
      features = data.lyon.live
        .filter((r) => codes.has(r.code))
        .map((properties) => ({ type: 'Feature', geometry: null, properties }));
      const count = Number(parsed.searchParams.get('count'));
      if (count > 0) {
        features = features.slice(0, count);
      }
    } else {
      features = data.lyon.catalog.features;
    }
    return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const dirAnswer = (file, headers) => {
    if (down.has('dir')) {
      throw new TypeError('fetch failed');
    }
    if (status.has('dir')) {
      return new Response('error', { status: status.get('dir') });
    }
    if (file === 'refDir.csv') {
      return new Response(data.dir.catalog, { headers: { 'content-type': 'text/csv' } });
    }
    if (file !== 'qtvDir.xml') {
      return new Response('not found', { status: 404 });
    }
    if (headers['if-modified-since'] === data.dir.modified) {
      return new Response(null, { status: 304 });
    }
    return new Response(dirXml(data.dir.live), {
      headers: { 'content-type': 'application/xml', 'last-modified': data.dir.modified },
    });
  };
  const odsAnswer = (spec, parsed) => {
    const where = parsed.searchParams.get('where');
    const served = data[spec.city];
    let records;
    if (where) {
      const ids = new Set(idsOf(where));
      records = served.live.filter((r) => ids.has(String(r[spec.idField])));
    } else {
      records = spec.city === 'bordeaux' ? served.live : served.catalog;
    }
    return new Response(JSON.stringify(records), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls, data, down, status };
}

/** A manual clock. */
export function createClock(start = FIXTURE_TIME) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.network] from createFetch
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = { cities: ['rennes'], roads: 'Route nationale 136, Patton' },
  network = createFetch(),
  devices = [],
  houses = [RENNES_HOUSE],
  connect = true,
  clock = createClock(),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, { fetch: network.fetch, timers: false, now: clock.now });
  const world = { gladys, fake: gladys.fake, app, service: app.service, network, clock };
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.service.loading;
  }
  return world;
}

/** Run a configuration action; resolves with its message (multi-language). */
export async function action(world, key, fields = {}) {
  const ack = await world.fake.action(key, fields);
  if (!ack.success) {
    throw new Error(`${key} failed: ${ack.error}`);
  }
  return ack.data.message;
}

/** The device published for a name part or a predicate, from the last discovery list. */
export const discovered = (world, predicate) =>
  world.fake.discoveredDevices.find(
    typeof predicate === 'function' ? predicate : (d) => d.name.includes(predicate),
  );

/** Create a discovered device in Gladys, as the user would. */
export async function create(world, predicate) {
  const device = discovered(world, predicate);
  if (!device) {
    throw new Error(`${predicate} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** One refresh cycle, `seconds` later. */
export async function cycle(world, seconds = 180) {
  world.clock.advance(seconds * 1000);
  await world.service.refresh();
}

/** Changes the live records of a city matched by a predicate. */
export function setLive(world, city, predicate, changes) {
  for (const record of world.network.data[city].live) {
    if (predicate(record)) {
      Object.assign(record, typeof changes === 'function' ? changes(record) : changes);
    }
  }
}

/** Captures what the integration logs, at a level. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
