// -----------------------------------------------------------------------------
// Lyon (Grand Lyon): the letters of the traffic map, the rows out of date, the
// zoom levels of the layer, the filtered requests with the account, and the
// account itself: missing or refused, said in the connection status and the
// "Status" action, without stopping the other cities. On the layer captured
// on 2026-10-31 (test/fixtures/sources/lyon-*.json).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREDENTIALS, render } from '../src/messages.js';
import { CREDENTIALS_RETRY_MS } from '../src/service.js';
import {
  CredentialsError,
  IDS_PER_REQUEST,
  SOURCES,
  STATUS,
  lineMiddle,
  lyonAxis,
  lyonMeasure,
  lyonSpeed,
} from '../src/sources.js';
import {
  LYON_ACCOUNT,
  action,
  captureLogs,
  create,
  createFetch,
  createWorld,
  cycle,
  featureId,
  setLive,
} from './helpers/world.js';

const STATE = {
  credentials: {
    user: LYON_ACCOUNT.grandlyon_username,
    password: LYON_ACCOUNT.grandlyon_password,
  },
};
const LYON = {
  cities: ['lyon'],
  roads: 'route de lyon, croix-rousse, terme, valvert',
  home_radius: '0',
};
const MISSING = render(CREDENTIALS, 'missing');
const REFUSED = render(CREDENTIALS, 'refused');
const row = (changes) => ({
  code: 'LYO00001',
  etat: 'V',
  vitesse: '42 km/h',
  longueur: 300,
  last_update: '2026-10-31T08:34:30+01:00',
  est_a_jour: true,
  ...changes,
});
const lyonCalls = (world) =>
  world.network.calls.filter((call) => call.url.includes('data.grandlyon.com'));

test('the letters of the map: green, orange, red, black; grey, "*" and the rest unknown', () => {
  assert.equal(lyonMeasure(row({ etat: 'V' })).status, STATUS.FREE);
  assert.equal(lyonMeasure(row({ etat: 'O' })).status, STATUS.HEAVY);
  assert.equal(lyonMeasure(row({ etat: 'R' })).status, STATUS.CONGESTED);
  assert.equal(lyonMeasure(row({ etat: 'N' })).status, STATUS.CLOSED);
  for (const etat of ['G', '*', 'X', '', null, undefined]) {
    const measure = lyonMeasure(row({ etat }));
    assert.equal(measure.status, STATUS.UNKNOWN, String(etat));
    assert.equal(measure.speed, null, String(etat));
  }
  assert.deepEqual(lyonMeasure(row({})), {
    status: STATUS.FREE,
    speed: 42,
    time: null,
    usual: null,
    length: 300,
    at: Date.parse('2026-10-31T08:34:30+01:00'),
  });
  // A closed road has no speed to show.
  assert.equal(lyonMeasure(row({ etat: 'N', vitesse: '5 km/h' })).speed, null);
});

test('a row out of date is never a free flow, whatever its letter', () => {
  for (const est_a_jour of [false, null, undefined, 'true']) {
    const measure = lyonMeasure(row({ est_a_jour }));
    assert.equal(measure.status, STATUS.UNKNOWN, String(est_a_jour));
    assert.equal(measure.speed, null);
  }
});

test('the speed: a number of km/h, nothing for "Vitesse réglementaire" or an empty text', () => {
  assert.equal(lyonSpeed('18 km/h'), 18);
  assert.equal(lyonSpeed('106 km/h'), 106);
  assert.equal(lyonSpeed('12,5 km/h'), 12.5);
  assert.equal(lyonSpeed('0 km/h'), null);
  assert.equal(lyonSpeed('Vitesse réglementaire'), null);
  assert.equal(lyonSpeed(''), null);
  assert.equal(lyonSpeed(null), null);
});

test('the road: its label, the search spelling out the abbreviation', () => {
  assert.deepEqual(lyonAxis('RTE DE LYON'), {
    axisKey: 'rte-de-lyon',
    axisName: 'RTE DE LYON',
    search: 'RTE DE LYON route DE LYON',
  });
  assert.equal(lyonAxis('BD  DE LA CROIX-ROUSSE ').axisName, 'BD DE LA CROIX-ROUSSE');
  assert.match(lyonAxis('RD95').search, /route départementale95/);
  assert.equal(
    lyonAxis('A6_GORGE DE LOUP_PORTE DE VALVERT').search,
    'A6_GORGE DE LOUP_PORTE DE VALVERT',
  );
  assert.equal(lyonAxis('   '), null);
  assert.deepEqual(
    lineMiddle([
      [4.8, 45.7],
      [4.9, 45.8],
    ]),
    { lat: 45.75, lon: 4.85 },
  );
  assert.deepEqual(
    lineMiddle([
      [4, 45],
      [5, 46],
      [6, 47],
    ]),
    { lat: 46, lon: 5 },
  );
  assert.deepEqual(lineMiddle([]), { lat: null, lon: null });
});

test('the catalog: one segment per code, whatever the zoom levels of the layer', async () => {
  const { fetch, data, calls } = createFetch();
  const segments = await SOURCES.lyon.catalog(fetch, STATE);
  const codes = new Set(data.lyon.catalog.features.map((f) => f.properties.code));
  assert.ok(data.lyon.catalog.features.length > codes.size, 'the capture repeats codes');
  assert.equal(segments.length, codes.size);
  assert.deepEqual(
    segments.find((s) => s.id === 'LYO02330'),
    {
      id: 'LYO02330',
      axisKey: 'sortie-a6-de-paris-a-valvert',
      axisName: 'SORTIE A6 DE PARIS A VALVERT',
      search: 'SORTIE A6 DE PARIS A VALVERT',
      lat: segments.find((s) => s.id === 'LYO02330').lat,
      lon: segments.find((s) => s.id === 'LYO02330').lon,
    },
  );
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('propertyName'), 'code,libelle,longueur,the_geom');
  assert.equal(url.searchParams.get('SRSNAME'), 'EPSG:4171');
});

test('the live rows: a CQL filter on the codes, a hundred at most, no geometry, the account sent', async () => {
  const { fetch, calls } = createFetch();
  const measures = await SOURCES.lyon.live(fetch, ['LYO02330', 'LYO01085'], STATE);
  assert.deepEqual([...measures.keys()].sort(), ['LYO01085', 'LYO02330']);
  assert.equal(measures.get('LYO02330').status, STATUS.UNKNOWN);
  assert.equal(measures.get('LYO01085').status, STATUS.FREE);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('CQL_FILTER'), "code IN ('LYO02330','LYO01085')");
  assert.equal(url.searchParams.get('count'), '8');
  assert.doesNotMatch(url.searchParams.get('propertyName'), /the_geom/);
  assert.match(calls[0].headers.authorization, /^Basic /);
  assert.doesNotMatch(calls[0].url, /not a secret|gladys-test/);

  const ids = Array.from({ length: IDS_PER_REQUEST + 1 }, (_, i) => `LYO9${i}'`);
  await SOURCES.lyon.live(fetch, ids, STATE);
  assert.equal(calls.length, 3);
  assert.match(new URL(calls[1].url).searchParams.get('CQL_FILTER'), /^code IN \('LYO90''',/);
});

test('without the account the portal is not called; refused, the error says so', async () => {
  const { fetch, calls } = createFetch();
  await assert.rejects(SOURCES.lyon.catalog(fetch, {}), (err) => err.reason === 'missing');
  assert.equal(calls.length, 0);
  const wrong = { credentials: { user: 'gladys-test', password: 'wrong' } };
  await assert.rejects(
    SOURCES.lyon.live(fetch, ['LYO02330'], wrong),
    (err) => err instanceof CredentialsError && err.reason === 'refused',
  );
});

test('Lyon end to end: roads found by their spelt-out name, closed tunnel, out-of-date exit unknown', async (t) => {
  const world = await createWorld({ config: { ...LYON, ...LYON_ACCOUNT } });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => d.name),
    [
      'Lyon · A6_GORGE DE LOUP_PORTE DE VALVERT',
      'Lyon · BD DE LA CROIX-ROUSSE',
      'Lyon · RTE DE LYON',
      'Lyon · SORTIE A6 DE PARIS A VALVERT',
      'Lyon · TUNNEL ROUTIER DE LE RUE TERME',
    ],
  );
  const road = await create(world, 'RTE DE LYON');
  assert.equal(road.external_id, 'ext:test-integration:axis:lyon-rte-de-lyon');
  assert.deepEqual(
    road.features.map((f) => f.external_id.split(':').pop()),
    ['status', 'level', 'speed', 'age'],
  );
  assert.equal(world.fake.lastState(featureId(road, 'status')), 'Fluide');
  const tunnel = await create(world, 'TUNNEL ROUTIER');
  assert.equal(world.fake.lastState(featureId(tunnel, 'level')), STATUS.CLOSED);
  // est_a_jour false since 2026-10-28: unknown, no free flow published.
  const exit = await create(world, 'SORTIE A6 DE PARIS');
  assert.equal(world.fake.lastState(featureId(exit, 'level')), STATUS.UNKNOWN);
  assert.equal(world.fake.lastState(featureId(exit, 'speed')), undefined);

  // The road turns red on most of its length, then the Criter feed stops.
  setLive(world, 'lyon', () => true, { etat: 'R', vitesse: '9 km/h' });
  await cycle(world);
  await cycle(world);
  assert.equal(world.fake.lastState(featureId(road, 'level')), STATUS.CONGESTED);
  setLive(world, 'lyon', () => true, { est_a_jour: false });
  await cycle(world);
  assert.equal(world.fake.lastState(featureId(road, 'level')), STATUS.UNKNOWN);
  // Only the segments of the roads added are read, with the account.
  const live = lyonCalls(world).filter((call) => call.url.includes('CQL_FILTER'));
  assert.ok(live.length > 0);
  assert.ok(live.every((call) => call.headers.authorization));
  // A working account never touches the connection status.
  assert.deepEqual(world.fake.connectionStatuses, []);
});

test('Lyon without an account: nothing asked to the portal, the other cities go on, the status says what to type', async (t) => {
  const world = await createWorld({
    config: { ...LYON, cities: ['rennes', 'lyon'], roads: 'Route nationale 136' },
  });
  t.after(() => world.app.stop());
  assert.equal(lyonCalls(world).length, 0);
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: MISSING });
  assert.ok(world.fake.discoveredDevices.some((d) => d.name.includes('Route nationale 136')));
  const message = await action(world, 'status');
  assert.match(message.fr, /Lyon : saisissez l'identifiant et le mot de passe/);
  assert.match(message.fr, /Rennes Métropole : \d+ axes connus/);
  await cycle(world);
  assert.equal(world.fake.connectionStatuses.length, 1, 'said once');

  // The account typed in the settings: read at once, the status fine again.
  await world.fake.configUpdated({ ...LYON, ...LYON_ACCOUNT });
  assert.ok(lyonCalls(world).length > 0);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.ok(world.fake.discoveredDevices.some((d) => d.name === 'Lyon · RTE DE LYON'));
});

test('Lyon refused: one clear message, tried again after an hour or new credentials, Rennes unaffected', async (t) => {
  const wrong = { grandlyon_username: 'gladys-test', grandlyon_password: 'wrong password' };
  const config = { ...LYON, cities: ['rennes', 'lyon'], roads: 'Route nationale 136', ...wrong };
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ config });
  t.after(() => world.app.stop());
  const rn136 = await create(world, 'Route nationale 136');
  assert.ok(world.fake.lastState(featureId(rn136, 'level')) >= 1);
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: REFUSED });
  assert.match(REFUSED.fr, /identifiants Grand Lyon refusés/);
  assert.match(REFUSED.fr, /GrandLyon Connect/);
  const message = await action(world, 'status');
  assert.match(message.fr, /identifiants Grand Lyon refusés/);
  assert.match(message.en, /Grand Lyon credentials refused/);

  // Not one 401 per cycle: the same credentials wait an hour.
  const before = lyonCalls(world).length;
  for (let i = 0; i < 5; i += 1) {
    await cycle(world);
  }
  assert.equal(lyonCalls(world).length, before);
  world.clock.advance(CREDENTIALS_RETRY_MS);
  await cycle(world);
  assert.equal(lyonCalls(world).length, before + 1);

  // Never the password, nor the username, in the logs.
  const text = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(text, /wrong password|gladys-test/);
  assert.equal(lines.filter((line) => /Grand Lyon credentials refused/.test(line.text)).length, 1);

  // The right password: read at once, the connection status fine again.
  await world.fake.configUpdated({ ...config, ...LYON_ACCOUNT });
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.match((await action(world, 'status')).fr, /■ Lyon : \d+ axes connus/);
});

test('Lyon not chosen: no account asked, the connection status untouched', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await cycle(world);
  assert.deepEqual(world.fake.connectionStatuses, []);
  assert.doesNotMatch((await action(world, 'status')).fr, /Grand Lyon/);
});
