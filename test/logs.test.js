// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a portal lost and back), never one line per reading; a failure
// that repeats at every cycle is logged once, plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, create, createWorld, cycle } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), [
    '[INFO] [trafic] Started: 1 city(ies) chosen, 0 road(s) added',
  ]);
});

test('a normal reading cycle writes nothing at info, one line at debug', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, 'Route nationale 136');
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 5; i += 1) {
    await cycle(world);
  }
  assert.deepEqual(lines, []);
  const debug = captureLogs(t, 'debug');
  await cycle(world);
  assert.deepEqual(debug.map(strip), ['[DEBUG] [trafic] Rennes Métropole: 146 segments read']);
});

test('a portal down at every cycle: one warning, then one line at recovery', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, 'Route nationale 136');
  const lines = captureLogs(t, 'info');
  world.network.down.add('rennes');
  for (let i = 0; i < 4; i += 1) {
    await cycle(world);
  }
  world.network.down.delete('rennes');
  await cycle(world);
  assert.deepEqual(lines.map(strip), [
    '[WARN] [trafic] Rennes Métropole: data unavailable: data.rennesmetropole.fr: fetch failed',
    '[INFO] [trafic] Rennes Métropole: data back',
  ]);
});
