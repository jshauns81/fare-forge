import { NextResponse } from 'next/server';
import { clearPlanEntry, copyPlan, getPlan, setPlanEntry } from '@/lib/db';
import { isValidWeekStart, shiftWeek } from '@/lib/weeks';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }
  const { op } = body || {};

  try {
    if (op === 'set') {
      const { weekStart, day, recipeId, note } = body;
      const label = note == null ? null : String(note).trim().slice(0, 80).trimEnd() || null;
      if (!isValidWeekStart(weekStart) || !(day >= 0 && day <= 6) || (!recipeId && !label)) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      setPlanEntry({ weekStart, day, recipeId: recipeId ?? null, note: label });
      return NextResponse.json({ ok: true });
    }

    if (op === 'clear') {
      const { weekStart, day } = body;
      if (!isValidWeekStart(weekStart) || !(day >= 0 && day <= 6)) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      clearPlanEntry(weekStart, day);
      return NextResponse.json({ ok: true });
    }

    if (op === 'move') {
      // Moves can cross weeks — the board shows a fortnight.
      const { fromWeek, fromDay, toWeek, toDay } = body;
      if (
        !isValidWeekStart(fromWeek) || !isValidWeekStart(toWeek) ||
        !(fromDay >= 0 && fromDay <= 6) || !(toDay >= 0 && toDay <= 6)
      ) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      if (fromWeek === toWeek && fromDay === toDay) return NextResponse.json({ ok: true });
      const from = getPlan(fromWeek).find((p) => p.day === fromDay);
      if (!from) return NextResponse.json({ error: 'Nothing to move' }, { status: 400 });
      const to = getPlan(toWeek).find((p) => p.day === toDay);
      setPlanEntry({ weekStart: toWeek, day: toDay, recipeId: from.recipe?.id ?? null, note: from.note });
      if (to) {
        // swap, so a drop on an occupied day never loses a dinner
        setPlanEntry({ weekStart: fromWeek, day: fromDay, recipeId: to.recipe?.id ?? null, note: to.note });
      } else {
        clearPlanEntry(fromWeek, fromDay);
      }
      return NextResponse.json({ ok: true });
    }

    if (op === 'copy') {
      // span=1: last week → this week. span=2: the previous fortnight → this one.
      const { toWeek } = body;
      const span = body.span === 2 ? 2 : 1;
      if (!isValidWeekStart(toWeek)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      let copied = 0;
      for (let i = 0; i < span; i++) {
        copied += copyPlan(shiftWeek(toWeek, i - span), shiftWeek(toWeek, i));
      }
      return NextResponse.json({ ok: true, copied });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
