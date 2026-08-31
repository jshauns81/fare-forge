import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.FARE_FORGE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'fare-forge-test-'));

const { getPlan, listRecipes, setPlanEntry } = await import('../lib/db.js');
const { buildMarketList } = await import('../lib/ingredients.js');

const WEEK = '2026-08-31';

// Mirror of the Market List page: only recipe entries contribute ingredients.
function marketEntriesFor(weekStart) {
  const entries = [];
  for (const p of getPlan(weekStart).filter((p) => p.recipe)) {
    for (const ing of p.recipe.ingredients) entries.push({ raw: ing.raw, recipeTitle: p.recipe.title });
  }
  return entries;
}

test('a plain-label meal round-trips without a recipe', () => {
  setPlanEntry({ weekStart: WEEK, day: 4, recipeId: null, note: 'Hamburgers' });

  const friday = getPlan(WEEK).find((p) => p.day === 4);
  assert.equal(friday.kind, 'note');
  assert.equal(friday.note, 'Hamburgers');
  assert.equal(friday.recipe, null);
});

test('a plain meal adds nothing to the market list', () => {
  assert.deepEqual(buildMarketList(marketEntriesFor(WEEK)), []);
});

test('a plain meal can be relabeled and replaced by a recipe', () => {
  setPlanEntry({ weekStart: WEEK, day: 4, recipeId: null, note: 'Burgers & Fries' });
  assert.equal(getPlan(WEEK).find((p) => p.day === 4).note, 'Burgers & Fries');

  const recipe = listRecipes()[0]; // starter seed
  setPlanEntry({ weekStart: WEEK, day: 4, recipeId: recipe.id, note: null });
  const friday = getPlan(WEEK).find((p) => p.day === 4);
  assert.equal(friday.kind, 'recipe');
  assert.equal(friday.recipe.id, recipe.id);
  assert.equal(getPlan(WEEK).filter((p) => p.day === 4).length, 1, 'still one entry for the day');

  // ...and back to a plain label, which drops the recipe ingredients again.
  setPlanEntry({ weekStart: WEEK, day: 4, recipeId: null, note: 'Eat Out' });
  assert.equal(getPlan(WEEK).find((p) => p.day === 4).recipe, null);
  assert.deepEqual(buildMarketList(marketEntriesFor(WEEK)), []);
});
