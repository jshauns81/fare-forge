// The Forge: turn a recipe URL (Pinterest pin, food blog, anything) or pasted
// page text into a clean recipe — title, ingredients, steps, times — plus a
// report of what was stripped away.

import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_HTML = 4_000_000;
const MAX_REDIRECTS = 5;

export class ForgeError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint || null;
  }
}

// Every address family we must never fetch from on behalf of a pasted link:
// loopback, RFC1918, link-local (cloud metadata!), CGNAT, multicast/reserved,
// and their IPv6 relatives, including v4-mapped forms.
export function isPrivateIp(ip) {
  const v0 = String(ip).toLowerCase().replace(/^\[|\]$/g, '');
  if (v0.includes(':')) {
    const v = v0;
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
    // IPv4-mapped, dotted (::ffff:127.0.0.1) or the hex form URL parsers
    // normalize to (::ffff:7f00:1) — check the embedded v4 either way.
    const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIp(dotted[1]);
    const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (v.startsWith('::ffff:')) return true; // any other mapped shape: refuse
    return false;
  }
  const parts = v0.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return isPrivateV4(a, b);
}

function isPrivateV4(a, b) {
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function assertPublicHttpUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new ForgeError('That does not look like a link.', 'Paste a full URL starting with https://');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ForgeError('Only http(s) links can be forged.');
  }
  if (process.env.FARE_FORGE_ALLOW_LOCAL === '1') return u; // tests only
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isPrivateName = host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal');
  const isIpLiteral = /^[\d.]+$/.test(host) || host.includes(':');
  if (isPrivateName || (isIpLiteral && isPrivateIp(host))) {
    throw new ForgeError('That link points inside your own network.');
  }
  return u;
}

// A public hostname can still resolve to a private address; check what DNS
// actually says before connecting. (TOCTOU re-resolution is out of scope for
// a self-hosted family app; this closes the straightforward cases.)
async function assertResolvesPublic(hostname) {
  if (process.env.FARE_FORGE_ALLOW_LOCAL === '1') return; // tests only
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) return; // literals already checked
  let addrs;
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ForgeError(`Could not find ${host}.`, 'Check the link, or paste the page text instead.');
  }
  if (addrs.some(({ address }) => isPrivateIp(address))) {
    throw new ForgeError('That link resolves inside your own network.');
  }
}

// Read at most maxBytes from the response, then hang up — a hostile or huge
// page must not be buffered whole.
async function readCapped(res, maxBytes) {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const buf = Buffer.concat(chunks);
  return buf.subarray(0, Math.min(buf.length, maxBytes)).toString('utf8');
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Fetch with redirects handled by hand so EVERY hop — not just the first
// URL — passes the public-destination checks.
async function fetchPublicHtml(startUrl) {
  let url = String(startUrl).trim();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = assertPublicHttpUrl(url);
    await assertResolvesPublic(u.hostname);
    let res;
    try {
      res = await fetch(u, {
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.8',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new ForgeError(
        `Could not reach ${u.hostname} (${err.name === 'TimeoutError' ? 'timed out' : 'network error'}).`,
        'If the site is up, it may be blocking robots — paste the page text instead.',
      );
    }
    if (REDIRECT_STATUSES.has(res.status)) {
      const loc = res.headers.get('location');
      res.body?.cancel().catch(() => {});
      if (!loc) throw new ForgeError(`${u.hostname} redirected without a destination.`);
      url = new URL(loc, u).toString();
      continue;
    }
    if (!res.ok) {
      throw new ForgeError(
        `${u.hostname} answered ${res.status}.`,
        res.status === 403 || res.status === 429
          ? 'The site is blocking robots — open it in your browser, select all, and paste the text instead.'
          : 'Check the link, or paste the page text instead.',
      );
    }
    const html = await readCapped(res, MAX_HTML);
    return { html, finalUrl: url };
  }
  throw new ForgeError('That link redirected too many times.');
}

// ---------- helpers ----------

function textOf(html) {
  if (html == null) return '';
  const s = String(html);
  if (!/[<&]/.test(s)) return s.replace(/\s+/g, ' ').trim();
  return cheerio.load(`<div>${s}</div>`)('div').text().replace(/\s+/g, ' ').trim();
}

function words(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

export function parseISODuration(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  const m = String(v).match(/P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) {
    const plain = String(v).match(/(\d+)\s*(?:min|minute)/i);
    if (plain) return Number(plain[1]);
    const hours = String(v).match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/i);
    if (hours) return Math.round(Number(hours[1]) * 60);
    return null;
  }
  const mins = (Number(m[1]) || 0) * 1440 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) + Math.round((Number(m[4]) || 0) / 60);
  return mins > 0 ? Math.round(mins) : null;
}

export function parseYield(v) {
  if (v == null) return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const n = parseYield(item);
      if (n) return n;
    }
    return null;
  }
  if (typeof v === 'object') return parseYield(v.value ?? v['@value'] ?? null);
  const m = String(v).match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 99 ? n : null;
}

function firstImage(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.startsWith('http') ? v : null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const u = firstImage(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof v === 'object') return firstImage(v.url ?? v.contentUrl ?? null);
  return null;
}

function cleanIngredientLines(list) {
  const out = [];
  for (const raw of list || []) {
    const t = textOf(raw);
    if (!t) continue;
    if (/^(for the |for serving|optional toppings?)/i.test(t) && t.endsWith(':')) continue; // section headers
    if (t.length > 200) continue;
    out.push(t);
  }
  return out;
}

function flattenInstructions(v, out = []) {
  if (v == null) return out;
  if (typeof v === 'string') {
    // strings may hold multiple steps split by newlines or numbering
    const chunks = v.split(/\r?\n+/).map((s) => textOf(s)).filter(Boolean);
    for (const c of chunks) {
      const parts = c.split(/(?:^|\s)(?=\d{1,2}[.)]\s)/).map((s) => s.trim()).filter(Boolean);
      for (const p of parts.length > 1 ? parts : [c]) out.push(p);
    }
    return out;
  }
  if (Array.isArray(v)) {
    for (const item of v) flattenInstructions(item, out);
    return out;
  }
  if (typeof v === 'object') {
    const type = String(v['@type'] || '').toLowerCase();
    if (type.includes('howtosection') || v.itemListElement) {
      flattenInstructions(v.itemListElement, out);
      return out;
    }
    const t = textOf(v.text ?? v.name ?? '');
    if (t) out.push(t);
    return out;
  }
  return out;
}

function tidySteps(steps) {
  return steps
    .map((s) => s.replace(/^(?:step\s*)?\d{1,2}[.):]\s*/i, '').trim())
    .filter((s) => s.length > 1)
    .slice(0, 40);
}

function normalizeTags(node) {
  const tags = [];
  const push = (t) => {
    const clean = String(t).trim().toLowerCase();
    if (clean && clean.length <= 24 && !tags.includes(clean)) tags.push(clean);
  };
  if (typeof node.keywords === 'string') node.keywords.split(',').slice(0, 6).forEach(push);
  if (Array.isArray(node.keywords)) node.keywords.slice(0, 6).forEach(push);
  for (const c of [node.recipeCuisine, node.recipeCategory].flat().filter(Boolean)) push(c);
  return tags.slice(0, 4);
}

// ---------- extraction strategies ----------

function jsonLdCandidates($) {
  const found = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const rawText = $(el).text();
    if (!rawText) return;
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      try {
        parsed = JSON.parse(rawText.replace(/[ -]/g, ' '));
      } catch {
        return;
      }
    }
    const queue = [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (node == null || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      const type = node['@type'];
      // Accept compact ("Recipe"), prefixed ("schema:Recipe"), and expanded
      // ("https://schema.org/Recipe") type identifiers.
      const types = (Array.isArray(type) ? type : [type]).map((t) =>
        String(t || '').toLowerCase().split(/[/#:]/).pop(),
      );
      if (types.some((t) => t === 'recipe')) found.push(node);
      if (node['@graph']) queue.push(node['@graph']);
      if (node.mainEntity) queue.push(node.mainEntity);
    }
  });
  return found;
}

function fromJsonLd($) {
  for (const node of jsonLdCandidates($)) {
    const ingredients = cleanIngredientLines(node.recipeIngredient ?? node.ingredients ?? []);
    const steps = tidySteps(flattenInstructions(node.recipeInstructions));
    if (ingredients.length >= 2 && steps.length >= 1) {
      return {
        method: 'json-ld',
        title: textOf(node.name) || null,
        ingredients,
        steps,
        servings: parseYield(node.recipeYield ?? node.yield),
        prepMin: parseISODuration(node.prepTime),
        cookMin: parseISODuration(node.cookTime),
        totalMin: parseISODuration(node.totalTime),
        imageUrl: firstImage(node.image),
        tags: normalizeTags(node),
      };
    }
  }
  return null;
}

function fromMicrodata($) {
  const scope = $('[itemtype*="schema.org/Recipe" i]').first();
  if (!scope.length) return null;
  const ingredients = cleanIngredientLines(
    scope.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').map((_, el) => $(el).text()).get(),
  );
  const steps = tidySteps(
    scope.find('[itemprop="recipeInstructions"]').length === 1 && scope.find('[itemprop="recipeInstructions"]').find('li, p').length
      ? scope.find('[itemprop="recipeInstructions"]').find('li, p').map((_, el) => $(el).text()).get().map(textOf)
      : scope.find('[itemprop="recipeInstructions"]').map((_, el) => $(el).text()).get().map(textOf),
  );
  if (ingredients.length < 2 || steps.length < 1) return null;
  const prop = (name) => scope.find(`[itemprop="${name}"]`).first();
  return {
    method: 'microdata',
    title: textOf(prop('name').text()) || null,
    ingredients,
    steps,
    servings: parseYield(prop('recipeYield').attr('content') || prop('recipeYield').text()),
    prepMin: parseISODuration(prop('prepTime').attr('content') || prop('prepTime').attr('datetime')),
    cookMin: parseISODuration(prop('cookTime').attr('content') || prop('cookTime').attr('datetime')),
    totalMin: parseISODuration(prop('totalTime').attr('content') || prop('totalTime').attr('datetime')),
    imageUrl: prop('image').attr('src') || prop('image').attr('content') || null,
    tags: [],
  };
}

// Known recipe-plugin markup, then generic "Ingredients"/"Instructions" headings.
function fromHeuristics($) {
  const pluginSelectors = [
    { ing: '.wprm-recipe-ingredient', step: '.wprm-recipe-instruction-text' },
    { ing: '.wprm-recipe-ingredient', step: '.wprm-recipe-instruction' },
    { ing: '.tasty-recipes-ingredients li, .tasty-recipe-ingredients li', step: '.tasty-recipes-instructions li, .tasty-recipe-instructions li' },
    { ing: '.mv-create-ingredients li', step: '.mv-create-instructions li' },
    { ing: '.recipe-ingredients li, ul.ingredients li, .ingredient-list li', step: '.recipe-instructions li, ol.instructions li, .instruction-list li, .recipe-directions li' },
  ];
  for (const sel of pluginSelectors) {
    const ingredients = cleanIngredientLines($(sel.ing).map((_, el) => $(el).text()).get());
    const steps = tidySteps($(sel.step).map((_, el) => textOf($(el).text())).get());
    if (ingredients.length >= 2 && steps.length >= 1) {
      return { method: 'recipe plugin markup', title: null, ingredients, steps, servings: null, prepMin: null, cookMin: null, totalMin: null, imageUrl: null, tags: [] };
    }
  }

  // Generic: a heading that says Ingredients, then the next list; same for instructions.
  const listAfterHeading = (re) => {
    let result = null;
    $('h1, h2, h3, h4, strong, b, p').each((_, el) => {
      if (result) return;
      const t = $(el).text().trim();
      if (re.test(t) && t.length < 40) {
        const list = $(el).nextAll('ul, ol').first();
        if (list.length) result = list.find('li').map((_, li) => $(li).text()).get();
      }
    });
    return result || [];
  };
  const ingredients = cleanIngredientLines(listAfterHeading(/^ingredients\b/i));
  let steps = tidySteps(listAfterHeading(/^(instructions|directions|method|steps|preparation)\b/i).map(textOf));
  if (ingredients.length >= 2 && steps.length >= 1) {
    return { method: 'page structure', title: null, ingredients, steps, servings: null, prepMin: null, cookMin: null, totalMin: null, imageUrl: null, tags: [] };
  }
  return null;
}

// ---------- strip accounting ----------

function stripStats($, kept) {
  const clutter =
    $('script, style, iframe, noscript').length +
    $('[class*="ad-" i], [class*="advert" i], [id*="advert" i], [class*="popup" i], [class*="newsletter" i], [class*="share" i], [class*="social" i], [class*="promo" i], [class*="sidebar" i], [class*="comment" i]').length;
  $('script, style, noscript').remove();
  const originalWords = words($('body').text());
  const keptWords = words([kept.title, ...(kept.ingredients || []), ...(kept.steps || [])].join(' '));
  const removedWords = Math.max(0, originalWords - keptWords);
  const pct = originalWords > 0 ? Math.min(99, Math.max(0, Math.round((removedWords / originalWords) * 100))) : 0;
  return { originalWords, keptWords, removedWords, clutterNodes: clutter, trimmedPct: pct };
}

// ---------- Pinterest ----------

function isPinterestHost(host) {
  return /(^|\.)pinterest\.[a-z.]+$/i.test(host) || /(^|\.)pin\.it$/i.test(host);
}

// Pins embed their outbound link in page JSON; og:see_also is the fallback.
function pinterestOutboundLink(html, pageUrl) {
  const $ = cheerio.load(html);
  const og = $('meta[property="og:see_also"]').attr('content');
  if (og && og.startsWith('http') && !isPinterestHost(new URL(og).hostname)) return og;
  const matches = html.matchAll(/"link"\s*:\s*"(https?:[^"]{8,600}?)"/g);
  for (const m of matches) {
    let candidate = m[1].replace(/\\\//g, '/');
    try {
      const u = new URL(candidate);
      if (!isPinterestHost(u.hostname) && !/pinimg\.com$/i.test(u.hostname)) return u.toString();
    } catch { /* keep scanning */ }
  }
  void pageUrl;
  return null;
}

// ---------- public API ----------

export async function forgeFromUrl(rawUrl) {
  const report = [];
  let { html, finalUrl } = await fetchPublicHtml(rawUrl);
  let hops = 0;

  // A pin (by host, or by Pinterest's own page markers) is a pointer, not the
  // recipe — follow its outbound link to the source site first.
  const looksLikePin = isPinterestHost(new URL(finalUrl).hostname) || html.includes('__PWS_');
  if (looksLikePin) {
    const outbound = pinterestOutboundLink(html, finalUrl);
    if (outbound) {
      report.push(`Followed the pin to ${new URL(outbound).hostname.replace(/^www\./, '')}`);
      ({ html, finalUrl } = await fetchPublicHtml(outbound));
      hops = 1;
    } else {
      report.push('Pin has no outbound link — reading the pin page itself');
    }
  }

  let $ = cheerio.load(html);
  let found = fromJsonLd($) || fromMicrodata($) || fromHeuristics($);

  // Generic one-hop fallback: some aggregator pages point at the real recipe
  // via og:see_also without being Pinterest.
  if (!found && hops === 0) {
    const seeAlso = $('meta[property="og:see_also"]').attr('content');
    if (seeAlso && seeAlso.startsWith('http') && new URL(seeAlso).hostname !== new URL(finalUrl).hostname) {
      report.push(`Followed the page's link to ${new URL(seeAlso).hostname.replace(/^www\./, '')}`);
      ({ html, finalUrl } = await fetchPublicHtml(seeAlso));
      hops = 1;
      $ = cheerio.load(html);
      found = fromJsonLd($) || fromMicrodata($) || fromHeuristics($);
    }
  }
  if (!found) {
    throw new ForgeError(
      `No recipe found at ${new URL(finalUrl).hostname.replace(/^www\./, '')}.`,
      'If the recipe is only in a photo or an app, paste the text version instead.',
    );
  }

  const methodLabel = { 'json-ld': 'structured recipe data (JSON-LD)', microdata: 'microdata markup', 'recipe plugin markup': 'recipe plugin markup', 'page structure': 'the page structure' }[found.method];
  report.push(`Found ${methodLabel}`);

  const pageTitle = textOf($('meta[property="og:title"]').attr('content') || $('title').first().text());
  const title = found.title || pageTitle || 'Untitled recipe';
  const siteName = textOf($('meta[property="og:site_name"]').attr('content')) || new URL(finalUrl).hostname.replace(/^www\./, '');
  const imageUrl = found.imageUrl || firstImage($('meta[property="og:image"]').attr('content')) || null;

  const kept = { title, ingredients: found.ingredients, steps: found.steps };
  const strip = stripStats($, kept);
  if (strip.clutterNodes > 0) report.push(`Stripped ${strip.clutterNodes.toLocaleString('en-US')} scripts, ads, popups & share bars`);
  if (strip.removedWords > 0) report.push(`Cut ${strip.removedWords.toLocaleString('en-US')} words of story and filler`);
  report.push(`Kept ${found.ingredients.length} ingredients · ${found.steps.length} steps`);

  return {
    recipe: {
      title,
      sourceUrl: finalUrl,
      sourceSite: siteName,
      imageUrl,
      servings: found.servings,
      prepMin: found.prepMin,
      cookMin: found.cookMin,
      totalMin: found.totalMin ?? (found.prepMin != null || found.cookMin != null ? (found.prepMin || 0) + (found.cookMin || 0) : null),
      ingredients: found.ingredients.map((raw) => ({ raw })),
      steps: found.steps,
      tags: found.tags,
      strip,
    },
    report,
    hops,
  };
}

const QTY_LINE = /^\s*(?:[\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞]|a |an |one |salt|pepper|pinch|dash)/i;
const STEP_HEADER = /^(instructions?|directions?|method|steps|preparation|to make)\b[:\s]*$/i;
const ING_HEADER = /^ingredients?\b[:\s]*$/i;

export function forgeFromText(text) {
  const report = [];
  const lines = String(text || '').split(/\r?\n/).map((s) => s.trim());
  const originalWords = words(text);
  if (originalWords < 5) throw new ForgeError('That text is too short to hold a recipe.');

  const ingIdx = lines.findIndex((l) => ING_HEADER.test(l));
  const stepIdx = lines.findIndex((l) => STEP_HEADER.test(l));
  let title = lines.find((l) => l.length > 0) || 'Untitled recipe';
  let ingredients = [];
  let steps = [];

  if (ingIdx !== -1 && stepIdx !== -1 && stepIdx > ingIdx) {
    ingredients = lines.slice(ingIdx + 1, stepIdx).filter((l) => l && !ING_HEADER.test(l));
    steps = lines.slice(stepIdx + 1).filter(Boolean);
    report.push('Read the Ingredients and Instructions sections');
  } else {
    // No headers: quantity-looking lines are ingredients, sentence lines are steps.
    for (const line of lines.slice(1)) {
      if (!line) continue;
      if (QTY_LINE.test(line) && line.length < 120 && !/[.!?]$/.test(line)) ingredients.push(line);
      else if (line.length > 20) steps.push(line);
    }
    report.push('No section headers — sorted lines by shape');
  }

  ingredients = cleanIngredientLines(ingredients);
  steps = tidySteps(steps.map(textOf));
  if (ingredients.length < 2 || steps.length < 1) {
    throw new ForgeError('Could not tell the ingredients from the instructions in that text.', 'Make sure it has an "Ingredients" line and an "Instructions" line.');
  }

  title = title.replace(/\s+/g, ' ').slice(0, 120);
  const keptWords = words([title, ...ingredients, ...steps].join(' '));
  const removedWords = Math.max(0, originalWords - keptWords);
  const strip = {
    originalWords,
    keptWords,
    removedWords,
    clutterNodes: 0,
    trimmedPct: originalWords > 0 ? Math.round((removedWords / originalWords) * 100) : 0,
  };
  if (removedWords > 0) report.push(`Cut ${removedWords.toLocaleString('en-US')} words of filler`);
  report.push(`Kept ${ingredients.length} ingredients · ${steps.length} steps`);

  return {
    recipe: {
      title,
      sourceUrl: null,
      sourceSite: 'pasted text',
      imageUrl: null,
      servings: null,
      prepMin: null,
      cookMin: null,
      totalMin: null,
      ingredients: ingredients.map((raw) => ({ raw })),
      steps,
      tags: [],
      strip,
    },
    report,
    hops: 0,
  };
}
