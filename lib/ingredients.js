// Ingredient parsing, unit-aware merging, and aisle classification.
// One rule everywhere: recipes store raw ingredient strings; everything the
// UI or the market list needs is derived here, on demand.

const UNICODE_FRACTIONS = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅐': 1 / 7, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// unit aliases → canonical name
const UNIT_ALIASES = new Map(Object.entries({
  cup: 'cup', cups: 'cup', c: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tb: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', tsps: 'tsp', t: 'tsp',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  gram: 'g', grams: 'g', g: 'g', gr: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l',
  quart: 'quart', quarts: 'quart', qt: 'quart',
  pint: 'pint', pints: 'pint', pt: 'pint',
  gallon: 'gallon', gallons: 'gallon',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz', floz: 'fl oz',
  clove: 'clove', cloves: 'clove',
  head: 'head', heads: 'head',
  bunch: 'bunch', bunches: 'bunch',
  can: 'can', cans: 'can',
  jar: 'jar', jars: 'jar',
  stick: 'stick', sticks: 'stick',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  package: 'package', packages: 'package', pkg: 'package',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  handful: 'handful', handfuls: 'handful',
  sprig: 'sprig', sprigs: 'sprig',
  stalk: 'stalk', stalks: 'stalk',
  rib: 'rib', ribs: 'rib',
  ear: 'ear', ears: 'ear',
  fillet: 'fillet', fillets: 'fillet', filet: 'fillet', filets: 'fillet',
  knob: 'knob', knobs: 'knob',
  bag: 'bag', bags: 'bag',
  box: 'box', boxes: 'box',
  bottle: 'bottle', bottles: 'bottle',
}));

// volume in teaspoons; weight in ounces
const VOLUME_TSP = { tsp: 1, tbsp: 3, 'fl oz': 6, cup: 48, pint: 96, quart: 192, gallon: 768, ml: 0.202884, l: 202.884 };
const WEIGHT_OZ = { oz: 1, lb: 16, g: 0.035274, kg: 35.274 };

function parseNumberToken(tok) {
  tok = tok.trim();
  if (UNICODE_FRACTIONS[tok] != null) return UNICODE_FRACTIONS[tok];
  const m = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}

// Pull a leading quantity off a string. Handles: "1", "1.5", "1/2", "½",
// "1 1/2", "1½", "1 to 2", "1-2", "a"/"an". Returns {qty, rest} or null qty.
function takeQuantity(s) {
  s = s.trim();
  let m = s.match(/^(?:a|an|one)\s+(?=[a-z])/i);
  if (m) return { qty: 1, rest: s.slice(m[0].length) };

  const numPart = String.raw`(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞])`;
  m = s.match(new RegExp(String.raw`^(${numPart})(?:\s*(?:-|–|—|to)\s*(${numPart}))?\s*`, 'i'));
  if (!m) return { qty: null, rest: s };

  let qty = parseCompound(m[1]);
  let rest = s.slice(m[0].length);
  // "1 1/2" or "1 ½" — a second fraction token right after an integer
  const frac = rest.match(new RegExp(String.raw`^(\d+\s*\/\s*\d+|[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞])\s+`));
  if (frac && Number.isInteger(qty) && !m[2]) {
    qty += parseCompound(frac[1]);
    rest = rest.slice(frac[0].length);
  }
  if (m[2]) {
    // range: shop for the upper bound
    const hi = parseCompound(m[2]);
    if (hi != null && qty != null) qty = Math.max(qty, hi);
  }
  return { qty, rest };
}

function parseCompound(tok) {
  // "1½" glued together
  const glued = tok.match(/^(\d+)([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞])$/);
  if (glued) return Number(glued[1]) + UNICODE_FRACTIONS[glued[2]];
  return parseNumberToken(tok);
}

function takeUnit(s) {
  const m = s.trim().match(/^([a-zA-Z.]+(?:\s+ounces?)?)\s+/);
  if (!m) return { unit: null, rest: s.trim() };
  const candidate = m[1].toLowerCase().replace(/\./g, '');
  if (UNIT_ALIASES.has(candidate)) {
    return { unit: UNIT_ALIASES.get(candidate), rest: s.trim().slice(m[0].length) };
  }
  return { unit: null, rest: s.trim() };
}

// "2 (14 oz) cans crushed tomatoes" → pull the parenthetical size aside.
function takeParenSize(s) {
  const m = s.match(/^\(([^)]{1,30})\)\s*/);
  if (m) return { size: m[1], rest: s.slice(m[0].length) };
  return { size: null, rest: s };
}

export function parseIngredient(raw) {
  let working = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!working) return { raw, qty: null, unit: null, item: '', note: null };

  const { qty, rest: afterQty } = takeQuantity(working);
  const paren1 = takeParenSize(afterQty);
  const { unit, rest: afterUnit } = takeUnit(paren1.rest);
  const paren2 = takeParenSize(afterUnit);
  let itemPart = paren2.rest;

  // "of" glue: "2 cups of flour"
  itemPart = itemPart.replace(/^of\s+/i, '');

  // split trailing prep note on first comma or " - "
  let note = [paren1.size, paren2.size].filter(Boolean).join(', ') || null;
  const commaAt = itemPart.indexOf(',');
  if (commaAt > 0) {
    const tail = itemPart.slice(commaAt + 1).trim();
    note = note ? `${note}, ${tail}` : tail || null;
    itemPart = itemPart.slice(0, commaAt).trim();
  }

  // "salt to taste" / "salt, to taste"
  const toTaste = itemPart.match(/\s+to taste$/i);
  if (toTaste) {
    itemPart = itemPart.slice(0, toTaste.index).trim();
    note = note ? `${note}, to taste` : 'to taste';
  }

  return { raw: String(raw), qty, unit, item: itemPart.trim(), note };
}

// ---------- aisles ----------

export const AISLES = ['produce', 'meat & fish', 'dairy & eggs', 'bakery', 'frozen', 'pantry', 'spice rail', 'staples'];

const AISLE_RULES = [
  // multi-word / specific rules first
  ['spice rail', /\b(kosher salt|sea salt|black pepper|white pepper|red pepper flakes|chili powder|chile powder|curry powder|garam masala|five[- ]spice|smoked paprika|paprika|cumin|coriander(?! leaves)|turmeric|cinnamon|nutmeg|clove(?!s? garlic)|allspice|cayenne|oregano|thyme(?= leaves\b|$)|dried \w+|bay lea(f|ves)|italian seasoning|onion powder|garlic powder|achiote|za'?atar|sumac|star anise|cardamom|fennel seed|mustard seed|sesame seed|poppy seed|vanilla extract|almond extract|baking soda|baking powder|salt|pepper)\b/],
  ['frozen', /\b(frozen|ice cream|puff pastry|pie crust)\b/],
  // canned/jarred/dry goods that would otherwise read as produce or meat
  ['pantry', /\b(crushed tomatoes|diced tomatoes|whole peeled tomatoes|tomato (paste|sauce|puree)|sun[- ]dried|canned|stock|broth|bouillon|dried beans|black beans|pinto beans|chickpeas|garbanzo|lentils|anchovy paste|fish sauce|oyster sauce|soy sauce|coconut milk|rice|pasta|noodles?|flour|sugar|jarred)\b/],
  ['bakery', /\b(bread|buns?|rolls?|baguette|tortillas?|pita|naan|english muffins?|croissants?|hot ?dog buns?|hamburger buns?)\b/],
  ['meat & fish', /\b(chicken|beef|pork|steak|lamb|turkey|bacon|sausage|chorizo|prosciutto|ham|salmon|tuna|cod|halibut|tilapia|shrimp|prawns?|scallops?|mussels?|clams?|crab|lobster|anchov(y|ies)|ground (beef|pork|turkey|chicken|lamb)|brisket|ribs?|meatballs?|fish)\b/],
  ['dairy & eggs', /\b(milk|butter|buttermilk|cream|half[- ]and[- ]half|yogurt|yoghurt|eggs?|cheese|cheddar|mozzarella|parmesan|parmigiano|pecorino|feta|cotija|queso|ricotta|mascarpone|brie|goat cheese|cream cheese|sour cream|crème fraîche|creme fraiche|ghee)\b/],
  ['produce', /\b(onions?|garlic|shallots?|scallions?|green onions?|leeks?|potato(es)?|sweet potato(es)?|carrots?|celery|tomato(es)?|lettuce|arugula|spinach|kale|cabbage|broccoli|cauliflower|zucchini|squash|cucumbers?|peppers?|jalapeños?|jalapenos?|serranos?|poblanos?|mushrooms?|avocados?|lemons?|limes?|oranges?|apples?|pears?|bananas?|berries|strawberr(y|ies)|blueberr(y|ies)|grapes?|pineapple|mango(es)?|peach(es)?|corn|green beans|asparagus|eggplant|radish(es)?|beets?|ginger|cilantro|parsley|basil|mint|dill|rosemary|sage|chives|thyme|herbs?|salad|slaw|fruit|lemongrass|bok choy|snap peas|edamame)\b/],
];

export function classifyAisle(item) {
  const s = String(item || '').toLowerCase();
  for (const [aisle, re] of AISLE_RULES) {
    if (re.test(s)) return aisle;
  }
  return 'pantry';
}

// The spice-rail test doubles as "you probably have this" detection.
export function isCupboardStaple(item) {
  return classifyAisle(item) === 'spice rail' || /\b(olive oil|vegetable oil|canola oil|water)\b/i.test(item);
}

// ---------- merging ----------

function unitFamily(unit) {
  if (unit == null) return 'count';
  if (VOLUME_TSP[unit] != null) return 'volume';
  if (WEIGHT_OZ[unit] != null) return 'weight';
  return `unit:${unit}`; // cloves with cloves, cans with cans…
}

function toBase(qty, unit) {
  const fam = unitFamily(unit);
  if (fam === 'volume') return qty * VOLUME_TSP[unit];
  if (fam === 'weight') return qty * WEIGHT_OZ[unit];
  return qty;
}

function fmtNum(n) {
  const rounded = Math.round(n * 100) / 100;
  const whole = Math.floor(rounded + 1e-9);
  const frac = rounded - whole;
  const FRACS = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
  for (const [v, glyph] of FRACS) {
    if (Math.abs(frac - v) < 0.03) return whole ? `${whole}${glyph}` : glyph;
  }
  if (Math.abs(frac) < 0.03) return String(whole);
  return String(rounded);
}

const PLURAL_UNITS = new Set(['cup', 'clove', 'head', 'bunch', 'can', 'jar', 'stick', 'slice', 'piece', 'package', 'pinch', 'dash', 'handful', 'sprig', 'stalk', 'rib', 'ear', 'fillet', 'knob', 'bag', 'box', 'bottle']);

function unitLabel(unit, q) {
  return PLURAL_UNITS.has(unit) && q > 1 ? `${unit}s` : unit;
}

function fromBase(total, family) {
  if (family === 'volume') {
    if (total >= 24) {
      const cups = total / 48; // ≥ ½ cup reads best in cups
      return `${fmtNum(cups)} ${unitLabel('cup', cups)}`;
    }
    if (total >= 3) return `${fmtNum(total / 3)} tbsp`;
    return `${fmtNum(total)} tsp`;
  }
  if (family === 'weight') {
    if (total >= 16) return `${fmtNum(total / 16)} lb`;
    return `${fmtNum(total)} oz`;
  }
  return fmtNum(total);
}

function itemKey(item) {
  return String(item || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(fresh|large|small|medium|big|whole|raw|ripe|bonein|boneless|skinless|skinon|thincut|thickcut)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:es|s)$/, '');
}

/**
 * Aggregate parsed ingredients (each tagged with its recipe title) into
 * market-list lines grouped by aisle.
 * entries: [{raw, recipeTitle}]
 */
export function buildMarketList(entries) {
  const groups = new Map(); // key → {item, byFamily: Map, sources:Set, aisle, notes}
  for (const { raw, recipeTitle } of entries) {
    const p = parseIngredient(raw);
    if (!p.item) continue;
    const key = itemKey(p.item);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, { key, item: p.item, byFamily: new Map(), sources: new Set(), aisle: classifyAisle(p.item) });
    }
    const g = groups.get(key);
    g.sources.add(recipeTitle);
    // keep the shortest clean display name
    if (p.item.length < g.item.length) g.item = p.item;
    const fam = unitFamily(p.unit);
    const cur = g.byFamily.get(fam) || { total: 0, sawQty: false, unit: p.unit };
    if (p.qty != null) {
      cur.total += toBase(p.qty, p.unit);
      cur.sawQty = true;
    }
    g.byFamily.set(fam, cur);
  }

  const lines = [];
  for (const g of groups.values()) {
    const parts = [];
    for (const [fam, { total, sawQty, unit }] of g.byFamily) {
      if (!sawQty) continue;
      if (fam === 'volume' || fam === 'weight') parts.push(fromBase(total, fam));
      else if (fam === 'count') parts.push(fmtNum(total));
      else parts.push(`${fmtNum(total)} ${unitLabel(unit, total)}`);
    }
    lines.push({
      key: g.key,
      item: g.item,
      qty: parts.join(' + ') || null,
      aisle: g.aisle,
      sources: [...g.sources],
    });
  }

  const byAisle = new Map(AISLES.map((a) => [a, []]));
  for (const line of lines) {
    if (!byAisle.has(line.aisle)) byAisle.set(line.aisle, []);
    byAisle.get(line.aisle).push(line);
  }
  for (const arr of byAisle.values()) arr.sort((a, b) => a.item.localeCompare(b.item));
  return [...byAisle.entries()]
    .filter(([, arr]) => arr.length > 0)
    .map(([aisle, items]) => ({ aisle, items }));
}

// Scale a parsed ingredient's quantity for a serving factor, re-rendered as
// text. At factor 1 the quantity keeps the form it was written in ("¼ cup"
// stays "¼ cup"); scaled quantities re-render in the most readable unit.
export function scaledQtyText(parsed, factor) {
  if (parsed.qty == null) return null;
  const q = parsed.qty * factor;
  if (factor === 1 || !parsed.unit) {
    return parsed.unit ? `${fmtNum(q)} ${unitLabel(parsed.unit, q)}` : fmtNum(q);
  }
  const fam = unitFamily(parsed.unit);
  if (fam === 'volume') return fromBase(toBase(q, parsed.unit), 'volume');
  if (fam === 'weight') return fromBase(toBase(q, parsed.unit), 'weight');
  return `${fmtNum(q)} ${unitLabel(parsed.unit, q)}`;
}
