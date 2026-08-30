import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';

process.env.FARE_FORGE_ALLOW_LOCAL = '1';

const { forgeFromUrl, forgeFromText, ForgeError, parseISODuration, parseYield } = await import('../lib/extract.js');

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const read = (name) => readFileSync(path.join(FIXTURES, name), 'utf8');

let server;
let base;

test.before(async () => {
  server = http.createServer((req, res) => {
    const routes = {
      '/blog': 'jsonld-blog.html',
      '/microdata': 'microdata.html',
      '/wprm': 'wprm.html',
      '/none': 'no-recipe.html',
    };
    if (req.url === '/pin') {
      const outbound = `${base}/blog`.replace(/\//g, '\\/');
      res.setHeader('content-type', 'text/html');
      res.end(read('pinterest-pin.html').replace('__OUTBOUND__', outbound));
      return;
    }
    if (req.url === '/hop1') {
      res.statusCode = 302;
      res.setHeader('location', '/redirect');
      res.end();
      return;
    }
    if (req.url === '/redirect') {
      res.statusCode = 301;
      res.setHeader('location', `${base}/blog`);
      res.end();
      return;
    }
    if (req.url === '/loop') {
      res.statusCode = 302;
      res.setHeader('location', '/loop');
      res.end();
      return;
    }
    const file = routes[req.url];
    if (!file) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(read(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('forges a JSON-LD blog page down to the recipe', async () => {
  const { recipe, report } = await forgeFromUrl(`${base}/blog`);
  assert.equal(recipe.title, 'Crispy Honey-Garlic Chicken Thighs');
  assert.equal(recipe.ingredients.length, 8);
  assert.equal(recipe.steps.length, 5); // HowToSection flattened
  assert.equal(recipe.servings, 4);
  assert.equal(recipe.prepMin, 10);
  assert.equal(recipe.cookMin, 35);
  assert.equal(recipe.totalMin, 45);
  assert.equal(recipe.imageUrl, 'https://img.example.com/honey-garlic.jpg');
  assert.equal(recipe.sourceSite, 'My Cozy Test Kitchen');
  assert.ok(recipe.strip.trimmedPct >= 50, `expected a heavy trim, got ${recipe.strip.trimmedPct}%`);
  assert.ok(recipe.strip.removedWords > 200);
  assert.ok(report.some((line) => line.includes('JSON-LD')));
  assert.ok(recipe.tags.includes('chicken'));
});

test('falls back to microdata', async () => {
  const { recipe } = await forgeFromUrl(`${base}/microdata`);
  assert.equal(recipe.title, 'One-Pot Coconut Lentil Curry');
  assert.equal(recipe.ingredients.length, 7);
  assert.equal(recipe.steps.length, 4);
  assert.equal(recipe.servings, 6);
  assert.equal(recipe.prepMin, 15);
});

test('falls back to recipe-plugin markup', async () => {
  const { recipe, report } = await forgeFromUrl(`${base}/wprm`);
  assert.match(recipe.title, /Back-Pocket Marinara/);
  assert.equal(recipe.ingredients.length, 4);
  assert.equal(recipe.steps.length, 3);
  assert.ok(report.some((line) => line.includes('plugin')));
});

test('follows a Pinterest pin to its source page', async () => {
  const { recipe, report, hops } = await forgeFromUrl(`${base}/pin`);
  assert.equal(hops, 1);
  assert.ok(report[0].startsWith('Followed the pin'), report[0]);
  assert.equal(recipe.title, 'Crispy Honey-Garlic Chicken Thighs');
});

test('follows redirects hop by hop (relative and absolute)', async () => {
  const { recipe } = await forgeFromUrl(`${base}/hop1`);
  assert.equal(recipe.title, 'Crispy Honey-Garlic Chicken Thighs');
});

test('gives up on a redirect loop', async () => {
  await assert.rejects(
    () => forgeFromUrl(`${base}/loop`),
    (err) => err instanceof ForgeError && /redirected too many times/.test(err.message),
  );
});

test('says so clearly when a page has no recipe', async () => {
  await assert.rejects(
    () => forgeFromUrl(`${base}/none`),
    (err) => err instanceof ForgeError && /No recipe found/.test(err.message),
  );
});

test('forges pasted text with section headers', () => {
  const { recipe } = forgeFromText(
    [
      'Granny Smith Apple Crisp',
      'The one from the stained index card.',
      '',
      'Ingredients',
      '6 Granny Smith apples, peeled and sliced',
      '1 cup rolled oats',
      '½ cup brown sugar',
      '6 tbsp butter, cold',
      '1 tsp cinnamon',
      '',
      'Instructions',
      'Heat the oven to 350°F and butter a baking dish.',
      'Toss the apples with half the sugar and pile them in.',
      'Rub the oats, remaining sugar, cinnamon, and butter into clumps; scatter over the apples.',
      'Bake 45 minutes until bubbling at the edges.',
    ].join('\n'),
  );
  assert.equal(recipe.title, 'Granny Smith Apple Crisp');
  assert.equal(recipe.ingredients.length, 5);
  assert.equal(recipe.steps.length, 4);
});

test('sorts headerless pasted text by line shape', () => {
  const { recipe } = forgeFromText(
    [
      'Tuesday Quesadillas',
      '8 flour tortillas',
      '2 cups shredded cheddar',
      '1 cup leftover chicken',
      'Lay a tortilla in a dry hot pan, scatter cheese and chicken over half.',
      'Fold, press, and flip until both sides are freckled and the cheese runs.',
    ].join('\n'),
  );
  assert.equal(recipe.title, 'Tuesday Quesadillas');
  assert.equal(recipe.ingredients.length, 3);
  assert.equal(recipe.steps.length, 2);
});

test('rejects text with no discernible recipe', () => {
  assert.throws(
    () => forgeFromText('Just one line of nothing much at all here.'),
    (err) => err instanceof ForgeError,
  );
});

test('duration and yield parsing', () => {
  assert.equal(parseISODuration('PT1H20M'), 80);
  assert.equal(parseISODuration('PT45S'), 1);
  assert.equal(parseISODuration('35 minutes'), 35);
  assert.equal(parseISODuration('2 hrs'), 120);
  assert.equal(parseYield(['4', '4 servings']), 4);
  assert.equal(parseYield('Serves 6'), 6);
  assert.equal(parseYield({ value: 8 }), 8);
});
