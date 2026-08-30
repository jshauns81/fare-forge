import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidWeekStart, relativeWeekName, shiftWeek, spanLabel, weekLabel, weekStartOf } from '../lib/weeks.js';

test('weekStartOf lands on Monday', () => {
  assert.equal(weekStartOf(new Date(2026, 7, 30)), '2026-08-24'); // a Sunday → prior Monday
  assert.equal(weekStartOf(new Date(2026, 7, 24)), '2026-08-24'); // Monday stays
  assert.equal(weekStartOf(new Date(2026, 7, 25)), '2026-08-24'); // Tuesday → Monday
});

test('shiftWeek moves whole weeks', () => {
  assert.equal(shiftWeek('2026-08-24', 1), '2026-08-31');
  assert.equal(shiftWeek('2026-08-24', -2), '2026-08-10');
});

test('isValidWeekStart only accepts real Mondays', () => {
  assert.equal(isValidWeekStart('2026-08-24'), true);
  assert.equal(isValidWeekStart('2026-08-25'), false);
  assert.equal(isValidWeekStart('2026-02-30'), false); // normalizes to a Monday but isn't a date
  assert.equal(isValidWeekStart('2026-13-05'), false);
  assert.equal(isValidWeekStart('nope'), false);
  assert.equal(isValidWeekStart(undefined), false);
});

test('labels cover one week or a fortnight', () => {
  assert.equal(weekLabel('2026-03-02'), 'March 2 – 8');
  assert.equal(spanLabel('2026-03-02', 2), 'March 2 – 15');
  assert.equal(spanLabel('2026-03-30', 2), 'Mar 30 – Apr 12'); // month boundary
  assert.equal(spanLabel('2026-08-31', 1), 'Aug 31 – Sep 6');
});

test('relativeWeekName names the near weeks', () => {
  const ref = new Date(2026, 7, 30); // Sunday, in week of Aug 24
  assert.equal(relativeWeekName('2026-08-24', ref), 'This week');
  assert.equal(relativeWeekName('2026-08-31', ref), 'Next week');
  assert.equal(relativeWeekName('2026-08-17', ref), 'Last week');
  assert.equal(relativeWeekName('2026-09-07', ref), null);
});
