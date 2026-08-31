# Fare Forge Burndown

Last updated: 2026-08-31

This is the ordered work queue for Fare Forge. It is intentionally split into
small pieces so one behavior can be built, tested, and tried by the family
before the next piece starts.

## Product direction

Fare Forge is a shared family menu board first and a recipe importer second.
A recipe link must never be required just to put food on the calendar.

The following product decisions are locked:

- Dinner remains the primary meal shown for every day.
- Breakfast and lunch are optional. Each day offers `+ Breakfast` and
  `+ Lunch` above dinner instead of showing two more empty boxes by default.
- Every meal slot accepts either a saved recipe or a plain label such as
  `Hamburgers`, `Sandwiches`, `Eat Out`, or anything else the family types.
- Plain meals do not invent shopping ingredients. The family can add related
  items through Staples & Extras when needed.
- The two-week board must export as a US Letter landscape PDF: 11 x 8.5 inches.
- The app remains a shared household appliance for now. Separate user accounts,
  nutrition tracking, and automatic meal recommendations are not current scope.

## How to work this list

1. Take only the first ready item unless Shaun explicitly changes the order.
2. Keep each change independently testable and reversible.
3. Do not combine a database migration, a new workflow, and visual polish into
   one change.
4. A checked box means the behavior was observed, not merely coded.
5. Update this document when an item starts, finishes, changes scope, or reveals
   follow-up work.

## Status key

- `[x]` Complete and verified
- `[ ]` Ready or queued
- `BLOCKED` Needs a product decision or external dependency

## Now — remove hard failures

### [x] FF-001 — Saved market extras crash the Market List

User outcome: adding an item such as `paper towels` no longer makes the Market
List return a server error on the next load.

Acceptance checks:

- Add a custom extra.
- Reload the Market List.
- Confirm the item remains visible and removable.
- Confirm database results passed into the interactive list are plain objects.
- Keep a regression test covering the database boundary.

## Next — make ordinary meals effortless

### [x] FF-101 — Add a plain-text dinner

User outcome: Friday can say `Hamburgers` without importing or creating a
recipe.

Done 2026-08-31. The slot picker now opens on a focused `Quick meal` field:
type `Hamburgers`, press Enter — two actions. One-tap chips offer Eat Out,
Sandwiches, Leftovers, and Takeout without limiting free text. Tapping a
plain meal reopens the picker prefilled so it can be relabeled or replaced
with a recipe; whitespace-only labels are rejected server-side. Observed in
a scripted browser run against a production build (add, reload, relabel,
replace with recipe, drag to another day, remove, market list stays empty)
plus regression tests at the database boundary.

Follow-up discovered: the clear button on plain-meal cards was hover-only
and therefore unreachable — hover parity is fixed here; the no-hover and
touch route remains FF-104 scope.

Recommended interaction:

- Open an empty dinner slot.
- Put a small `Quick meal` field above Recipe Box search.
- Type any label and add it directly to the board.
- Keep one-tap suggestions for `Eat Out`, `Sandwiches`, `Leftovers`, and
  `Takeout`, but never limit the family to those suggestions.

Acceptance checks:

- `Hamburgers` can be added to Friday in no more than two deliberate actions
  after opening the slot.
- The entry can be edited, moved, replaced with a recipe, or removed.
- No URL, fake recipe, ingredients, or workaround is required.
- A plain meal does not add anything to the Market List automatically.

### [ ] FF-102 — Add meal slots without losing existing plans

User outcome: the board can hold breakfast, lunch, and dinner independently for
the same day.

Implementation boundary:

- Add a meal-slot value for `breakfast`, `lunch`, and `dinner`.
- Preserve every existing plan entry as dinner during migration.
- Uniqueness becomes week + day + meal slot.
- Retain the existing recipe-or-plain-label behavior within every slot.

Acceptance checks:

- Existing databases open with all current meals intact as dinners.
- One day can hold all three meal types without overwriting another.
- Moving or clearing one slot cannot alter the other slots.
- Migration behavior is covered by an automated test using a pre-migration
  database.

### [ ] FF-103 — Add optional Breakfast and Lunch controls

User outcome: each day shows compact `+ Breakfast` and `+ Lunch` actions above
the dinner card. A full row appears only after that optional meal is added.

Acceptance checks:

- The default board remains dinner-focused and visually calm.
- Adding breakfast or lunch uses the same recipe-or-plain-label picker as
  dinner.
- Added optional meals can be edited, moved, and removed on touch, mouse, and
  keyboard.
- One-week and two-week board layouts remain readable on phone and desktop.

### [ ] FF-104 — Make board actions work without hover or drag

User outcome: every family member can move, edit, and remove a meal from a phone
or keyboard. Dragging remains a convenience, not the only route.

Acceptance checks:

- Recipe meals and plain meals expose the same visible action menu.
- Note-style entries can always be removed.
- Touch devices do not depend on hover-only controls.
- Keyboard focus, Escape behavior, and modal focus return are verified.

## Then — make imported food data trustworthy

### [ ] FF-201 — Preview and edit before saving a forged recipe

User outcome: a forged recipe opens as a draft. The family can correct the
title, servings, ingredients, instructions, and tags before it enters the
Recipe Box.

Acceptance checks:

- Importing does not write a recipe until Save is chosen.
- Cancel leaves the Recipe Box unchanged.
- Existing recipes can be edited later using the same fields.
- Original source credit remains attached and visible.

### [ ] FF-202 — Clean shopping annotations without losing package sizes

User outcome: the Market List says `1 can coconut milk — 14 oz`, not
`coconut milk ($1.89)`, and it never merges incompatible package sizes into a
misleading total.

Acceptance checks:

- Publisher price annotations are removed from display names and merge keys.
- Package sizes remain visible.
- Different package sizes are either converted safely or kept as separate
  quantities.
- Common duplicates merge across recipes without merging unrelated foods.
- Regression fixtures include real-world price and package-size formats.

### [ ] FF-203 — Prevent accidental duplicate imports

User outcome: forging a URL already in the Recipe Box offers to open or update
the existing recipe instead of silently creating another copy.

### [ ] FF-204 — Maintain a live compatibility check for recipe links

User outcome: claims about ordinary sites and Pinterest reflect observed
behavior. Blocked sites continue to offer the pasted-text fallback clearly.

The automated test suite remains offline and deterministic; a small documented
manual check covers live sites before releases.

## Reliability and safety

### [ ] FF-301 — Show failed saves instead of pretending they worked

User outcome: board, market, import, copy, and delete actions show a useful
message when the server rejects a change. Optimistic changes roll back.

### [ ] FF-302 — Protect existing plans during copy operations

User outcome: copying a previous week or fortnight previews what will be
replaced and requires confirmation. An immediate undo is available.

### [ ] FF-303 — Define private deployment and backup recovery

User outcome: the household knows how the app is protected, backed up, restored,
and moved to another machine.

Acceptance checks:

- Document LAN-only or Cloudflare Access protection; never publish the current
  unauthenticated app directly to the internet.
- Add a safe SQLite backup and restore procedure that handles WAL files.
- Test recovery into an empty data directory.
- Establish schema-versioned migrations before the first schema change ships.

### [ ] FF-304 — Finish URL-fetch hardening

Cover non-public IPv6 ranges, define a total request deadline across redirects,
and add basic abuse limits before any public-facing deployment.

### [ ] FF-305 — Clear dependency advisories

Upgrade the Next.js/PostCSS chain deliberately, then rerun tests, production
build, dependency audit, and the family workflows. Do not use a forced major
upgrade without reviewing its migration notes.

## Two-week PDF

### [ ] FF-401 — Define the printable two-week sheet

Locked output:

- US Letter landscape, 11 x 8.5 inches.
- Exactly two weeks per export.
- Dates and meal types are unambiguous.
- Breakfast and lunch appear only where planned.
- Plain meals and recipe titles have equal visual weight.
- The result remains readable in black and white with sensible margins.

### [ ] FF-402 — Add Export PDF

User outcome: one button downloads a consistently named two-week PDF without
requiring an external service.

Acceptance checks:

- Export uses the two weeks currently shown on the board.
- Output filename includes the starting date.
- Text is selectable, not a screenshot.
- No cards, dates, or meal labels clip at 100% scale.
- Verify the saved PDF and a physical print on US Letter landscape.

## Later improvements

These are useful after the family has exercised the core planner:

- Search Recipe Box by ingredient, not only title, tag, and source.
- Favorites, family rating, `kid pick`, and last-cooked history.
- Optional recipe imagery in the Recipe Box while keeping the board compact.
- Better duplicate-food normalization learned from real household recipes.
- Accessibility and visual QA across Safari desktop, iPhone, and print.

## Recommended delivery order

1. FF-101 — plain-text dinner
2. FF-102 — meal-slot migration
3. FF-103 — optional breakfast and lunch
4. FF-104 — touch and keyboard actions
5. FF-201 and FF-202 — editable, trustworthy imports
6. FF-301 and FF-302 — visible failures and safe copying
7. FF-401 and FF-402 — two-week PDF
8. FF-303 through FF-305 — deployment and maintenance gate

Do not begin the next numbered item merely because the previous one was coded.
Verify the user outcome and update this file first.
