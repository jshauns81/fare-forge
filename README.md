# Fare Forge

**Melt down the blog post. Keep the recipe.**

A self-hosted family weekly meal planner. Paste a Pinterest pin or any food-blog
link into **The Forge** and it comes out a clean recipe — just the ingredients
and the instructions, with the life story, ads, and popups burned off. Plan the
week on the board, and the market list builds itself: duplicates merged, units
combined, sorted by aisle.

## The four surfaces

| Surface | What it does |
| --- | --- |
| **Week Board** (`/`) | Two weeks at a glance (toggle down to one). Click an empty day to plan it, drag dinners between days — across weeks too — mark leftovers or eating out, copy the previous stretch. |
| **The Forge** (`/forge`) | Paste a recipe link (Pinterest pins resolve to their source) or raw page text. Shows a strip report: what was found, what was cut, what was kept. |
| **Recipe Box** (`/recipes`) | Everything you've forged, searchable. Each recipe view has tap-to-check ingredients, a serving scaler, big cook-mode steps, and a credit link to the original. |
| **Market List** (`/market`) | The whole fortnight's ingredients (or one week's) aggregated per aisle with per-recipe source counts. Check off as you shop, add staples, copy as text, or print it like a receipt. |

## Running it

Requires **Node 22.5+** (the built-in `node:sqlite` module).

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`. Tests: `npm test`.

If the server's clock lives in a different timezone than the family (a UTC
VPS, say), set `TZ` so "this week" rolls over at your midnight, not the
server's: `TZ=America/New_York npm start`.

Data lives in a single SQLite file at `data/fareforge.db` (created on first
run, gitignored) via Node's built-in `node:sqlite` — no native dependencies, no
external database. Three tagged starter recipes are seeded on first run so the
board isn't empty; delete them freely.

## How the Forge works

1. **Resolve** — follows Pinterest pins (and `og:see_also` pointers) to the
   source page. Private/internal addresses are refused.
2. **Extract** — schema.org `Recipe` JSON-LD first, then microdata, then known
   recipe-plugin markup (WP Recipe Maker, Tasty, Create), then a generic
   headings heuristic.
3. **Strip** — keeps title, ingredients, steps, times, servings, and source
   credit. Counts what it removed and reports the trim percentage.
4. **Fallback** — if a site blocks robots, paste the page text; the Forge
   sorts ingredient lines from instruction lines by shape.

Ingredient lines are parsed (`lib/ingredients.js`) into quantity/unit/item with
unicode-fraction and range support, merged across the week's recipes with
unit-family conversion (volume ↔ volume, weight ↔ weight, counts kept
side-by-side), and classified into aisles. Spices land on a separate
"check the cupboard first" rail.

## Design

The visual direction — butcher-paper editorial × forge: warm paper, iron
panels, one ember accent, letterpress cards with hard offset shadows,
Bricolage Grotesque + IBM Plex Mono — was planned as a design canvas first.
The artboard sources live in [`design/`](design/) (`*.dc.html` + `canvas.json`),
including two low-fi alternate directions (Galley Ledger, Midnight Diner).

Fonts are self-hosted in `public/fonts` (Bricolage Grotesque and IBM Plex
Mono, both under the SIL Open Font License) — no font CDN, no trackers,
no accounts.

## Stack

Next.js (App Router) · React · `node:sqlite` · cheerio (server-side
extraction) · hand-rolled CSS (no framework). Unit tests with `node:test`
against local HTML fixtures — no network needed.
