// -----------------------------------------------------------------------------
// The national roads (DIR): the reference file and its odd rows, the DATEX II
// measure file read as a stream, the status deduced from the speed, the
// conditional reads, and the Toulouse ring road end to end (discovery,
// states, triggers, around the house), on the files captured on 2026-10-29.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS } from '../src/service.js';
import {
  DirMeasureParser,
  SOURCES,
  STATUS,
  dirCatalog,
  dirDepartment,
  dirDirection,
  dirRoad,
  dirStatus,
  lambert93ToWgs84,
  parseDirCsv,
} from '../src/sources.js';
import {
  action,
  create,
  createFetch,
  createWorld,
  cycle,
  discovered,
  featureId,
  fixtureText,
} from './helpers/world.js';

const RING = 'A620 Toulouse · intérieur';
// A house next to the northern part of the Toulouse ring road (not an address).
const TOULOUSE_HOUSE = {
  id: 'h1',
  name: 'Maison',
  selector: 'maison',
  latitude: 43.6396,
  longitude: 1.4213,
};
const DIR = { cities: ['dir'], roads: 'A620' };

/** Changes the speed of the measures served for some points, as a new publication. */
function setDir(world, ids, speed) {
  for (const record of world.network.data.dir.live) {
    if (ids.has(record.id)) {
      record.speed = speed;
    }
  }
  world.network.data.dir.modified = new Date(world.clock.now()).toUTCString();
}

/** The ids of the points of a road, from the catalog the service read. */
const pointIds = (world, deviceId) => new Set(world.service.lookup(deviceId).axis.ids);

test('the reference file: rows one field short of the header are read without code_insee_commune', () => {
  const rows = parseDirCsv(fixtureText('dir-ref.csv'));
  const ring = rows.find((r) => r.code_pme === 'MB631.B8');
  assert.equal(ring.axe, 'A620');
  assert.equal(ring.source_2, '733131555');
  assert.equal(ring.code_insee_commune, undefined);
  assert.equal(ring.sens_giratoire, 'INTERIEUR');
  assert.equal(ring.longueur, '834');
  assert.equal(ring.code_traficolor, 'TO31');
  const full = parseDirCsv('a;code_insee_commune;b\n1;31555;2\n');
  assert.deepEqual(full, [{ a: '1', code_insee_commune: '31555', b: '2' }]);
});

test('road numbers, directions and départements of the national roads', () => {
  assert.equal(dirRoad('N0136'), 'N136');
  assert.equal(dirRoad('A620'), 'A620');
  assert.equal(dirRoad(' a0811 '), 'A811');
  assert.equal(dirRoad('M7'), 'M7');
  // The ring of a ring road first, then the cardinal direction, then the operator's.
  assert.equal(dirDirection({ sens_giratoire: 'INTERIEUR', sens_cardinal: 'NORD_SUD' }), 'int');
  assert.equal(dirDirection({ sens_cardinal: 'OUEST_EST', sens_gestionnaire: '1' }), 'w-e');
  assert.equal(dirDirection({ sens_gestionnaire: '2' }), 's2');
  assert.equal(dirDirection({}), null);
  assert.equal(dirDepartment({ source_2: '733131555' }), '31');
  assert.equal(dirDepartment({ source_2: '', pr_debut: '76PR91D' }), '76');
  assert.equal(dirDepartment({ source_2: '', pr_debut: '17' }), null);
});

test('Lambert-93 to latitude and longitude', () => {
  // The IGN reference point of the projection: 3°E, 46.5°N.
  const origin = lambert93ToWgs84(700000, 6600000);
  assert.ok(Math.abs(origin.lat - 46.5) < 1e-6 && Math.abs(origin.lon - 3) < 1e-6, origin);
  // Toulouse, place du Capitole: 574,500 / 6,279,500 within a few hundred metres.
  const capitole = lambert93ToWgs84(574500, 6279500);
  assert.ok(Math.abs(capitole.lat - 43.6045) < 0.01, capitole);
  assert.ok(Math.abs(capitole.lon - 1.4442) < 0.01, capitole);
});

test('the catalog: one road per number, département and direction, named in four languages', () => {
  const segments = dirCatalog(parseDirCsv(fixtureText('dir-ref.csv')));
  const ring = segments.filter((s) => s.axisKey === 'a620-31-int');
  assert.equal(ring.length, 22);
  assert.deepEqual(ring[0].axisNames, {
    en: 'A620 Toulouse · inner ring',
    fr: 'A620 Toulouse · intérieur',
    de: 'A620 Toulouse · Innenring',
    es: 'A620 Toulouse · anillo interior',
  });
  assert.equal(ring[0].axisName, RING);
  // Without a traffic area, the département; without coordinates, no position.
  const rennes = segments.find((s) => s.id === 'MWJ35.F1');
  assert.equal(rennes.axisKey, 'n136-35-s1');
  assert.equal(rennes.axisName, 'N136 (35) · sens 1');
  assert.equal(rennes.lat, null);
  // The search is the road and its place, not the direction words.
  assert.equal(ring[0].search, 'A620 Toulouse');
  // A point without a road is no road.
  assert.equal(
    segments.find((s) => s.id === 'A0027010102'),
    undefined,
  );
});

test('the same road, area and direction in two départements: the département in the name', () => {
  const row = (code_pme, source_2) => ({
    code_pme,
    source_2,
    axe: 'A47',
    sens_cardinal: 'OUEST_EST',
    code_traficolor: 'ST42',
  });
  const segments = dirCatalog([row('P1', '734242218'), row('P2', '736969199')]);
  assert.deepEqual(
    segments.map((s) => [s.axisKey, s.axisName]),
    [
      ['a47-42-w-e', "A47 Saint-Étienne (42) · vers l'est"],
      ['a47-69-w-e', "A47 Saint-Étienne (69) · vers l'est"],
    ],
  );
  assert.equal(dirCatalog([row('P1', '734242218')])[0].axisName, "A47 Saint-Étienne · vers l'est");
});

test('the status of a point is deduced from its speed; 0 km/h is no measure', () => {
  assert.equal(dirStatus(60), STATUS.FREE);
  assert.equal(dirStatus(59.9), STATUS.HEAVY);
  assert.equal(dirStatus(30), STATUS.HEAVY);
  assert.equal(dirStatus(29.9), STATUS.CONGESTED);
  assert.equal(dirStatus(0), STATUS.UNKNOWN);
  assert.equal(dirStatus(132.9), STATUS.FREE);
  // The sentinel of the feed (seen on 2026-10-29).
  assert.equal(dirStatus(9999999), STATUS.UNKNOWN);
  assert.equal(dirStatus(null), STATUS.UNKNOWN);
});

test('the measure file is parsed piece by piece, only the points wanted kept', () => {
  const xml = fixtureText('dir-live.xml');
  const whole = new DirMeasureParser(
    new Set(['MB631.B8', 'MB631.A7']),
    new Map([['MB631.B8', 834]]),
  );
  whole.push(xml);
  const pieces = new DirMeasureParser(
    new Set(['MB631.B8', 'MB631.A7']),
    new Map([['MB631.B8', 834]]),
  );
  for (let i = 0; i < xml.length; i += 7) {
    pieces.push(xml.slice(i, i + 7));
  }
  assert.equal(whole.blocks, 101);
  assert.deepEqual([...pieces.measures], [...whole.measures]);
  assert.deepEqual(whole.measures.get('MB631.B8'), {
    status: STATUS.HEAVY,
    speed: 55.8,
    time: null,
    usual: null,
    length: 834,
    at: Date.parse('2026-10-29T17:06:00+01:00'),
  });
  assert.equal(whole.measures.size, 2);
  const junk = new DirMeasureParser(new Set());
  assert.throws(() => junk.push('x'.repeat(1e6 + 1)), /not a DATEX II/);
});

test('the measure file is read again only when republished (If-Modified-Since)', async () => {
  const { fetch, calls, data } = createFetch();
  const state = {};
  await SOURCES.dir.catalog(fetch, state);
  const first = await SOURCES.dir.live(fetch, ['MB631.B8'], state);
  assert.equal(first.get('MB631.B8').length, 834);
  const again = await SOURCES.dir.live(fetch, ['MB631.B8'], state);
  assert.equal(again, first);
  assert.equal(calls.at(-1).headers['if-modified-since'], data.dir.modified);
  // Other points wanted: the file is read whole again.
  const other = await SOURCES.dir.live(fetch, ['MB631.B8', 'MB631.A7'], state);
  assert.equal(other.size, 2);
  assert.equal(calls.at(-1).headers['if-modified-since'], undefined);
  // A file without any measure is a failure, not a road without traffic.
  data.dir.live = [];
  data.dir.modified = 'Thu, 29 Oct 2026 11:03:00 GMT';
  await assert.rejects(SOURCES.dir.live(fetch, ['MB631.B8'], state), /no measure/);
});

test('Toulouse ring road: offered by number, added, all its states published', async (t) => {
  const world = await createWorld({ config: DIR });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => d.name),
    [
      'Routes nationales (DIR) · A620 Toulouse · extérieur',
      'Routes nationales (DIR) · A620 Toulouse · intérieur',
      'Routes nationales (DIR) · A620 Toulouse · vers le nord',
      'Routes nationales (DIR) · A620 Toulouse · vers le sud',
    ],
  );
  const device = await create(world, RING);
  assert.equal(device.external_id, 'ext:test-integration:axis:dir-a620-31-int');
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['status', 'level', 'speed', 'age'],
  );
  const last = (key) => world.fake.lastState(featureId(device, key));
  assert.equal(last('status'), 'Fluide');
  assert.equal(last('level'), 1);
  assert.equal(last('speed'), 72);
  assert.equal(last('age'), 4);
  // Only the Bison Futé files were read: no city portal.
  assert.ok(world.network.calls.every((call) => call.url.includes('tipi.bison-fute.gouv.fr')));
});

test('the device names follow the configured language', async (t) => {
  const world = await createWorld({ config: { ...DIR, language: 'de' } });
  t.after(() => world.app.stop());
  assert.ok(discovered(world, 'A620 Toulouse · Innenring'));
});

test('Toulouse ring road: jam and clear triggers from the speeds, read twice in a row', async (t) => {
  const world = await createWorld({ config: DIR });
  t.after(() => world.app.stop());
  const device = await create(world, RING);
  const ids = pointIds(world, device.external_id);
  setDir(world, ids, '42.0');
  await cycle(world);
  await cycle(world);
  setDir(world, ids, '12.5');
  await cycle(world);
  await cycle(world);
  setDir(world, ids, '85.0');
  await cycle(world);
  await cycle(world);
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.level ?? null, e.data.status, e.data.speed]),
    [
      [TRIGGERS.JAM, 'heavy', 'Dense', 42],
      [TRIGGERS.JAM, 'congested', 'Saturé', 13],
      [TRIGGERS.CLEAR, null, 'Fluide', 85],
    ],
  );
  assert.equal(world.fake.sceneEvents[0].data.city, 'Routes nationales (DIR)');
});

test('a publication not renewed for 30 minutes: the road turns unknown', async (t) => {
  const world = await createWorld({ config: DIR });
  t.after(() => world.app.stop());
  const device = await create(world, RING);
  await cycle(world, 31 * 60);
  assert.equal(world.fake.lastState(featureId(device, 'level')), STATUS.UNKNOWN);
  assert.equal(world.fake.lastState(featureId(device, 'age')), 35);
});

test('around a house in Toulouse: the nearest points of the national roads', async (t) => {
  const world = await createWorld({ config: { cities: ['dir'] }, houses: [TOULOUSE_HOUSE] });
  t.after(() => world.app.stop());
  const home = await create(world, 'Routes nationales (DIR) · Autour de la maison');
  assert.equal(home.external_id, 'ext:test-integration:axis:dir-home');
  assert.equal(pointIds(world, home.external_id).size, 8);
  assert.equal(world.fake.lastState(featureId(home, 'level')), STATUS.HEAVY);
});

test('the national roads unreachable: said once, the other cities unaffected', async (t) => {
  const network = createFetch();
  network.down.add('dir');
  const world = await createWorld({
    config: { cities: ['rennes', 'dir'], roads: 'Route nationale 136, A620' },
    network,
  });
  t.after(() => world.app.stop());
  assert.ok(discovered(world, 'Route nationale 136'));
  assert.equal(discovered(world, 'A620'), undefined);
  const report = await action(world, 'status');
  assert.match(report.fr, /Routes nationales \(DIR\) : 0 axe connu/);
  assert.match(report.fr, /tipi\.bison-fute\.gouv\.fr: fetch failed/);
});
