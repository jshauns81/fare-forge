import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DB_DIR = process.env.FARE_FORGE_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'fareforge.db');

function open() {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_url TEXT,
      source_site TEXT,
      image_url TEXT,
      servings INTEGER,
      prep_min INTEGER,
      cook_min INTEGER,
      total_min INTEGER,
      ingredients_json TEXT NOT NULL DEFAULT '[]',
      steps_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      strip_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
      kind TEXT NOT NULL DEFAULT 'recipe',
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
      note TEXT,
      UNIQUE (week_start, day)
    );
    CREATE TABLE IF NOT EXISTS market_checks (
      week_start TEXT NOT NULL,
      item_key TEXT NOT NULL,
      PRIMARY KEY (week_start, item_key)
    );
    CREATE TABLE IF NOT EXISTS market_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      label TEXT NOT NULL
    );
  `);
  return db;
}

// Next.js dev reloads modules; keep one connection per process.
export function getDb() {
  if (!globalThis.__fareForgeDb) {
    globalThis.__fareForgeDb = open();
    seedIfEmpty(globalThis.__fareForgeDb);
  }
  return globalThis.__fareForgeDb;
}

function rowToRecipe(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    sourceSite: row.source_site,
    imageUrl: row.image_url,
    servings: row.servings,
    prepMin: row.prep_min,
    cookMin: row.cook_min,
    totalMin: row.total_min,
    ingredients: JSON.parse(row.ingredients_json),
    steps: JSON.parse(row.steps_json),
    tags: JSON.parse(row.tags_json),
    strip: row.strip_json ? JSON.parse(row.strip_json) : null,
    createdAt: row.created_at,
  };
}

export function listRecipes() {
  const db = getDb();
  return db.prepare('SELECT * FROM recipes ORDER BY created_at DESC, id DESC').all().map(rowToRecipe);
}

export function getRecipe(id) {
  const db = getDb();
  return rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(Number(id)));
}

export function insertRecipe(r) {
  const db = getDb();
  const res = db.prepare(`
    INSERT INTO recipes (title, source_url, source_site, image_url, servings, prep_min, cook_min, total_min, ingredients_json, steps_json, tags_json, strip_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    r.title,
    r.sourceUrl ?? null,
    r.sourceSite ?? null,
    r.imageUrl ?? null,
    r.servings ?? null,
    r.prepMin ?? null,
    r.cookMin ?? null,
    r.totalMin ?? null,
    JSON.stringify(r.ingredients ?? []),
    JSON.stringify(r.steps ?? []),
    JSON.stringify(r.tags ?? []),
    r.strip ? JSON.stringify(r.strip) : null,
  );
  return getRecipe(res.lastInsertRowid);
}

export function deleteRecipe(id) {
  getDb().prepare('DELETE FROM recipes WHERE id = ?').run(Number(id));
}

export function getPlan(weekStart) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.id AS plan_id, p.week_start, p.day, p.kind, p.note, r.*
    FROM plan_entries p LEFT JOIN recipes r ON r.id = p.recipe_id
    WHERE p.week_start = ? ORDER BY p.day
  `).all(weekStart);
  return rows.map((row) => ({
    planId: row.plan_id,
    weekStart: row.week_start,
    day: row.day,
    kind: row.kind,
    note: row.note,
    recipe: row.id ? rowToRecipe(row) : null,
  }));
}

export function setPlanEntry({ weekStart, day, recipeId, note }) {
  const db = getDb();
  const kind = recipeId ? 'recipe' : 'note';
  db.prepare(`
    INSERT INTO plan_entries (week_start, day, kind, recipe_id, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (week_start, day) DO UPDATE SET kind = excluded.kind, recipe_id = excluded.recipe_id, note = excluded.note
  `).run(weekStart, day, kind, recipeId ?? null, note ?? null);
}

export function clearPlanEntry(weekStart, day) {
  getDb().prepare('DELETE FROM plan_entries WHERE week_start = ? AND day = ?').run(weekStart, day);
}

export function copyPlan(fromWeek, toWeek) {
  const db = getDb();
  const rows = db.prepare('SELECT day, kind, recipe_id, note FROM plan_entries WHERE week_start = ?').all(fromWeek);
  const upsert = db.prepare(`
    INSERT INTO plan_entries (week_start, day, kind, recipe_id, note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (week_start, day) DO UPDATE SET kind = excluded.kind, recipe_id = excluded.recipe_id, note = excluded.note
  `);
  for (const row of rows) upsert.run(toWeek, row.day, row.kind, row.recipe_id, row.note);
  return rows.length;
}

export function getChecks(weekStart) {
  return getDb().prepare('SELECT item_key FROM market_checks WHERE week_start = ?').all(weekStart).map((r) => r.item_key);
}

export function setCheck(weekStart, itemKey, checked) {
  const db = getDb();
  if (checked) {
    db.prepare('INSERT OR IGNORE INTO market_checks (week_start, item_key) VALUES (?, ?)').run(weekStart, itemKey);
  } else {
    db.prepare('DELETE FROM market_checks WHERE week_start = ? AND item_key = ?').run(weekStart, itemKey);
  }
}

export function getExtras(weekStart) {
  return getDb().prepare('SELECT id, label FROM market_extras WHERE week_start = ? ORDER BY id').all(weekStart);
}

export function addExtra(weekStart, label) {
  const res = getDb().prepare('INSERT INTO market_extras (week_start, label) VALUES (?, ?)').run(weekStart, label);
  return { id: res.lastInsertRowid, label };
}

export function removeExtra(id) {
  getDb().prepare('DELETE FROM market_extras WHERE id = ?').run(Number(id));
}

export function countRecipes() {
  return getDb().prepare('SELECT COUNT(*) AS n FROM recipes').get().n;
}

// Three starter recipes so the first open isn't a blank page. Original Fare
// Forge recipes (no source URL) tagged "starter" — delete freely.
function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM recipes').get().n;
  if (n > 0) return;
  const insert = db.prepare(`
    INSERT INTO recipes (title, source_site, servings, prep_min, cook_min, total_min, ingredients_json, steps_json, tags_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const starters = [
    {
      title: 'Sheet-Pan Lemon Chicken & Potatoes',
      servings: 4, prep: 15, cook: 25,
      ingredients: [
        '2 lb chicken thighs, bone-in',
        '1 1/2 lb baby yellow potatoes, halved',
        '2 lemons, one juiced and one sliced',
        '6 cloves garlic, smashed',
        '1/4 cup olive oil',
        '2 tbsp butter, cubed',
        '1 tbsp dried oregano',
        '2 tsp smoked paprika',
        '1 tsp kosher salt',
        '1/2 tsp black pepper',
        '1/4 cup fresh parsley, chopped',
      ],
      steps: [
        'Heat the oven to 425°F. Toss the potatoes with half the olive oil, half the oregano, and a big pinch of salt on a sheet pan; roast 10 minutes while you prep the chicken.',
        'Pat the chicken dry. Rub with the remaining oil, oregano, paprika, salt, and pepper.',
        'Pull the pan, push the potatoes aside, and nestle in the chicken. Scatter the garlic, lemon slices, and butter over everything.',
        'Roast 22–25 minutes, until the chicken hits 165°F and the potatoes are golden at the edges.',
        'Squeeze the lemon juice over the pan and rest 5 minutes.',
        'Shower with parsley and serve straight off the pan.',
      ],
      tags: ['starter', 'sheet pan'],
    },
    {
      title: 'Weeknight Beef Tacos',
      servings: 4, prep: 10, cook: 15,
      ingredients: [
        '1 lb ground beef',
        '12 corn tortillas',
        '1 yellow onion, diced',
        '2 tsp ground cumin',
        '2 tsp chili powder',
        '1 tsp smoked paprika',
        '1/2 tsp kosher salt',
        '8 oz cotija or queso fresco, crumbled',
        '1 head iceberg lettuce, shredded',
        '2 limes, cut into wedges',
        '1 cup sour cream',
      ],
      steps: [
        'Brown the beef with the onion in a large skillet over medium-high, about 6 minutes.',
        'Stir in cumin, chili powder, paprika, and salt with a splash of water; simmer 3 minutes.',
        'Warm the tortillas in a dry pan or straight over the flame.',
        'Set out the beef, cheese, lettuce, limes, and sour cream and let everyone build their own.',
      ],
      tags: ['starter', 'kid pick'],
    },
    {
      title: 'Slow-Cooker Sunday Ragù',
      servings: 6, prep: 20, cook: 480,
      ingredients: [
        '2 lb pork shoulder, cut in big chunks',
        '1 yellow onion, diced',
        '4 cloves garlic, minced',
        '28 oz crushed tomatoes',
        '2 tbsp tomato paste',
        '1 cup chicken stock',
        '2 bay leaves',
        '1 tsp dried oregano',
        '1 lb pappardelle',
        'parmesan, for serving',
      ],
      steps: [
        'Sear the pork in a hot pan until browned on two sides, about 6 minutes total.',
        'Pile pork, onion, garlic, tomatoes, tomato paste, stock, bay leaves, and oregano into the slow cooker.',
        'Cook on low 8 hours, until the pork shreds with a fork. Pull the bay leaves, shred the meat, season.',
        'Cook the pappardelle, toss with the ragù, and finish with parmesan.',
      ],
      tags: ['starter', 'batch cook'],
    },
  ];
  for (const s of starters) {
    insert.run(
      s.title, 'Fare Forge starter', s.servings, s.prep, s.cook, s.prep + s.cook,
      JSON.stringify(s.ingredients.map((raw) => ({ raw }))),
      JSON.stringify(s.steps),
      JSON.stringify(s.tags),
    );
  }
}
