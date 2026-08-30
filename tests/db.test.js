import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.FARE_FORGE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'fare-forge-test-'));

const { addExtra, deleteRecipe, getDb, getExtras, listRecipes } = await import('../lib/db.js');

test('starters seed exactly once, even after the user deletes them all', () => {
  getDb();
  const starters = listRecipes();
  assert.equal(starters.length, 3);

  for (const r of starters) deleteRecipe(r.id);
  assert.equal(listRecipes().length, 0);

  // Simulate a process restart: drop the cached connection and reopen.
  globalThis.__fareForgeDb = undefined;
  getDb();
  assert.equal(listRecipes().length, 0, 'deleted starters must not come back');
});

test('market extras are plain objects that server components can render', () => {
  const added = addExtra('2026-08-24', 'paper towels');
  const extras = getExtras('2026-08-24');

  assert.deepEqual(extras, [added]);
  assert.equal(Object.getPrototypeOf(extras[0]), Object.prototype);
});
