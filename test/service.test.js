// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the real
// answers of the portals: discovery (search, Bordeaux routes, around the
// house), states, unknown after 30 minutes, filtered requests, triggers,
// widget, scene action, the integration's own timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { STALE_MS } from '../src/devices.js';
import { CATALOG_MAX_AGE_MS, TRIGGERS } from '../src/service.js';
import {
  action,
  create,
  createFetch,
  createWorld,
  cycle,
  discovered,
  featureId,
  setLive,
} from './helpers/world.js';

const RN136 = 'Route nationale 136';
const ALL = { cities: ['rennes', 'nantes', 'strasbourg', 'bordeaux'] };

/** The ids of the Rennes segments of a road, from the served catalog. */
const rennesIds = (world, denomination) =>
  new Set(
    world.network.data.rennes.catalog
      .filter((r) => r.denomination === denomination)
      .map((r) => r.predefinedlocationreference),
  );

test('the roads matching the search are offered, with the segments around the house', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => d.name),
    [
      'Rennes Métropole · Avenue Général George S. Patton (Rennes)',
      'Rennes Métropole · Route nationale 136',
      'Rennes Métropole · Autour de la maison',
    ],
  );
  const road = discovered(world, RN136);
  assert.equal(road.external_id, 'ext:test-integration:axis:rennes-route-nationale-136');
  assert.equal(road.should_poll, false);
  assert.equal(road.poll_frequency, undefined);
  assert.deepEqual(
    road.features.map((f) => f.external_id.split(':').pop()),
    ['status', 'level', 'speed', 'age'],
  );
  assert.ok(world.network.calls.every((call) => call.url.includes('rennesmetropole')));
});

test('no city ticked: nothing read, an empty discovery, the status says what to do', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.discoveredDevices, []);
  assert.equal(world.network.calls.length, 0);
  const message = await action(world, 'status');
  assert.match(message.fr, /Aucune ville choisie/);
});

test('without a search: the house only, and every route of Bordeaux', async (t) => {
  const world = await createWorld({ config: { ...ALL, roads: '' } });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices.map((d) => d.name);
  assert.equal(names.filter((n) => n.startsWith('Bordeaux')).length, 16);
  // The house is in Rennes: no segment of the other cities within 1 km.
  assert.deepEqual(
    names.filter((n) => !n.startsWith('Bordeaux')),
    ['Rennes Métropole · Autour de la maison'],
  );
});

test('the search ignores case and accents, the generic names are no road', async (t) => {
  const world = await createWorld({
    config: {
      cities: ['rennes', 'nantes', 'strasbourg'],
      roads: 'fougeres; ROND-POINT, schirmeck',
    },
  });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices.map((d) => d.name);
  assert.ok(names.includes('Rennes Métropole · Rue de Fougères (Rennes)'), names.join('\n'));
  assert.ok(!names.some((n) => /Rond-point/i.test(n)));
  assert.ok(names.includes('Strasbourg · Schirmeck - Sortie Ville'));
  // The cycle counters of Strasbourg are left out.
  assert.ok(!names.some((n) => /· Cyc/i.test(n)));
});

test('the house: none located, the radius off, or the core refusing, no such device', async (t) => {
  const unlocated = await createWorld({
    houses: [{ id: 'h', name: 'Maison', selector: 'm', latitude: null, longitude: null }],
  });
  t.after(() => unlocated.app.stop());
  assert.ok(!discovered(unlocated, 'Autour'));
  assert.match((await action(unlocated, 'status')).fr, /aucune maison localisée/);

  const off = await createWorld({
    config: { cities: ['rennes'], roads: RN136, home_radius: '0' },
    connect: false,
  });
  t.after(() => off.app.stop());
  let asked = 0;
  off.gladys.getHouses = async () => {
    asked += 1;
    return [];
  };
  await off.gladys.connect();
  await off.app.ready;
  await off.app.service.loading;
  assert.ok(discovered(off, RN136));
  assert.ok(!discovered(off, 'Autour'));
  // The location of the house is not even read.
  assert.equal(asked, 0);

  const gladys = createFakeGladys({ config: { cities: ['rennes'] } });
  gladys.getHouses = async () => {
    throw new Error('HTTP 403');
  };
  const app = registerHandlers(gladys, { fetch: createFetch().fetch, timers: false });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  await app.service.loading;
  assert.deepEqual(gladys.fake.discoveredDevices, []);
});

test('a road added gets all its states at once, then only the changes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, RN136);
  const last = (key) => world.fake.lastState(featureId(device, key));
  assert.equal(last('status'), 'Fluide');
  assert.equal(last('level'), 1);
  assert.equal(last('speed'), 88);
  assert.equal(last('age'), 5); // 11:54 → 11:59
  assert.deepEqual(world.fake.widgetRefreshes, ['traffic']);

  const before = world.fake.states.length;
  await cycle(world, 180);
  const sent = world.fake.states.slice(before).map((s) => s.device_feature_external_id);
  assert.deepEqual(sent, [featureId(device, 'age')]);
  assert.equal(last('age'), 8);
});

test('the live measures are filtered by the portal: only the segments of the roads added', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, RN136);
  const before = world.network.calls.length;
  await cycle(world);
  const calls = world.network.calls.slice(before).map((c) => new URL(c.url));
  // 146 segments: two requests of 100 ids at most, no catalog again.
  assert.equal(calls.length, 2);
  const asked = new Set();
  for (const url of calls) {
    const where = url.searchParams.get('where');
    assert.match(where, /^predefinedlocationreference in \(/);
    for (const id of where.slice(where.indexOf('(') + 1, -1).split(',')) {
      asked.add(JSON.parse(id));
    }
  }
  assert.deepEqual(asked, rennesIds(world, RN136));
  // The catalog again after a day.
  world.clock.advance(CATALOG_MAX_AGE_MS);
  await cycle(world, 1);
  const catalog = world.network.calls.filter((c) => !new URL(c.url).searchParams.get('where'));
  assert.equal(catalog.length, 2);
});

test('the level of a road is the worst one met on a quarter of its length', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, RN136);
  const ids = [...rennesIds(world, RN136)];
  const level = () => world.fake.lastState(featureId(device, 'level'));
  setLive(world, 'rennes', (r) => ids.slice(0, 20).includes(r.predefinedlocationreference), {
    trafficstatus: 'congested',
    averagevehiclespeed: 15,
  });
  await cycle(world);
  assert.equal(level(), 1, 'a few congested segments');
  setLive(world, 'rennes', (r) => ids.slice(0, 60).includes(r.predefinedlocationreference), {
    trafficstatus: 'heavy',
    averagevehiclespeed: 40,
  });
  await cycle(world);
  assert.equal(level(), 2);
  assert.equal(world.fake.lastState(featureId(device, 'status')), 'Dense');
  setLive(world, 'rennes', (r) => ids.includes(r.predefinedlocationreference), {
    trafficstatus: 'impossible',
  });
  await cycle(world);
  assert.equal(level(), 4);
  assert.equal(world.fake.lastState(featureId(device, 'status')), 'Coupé');
});

test('no recent measure: the road is unknown, nothing made up, the age keeps growing', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, RN136);
  world.network.down.add('rennes');
  for (let i = 0; i < 9; i += 1) {
    await cycle(world, 180);
  }
  // 11:54 → 12:26: 32 minutes, out of date.
  assert.equal(world.fake.lastState(featureId(device, 'age')), 32);
  assert.equal(world.fake.lastState(featureId(device, 'level')), 0);
  assert.equal(world.fake.lastState(featureId(device, 'status')), 'Inconnu');
  // The last speed stays, no new value is invented.
  assert.equal(world.fake.lastState(featureId(device, 'speed')), 88);
  assert.match((await action(world, 'status')).en, /fetch failed/);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('a measure dated by the portal more than 30 minutes ago does not count', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, RN136);
  const old = new Date(world.clock.now() - STALE_MS - 60000).toISOString();
  setLive(world, 'rennes', () => true, { datetime: old, trafficstatus: 'congested' });
  await cycle(world, 1);
  assert.equal(world.fake.lastState(featureId(device, 'level')), 0);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('triggers: a road turning heavy, then congested, then clear again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, RN136);
  const ids = rennesIds(world, RN136);
  const set = (trafficstatus) =>
    setLive(world, 'rennes', (r) => ids.has(r.predefinedlocationreference), { trafficstatus });
  set('heavy');
  await cycle(world);
  set('congested');
  await cycle(world);
  await cycle(world);
  set('freeFlow');
  await cycle(world);
  const events = world.fake.sceneEvents.map((e) => [e.key, e.data.level ?? null, e.data.status]);
  assert.deepEqual(events, [
    [TRIGGERS.JAM, 'heavy', 'Dense'],
    [TRIGGERS.JAM, 'congested', 'Saturé'],
    [TRIGGERS.CLEAR, null, 'Fluide'],
  ]);
  const data = world.fake.sceneEvents[0].data;
  assert.equal(data.axis, device.external_id);
  assert.equal(data.axis_name, device.name);
  assert.equal(data.city, 'Rennes Métropole');
  assert.equal(typeof data.speed, 'number');
});

test('a jump from free flow to congested fires both levels at once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, RN136);
  setLive(world, 'rennes', () => true, { trafficstatus: 'congested' });
  await cycle(world);
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => e.data.level),
    ['heavy', 'congested'],
  );
});

test('Nantes, Strasbourg, Bordeaux: their own statuses, speeds and travel times', async (t) => {
  const world = await createWorld({ config: { ...ALL, roads: 'Anglais, Schirmeck' } });
  t.after(() => world.app.stop());
  const anglais = await create(world, 'Nantes Métropole · Anglais');
  const schirmeck = await create(world, 'Schirmeck - Sortie Ville');
  const latule = await create(world, 'Aliénor: Rocade à la Place Latule');
  const ornano = await create(world, 'Boulevards: Rond point JJBosc à la Barrière Ornano');
  const last = (device, key) => world.fake.lastState(featureId(device, key));
  assert.equal(last(anglais, 'level'), 1);
  assert.equal(last(anglais, 'speed'), 16);
  assert.equal(last(schirmeck, 'level'), 2);
  assert.equal(last(schirmeck, 'speed'), 26);
  // 360 s against 128 s usually: congested.
  assert.equal(last(latule, 'level'), 3);
  assert.equal(last(latule, 'travel_time'), 6);
  assert.equal(last(latule, 'usual_time'), 2.1);
  assert.equal(last(ornano, 'level'), 1);
  assert.equal(featureId(ornano, 'speed'), undefined);

  setLive(world, 'nantes', (r) => r.cha_id === 5043 || r.etat_trafic === 'Fluide', {
    etat_trafic: 'Bloqué',
  });
  setLive(world, 'strasbourg', () => true, { etatexp: 1 });
  await cycle(world);
  assert.equal(last(anglais, 'level'), 3);
  assert.equal(last(schirmeck, 'level'), 4);
  assert.equal(last(schirmeck, 'status'), 'Coupé');
});

test('the segments around the house: the nearest ones, one device', async (t) => {
  // No segment within 500 m of the centre of Rennes (pedestrian streets).
  const near = await createWorld({ config: { cities: ['rennes'], home_radius: '500' } });
  t.after(() => near.app.stop());
  assert.deepEqual(near.fake.discoveredDevices, []);
  const world = await createWorld({ config: { cities: ['rennes'], home_radius: '2000' } });
  t.after(() => world.app.stop());
  const home = await create(world, 'Autour de la maison');
  assert.equal(home.external_id, 'ext:test-integration:axis:rennes-home');
  assert.ok(world.fake.lastState(featureId(home, 'level')) >= 1);
  assert.match((await action(world, 'status')).fr, /Autour de la maison : \d+ tronçons/);
});

test('widget: one colored row per road, the name given in Gladys, details optional', async (t) => {
  const world = await createWorld({ config: { ...ALL, roads: RN136 } });
  t.after(() => world.app.stop());
  const empty = await world.fake.widgetGet('traffic', { language: 'fr' });
  assert.match(empty.data.content.components[0].text, /Découverte/);

  const road = await create(world, RN136);
  await create(world, 'Aliénor: Rocade à la Place Latule');
  await world.fake.deviceUpdated({ ...road, name: 'Rocade' });
  const got = await world.fake.widgetGet('traffic', { language: 'fr' });
  assert.equal(got.success, true);
  const content = got.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  const rows = [...content.components[0].items].sort((a, b) => a.label.localeCompare(b.label));
  assert.deepEqual(rows, [
    {
      label: 'Bordeaux Métropole · Aliénor: Rocade à…',
      value: 'Saturé · 6 min',
      color: WIDGET_COLORS.DANGER,
    },
    { label: 'Rocade', value: 'Fluide · 88 km/h', color: WIDGET_COLORS.SUCCESS },
  ]);
  const plain = await world.fake.widgetGet('traffic', {
    language: 'de',
    settings: { axes: [road.external_id], show_details: false },
  });
  assert.deepEqual(plain.data.content.components[0].items, [
    { label: 'Rocade', value: 'Flüssig', color: WIDGET_COLORS.SUCCESS },
  ]);
  assert.ok(world.fake.widgetRefreshes.length >= 3);
});

test('scene action: the traffic in one sentence, with numbers for a condition', async (t) => {
  const world = await createWorld({ config: { ...ALL, roads: RN136 } });
  t.after(() => world.app.stop());
  const none = await world.fake.sceneAction('traffic_summary', {});
  assert.equal(none.success, false);
  assert.match(none.error, /Découverte/);

  const road = await create(world, RN136);
  const free = await world.fake.sceneAction('traffic_summary', {});
  assert.deepEqual(free.data.outputs, {
    sentence: 'Trafic fluide sur votre axe suivi.',
    worst_level: 1,
    jammed: 0,
  });
  await create(world, 'Aliénor: Rocade à la Place Latule');
  const jam = await world.fake.sceneAction('traffic_summary', {});
  assert.deepEqual(jam.data.outputs, {
    sentence:
      'Trafic : Bordeaux Métropole · Aliénor: Rocade à la Place Latule (saturé, 6 min). Fluide ailleurs.',
    worst_level: 3,
    jammed: 1,
  });
  const one = await world.fake.sceneAction('traffic_summary', { axes: [road.external_id] });
  assert.equal(one.data.outputs.jammed, 0);
  const gone = await world.fake.sceneAction('traffic_summary', { axes: ['ext:nope'] });
  assert.equal(gone.success, false);
});

test('the integration reads on its own timer, without any poll from Gladys', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const network = createFetch();
  const gladys = createFakeGladys({
    config: { cities: ['bordeaux'], refresh_interval: '120' },
    devices: [
      {
        name: 'Bordeaux Métropole · Boulevards',
        external_id: 'ext:test-integration:axis:bordeaux-20',
        params: [
          { name: 'source', value: 'bordeaux' },
          { name: 'axis', value: '20' },
        ],
        features: [],
      },
    ],
  });
  const app = registerHandlers(gladys, { fetch: network.fetch });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  await app.service.loading;
  const reads = () => network.calls.length;
  // The catalog and the live measures.
  assert.equal(reads(), 2);
  t.mock.timers.tick(120 * 1000);
  await app.service.refreshing;
  assert.equal(reads(), 3);
  t.mock.timers.tick(120 * 1000);
  await app.service.refreshing;
  assert.equal(reads(), 4);
});
