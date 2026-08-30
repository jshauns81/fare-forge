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
      if (!isValidWeekStart(weekStart) || !(day >= 0 && day <= 6) || (!recipeId && !note)) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      setPlanEntry({ weekStart, day, recipeId: recipeId ?? null, note: note ? String(note).slice(0, 80) : null });
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
      const { weekStart, fromDay, toDay } = body;
      if (!isValidWeekStart(weekStart) || !(fromDay >= 0 && fromDay <= 6) || !(toDay >= 0 && toDay <= 6)) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      const plan = getPlan(weekStart);
      const from = plan.find((p) => p.day === fromDay);
      if (!from) return NextResponse.json({ error: 'Nothing to move' }, { status: 400 });
      const to = plan.find((p) => p.day === toDay);
      setPlanEntry({ weekStart, day: toDay, recipeId: from.recipe?.id ?? null, note: from.note });
      if (to) {
        // swap, so a drop on an occupied day never loses a dinner
        setPlanEntry({ weekStart, day: fromDay, recipeId: to.recipe?.id ?? null, note: to.note });
      } else {
        clearPlanEntry(weekStart, fromDay);
      }
      return NextResponse.json({ ok: true });
    }

    if (op === 'copy') {
      const { toWeek } = body;
      if (!isValidWeekStart(toWeek)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      const copied = copyPlan(shiftWeek(toWeek, -1), toWeek);
      return NextResponse.json({ ok: true, copied });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
