import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketList, classifyAisle, parseIngredient, scaledQtyText } from '../lib/ingredients.js';

test('parses quantity, unit, item, and note', () => {
  const p = parseIngredient('2 lb chicken thighs, bone-in');
  assert.equal(p.qty, 2);
  assert.equal(p.unit, 'lb');
  assert.equal(p.item, 'chicken thighs');
  assert.equal(p.note, 'bone-in');
});

test('parses unicode and compound fractions', () => {
  assert.equal(parseIngredient('½ tsp black pepper').qty, 0.5);
  assert.equal(parseIngredient('1 1/2 cups red lentils, rinsed').qty, 1.5);
  assert.equal(parseIngredient('1½ cups flour').qty, 1.5);
  assert.equal(parseIngredient('⅓ cup honey').qty, 1 / 3);
});

test('parses container sizes and articles', () => {
  const can = parseIngredient('1 can (14 oz) coconut milk');
  assert.equal(can.unit, 'can');
  assert.equal(can.item, 'coconut milk');
  assert.match(can.note, /14 oz/);

  const pinch = parseIngredient('a pinch of flaky salt');
  assert.equal(pinch.qty, 1);
  assert.equal(pinch.unit, 'pinch');
  assert.equal(pinch.item, 'flaky salt');
});

test('recognizes two-token volume units', () => {
  const p = parseIngredient('8 fl oz milk');
  assert.equal(p.unit, 'fl oz');
  assert.equal(p.item, 'milk');

  const groups = buildMarketList([
    { raw: '8 fl oz milk', recipeTitle: 'A' },
    { raw: '1 cup milk', recipeTitle: 'B' },
  ]);
  const milk = groups.flatMap((g) => g.items).find((i) => i.item === 'milk');
  assert.equal(milk.qty, '2 cups'); // 8 fl oz + 1 cup, volume-merged

  assert.equal(parseIngredient('2 fluid ounces cream').unit, 'fl oz');
});

test('ranges shop for the upper bound', () => {
  assert.equal(parseIngredient('1-2 jalapeños, sliced').qty, 2);
  assert.equal(parseIngredient('2 to 3 tbsp olive oil').qty, 3);
});

test('to-taste lines keep the item', () => {
  const p = parseIngredient('kosher salt to taste');
  assert.equal(p.item, 'kosher salt');
  assert.match(p.note, /to taste/);
});

test('classifies aisles sensibly', () => {
  assert.equal(classifyAisle('chicken thighs'), 'meat & fish');
  assert.equal(classifyAisle('smoked paprika'), 'spice rail');
  assert.equal(classifyAisle('baby yellow potatoes'), 'produce');
  assert.equal(classifyAisle('corn tortillas'), 'bakery');
  assert.equal(classifyAisle('butter'), 'dairy & eggs');
  assert.equal(classifyAisle('crushed tomatoes'), 'pantry');
  assert.equal(classifyAisle('green beans'), 'produce');
  assert.equal(classifyAisle('jasmine rice'), 'pantry');
});

test('merges duplicates across recipes, unit-aware', () => {
  const groups = buildMarketList([
    { raw: '2 tbsp butter', recipeTitle: 'A' },
    { raw: '4 tbsp butter', recipeTitle: 'B' },
    { raw: '2 lemons', recipeTitle: 'A' },
    { raw: '4 lemons, juiced', recipeTitle: 'C' },
    { raw: '1 lb ground beef', recipeTitle: 'B' },
    { raw: '8 oz ground beef', recipeTitle: 'C' },
  ]);
  const flat = groups.flatMap((g) => g.items);

  const butter = flat.find((i) => i.item === 'butter');
  assert.equal(butter.qty, '6 tbsp');
  assert.deepEqual(butter.sources.sort(), ['A', 'B']);

  const lemons = flat.find((i) => i.item === 'lemons');
  assert.equal(lemons.qty, '6');
  assert.equal(lemons.aisle, 'produce');

  const beef = flat.find((i) => i.item === 'ground beef');
  assert.equal(beef.qty, '1½ lb');
});

test('incompatible unit families are listed side by side', () => {
  const groups = buildMarketList([
    { raw: '2 cloves garlic', recipeTitle: 'A' },
    { raw: '1 head garlic', recipeTitle: 'B' },
  ]);
  const garlic = groups.flatMap((g) => g.items).find((i) => i.item === 'garlic');
  assert.match(garlic.qty, /2 cloves/);
  assert.match(garlic.qty, /1 head/);
  assert.match(garlic.qty, / \+ /);
});

test('scaling re-renders quantities in sensible units', () => {
  const oil = parseIngredient('1/4 cup olive oil');
  assert.equal(scaledQtyText(oil, 1), '¼ cup'); // unscaled keeps the written form
  assert.equal(scaledQtyText(oil, 2), '½ cup');
  assert.equal(scaledQtyText(oil, 1.5), '6 tbsp');

  const cloves = parseIngredient('2 cloves garlic');
  assert.equal(scaledQtyText(cloves, 1.5), '3 cloves');
});
