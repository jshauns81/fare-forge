import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.FARE_FORGE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'fare-forge-test-'));

const { getDb, listRecipes, deleteRecipe } = await import('../lib/db.js');

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
