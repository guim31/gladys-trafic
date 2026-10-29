// -----------------------------------------------------------------------------
// The adapters of the four portals and the aggregation of a road, on the real
// answers captured on 2026-10-29 and on hand-made edge cases.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, STALE_MS } from '../src/devices.js';
import { normalizeConfig, termsOf } from '../src/config.js';
import {
  IDS_PER_REQUEST,
  SOURCES,
  STATUS,
  bordeauxStatus,
  nantesAxis,
  rennesAxis,
  strasbourgAxis,
} from '../src/sources.js';
import { FIXTURE_TIME, createFetch } from './helpers/world.js';

test('Rennes: national roads cross communes, streets are one road per commune', () => {
  assert.deepEqual(rennesAxis('Route nationale 136', 35238), {
    axisKey: 'route-nationale-136',
    axisName: 'Route nationale 136',
  });
  assert.deepEqual(rennesAxis('Rue de Rennes', 35024), {
    axisKey: 'rue-de-rennes-35024',
    axisName: 'Rue de Rennes (Betton)',
  });
  assert.equal(rennesAxis('Rond-point', 35238), null);
  assert.equal(rennesAxis('Inconnu Voie non dénommée', 35238), null);
  assert.equal(rennesAxis('', 35238), null);
});

test('Nantes and Strasbourg: the direction codes and sensor numbers are not part of the road', () => {
  assert.equal(nantesAxis('Anglais I5'), 'Anglais');
  assert.equal(nantesAxis('Briand (R) P1'), 'Briand (R)');
  assert.equal(nantesAxis('Haroun Tazieff'), 'Haroun Tazieff');
  assert.equal(strasbourgAxis('Schirmeck12 - Sortie Ville'), 'Schirmeck - Sortie Ville');
  assert.equal(strasbourgAxis('Montagne-Verte3 -> Nord'), 'Montagne-Verte -> Nord');
  assert.equal(strasbourgAxis('Boecklin 1283-1282'), 'Boecklin 1283-1282');
});

test('Bordeaux: the status is the ratio of the travel time to its usual value', () => {
  assert.equal(bordeauxStatus(130, 100), STATUS.FREE);
  assert.equal(bordeauxStatus(131, 100), STATUS.HEAVY);
  assert.equal(bordeauxStatus(180, 100), STATUS.HEAVY);
  assert.equal(bordeauxStatus(181, 100), STATUS.CONGESTED);
  assert.equal(bordeauxStatus(null, 100), STATUS.UNKNOWN);
});

test('every catalog of the fixtures reads, with positions except for Bordeaux and some national road points', async () => {
  const { fetch } = createFetch();
  for (const [key, source] of Object.entries(SOURCES)) {
    const segments = await source.catalog(fetch);
    assert.ok(segments.length >= 16, key);
    for (const segment of segments) {
      assert.match(segment.axisKey, /^[a-z0-9-]+$/, `${key}: ${segment.axisKey}`);
      assert.ok(segment.axisName, key);
      // Some points of the national roads have no coordinates in their reference file.
      if (key !== 'bordeaux' && !(key === 'dir' && segment.id.startsWith('MWJ35'))) {
        assert.ok(Number.isFinite(segment.lat) && Number.isFinite(segment.lon), key);
      }
    }
  }
});

test('the live measures: statuses, speeds, lengths and dates of each portal', async () => {
  const { fetch, calls } = createFetch();
  const rennes = await SOURCES.rennes.live(fetch, ['10273_D']);
  assert.deepEqual(rennes.get('10273_D'), {
    status: STATUS.FREE,
    speed: 60,
    time: 12,
    usual: null,
    length: 200,
    at: Date.parse('2026-10-29T11:54:00+01:00'),
  });
  const nantes = await SOURCES.nantes.live(fetch, [5043]);
  assert.equal(nantes.get(5043).length, 207);
  const strasbourg = await SOURCES.strasbourg.live(fetch, [18]);
  assert.equal(strasbourg.get(18).at, Date.parse('2026-10-29T10:54:30+00:00'));
  const bordeaux = await SOURCES.bordeaux.live(fetch, [33]);
  assert.deepEqual([...bordeaux.keys()], [33]);
  assert.equal(bordeaux.get(33).time, 360);
  // Every live request names the fields and the ids it wants.
  for (const call of calls.slice(0, 3)) {
    const url = new URL(call.url);
    assert.ok(url.searchParams.get('select'));
    assert.match(url.searchParams.get('where'), / in \(/);
  }
});

test('the ids are sent by groups of a hundred, quoted when they are texts', async () => {
  const { fetch, calls } = createFetch();
  const ids = Array.from({ length: 2 * IDS_PER_REQUEST + 1 }, (_, i) => `${i}_D`);
  await SOURCES.rennes.live(fetch, ids);
  assert.equal(calls.length, 3);
  assert.match(new URL(calls[0].url).searchParams.get('where'), /in \("0_D","1_D",/);
  await SOURCES.nantes.live(fetch, [1, 2]);
  assert.equal(new URL(calls[3].url).searchParams.get('where'), 'cha_id in (1,2)');
});

test('aggregate: weighted by length, only recent measures, unknown without any', () => {
  const now = FIXTURE_TIME;
  const m = (status, speed, time, length, at = now) => ({
    status,
    speed,
    time,
    usual: null,
    length,
    at,
  });
  // 1 km heavy over 3 km: a third of the length, heavy.
  const road = [m(1, 90, 80, 2000), m(2, 36, 100, 1000)];
  assert.deepEqual(aggregate(road, now), {
    level: STATUS.HEAVY,
    speed: 60, // 3 km in 180 s
    time: 180,
    usual: null,
    at: now,
  });
  // A short congested segment does not make the road congested.
  assert.equal(aggregate([m(1, 90, 400, 10000), m(3, 10, 36, 100)], now).level, STATUS.FREE);
  // Old measures and unknown statuses do not count.
  const old = now - STALE_MS - 1;
  assert.deepEqual(aggregate([m(3, 10, 36, 100, old), m(0, null, null, null)], now), {
    level: STATUS.UNKNOWN,
    speed: null,
    time: null,
    usual: null,
    at: now,
  });
  assert.equal(aggregate([undefined], now).at, null);
  // Without lengths (Strasbourg): one vote per segment, the mean speed.
  const noLength = [m(1, 30, null, null), m(1, 50, null, null), m(2, 10, null, null)];
  assert.deepEqual(aggregate(noLength, now).speed, 30);
  assert.equal(aggregate(noLength, now).level, STATUS.HEAVY);
});

test('configuration: search terms, radius and pace fall back on the defaults', () => {
  assert.deepEqual(termsOf('Rocade, Fougères;  ru ,rocade'), ['rocade', 'fougeres']);
  assert.deepEqual(normalizeConfig({}), {
    cities: [],
    terms: [],
    homeRadius: 1000,
    language: 'fr',
    refreshSeconds: 180,
  });
  assert.deepEqual(
    normalizeConfig({
      cities: '["nantes","paris"]',
      home_radius: '0',
      refresh_interval: '7',
      language: 'it',
    }),
    { cities: ['nantes'], terms: [], homeRadius: 0, language: 'fr', refreshSeconds: 180 },
  );
});
