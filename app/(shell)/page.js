import Link from 'next/link';
import Board from '@/components/Board';
import CopyWeekButton from '@/components/CopyWeekButton';
import { Cart, ChevronLeft, ChevronRight, Flame } from '@/components/icons';
import { getPlan, listRecipes } from '@/lib/db';
import { DAY_ABBR, dayDate, isCurrentWeek, isValidWeekStart, shiftWeek, toISODate, weekLabel, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export default async function WeekBoardPage({ searchParams }) {
  const params = await searchParams;
  const weekStart = isValidWeekStart(params?.week) ? params.week : weekStartOf();
  const plan = getPlan(weekStart);
  const byDay = new Map(plan.map((p) => [p.day, p]));
  const todayISO = toISODate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));

  const days = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const entry = byDay.get(day) || null;
    return {
      day,
      abbr: DAY_ABBR[day],
      dateNum: dayDate(weekStart, day).getUTCDate(),
      isToday: toISODate(dayDate(weekStart, day)) === todayISO,
      entry: entry && {
        kind: entry.kind,
        note: entry.note,
        recipe: entry.recipe && {
          id: entry.recipe.id,
          title: entry.recipe.title,
          totalMin: entry.recipe.totalMin,
          servings: entry.recipe.servings,
          tags: entry.recipe.tags,
        },
      },
    };
  });

  const recipes = listRecipes().map((r) => ({
    id: r.id,
    title: r.title,
    totalMin: r.totalMin,
    servings: r.servings,
    tags: r.tags,
  }));

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Week Board</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h1 className="page-title">{weekLabel(weekStart)}</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link className="icon-btn" href={`/?week=${shiftWeek(weekStart, -1)}`} aria-label="Previous week">
                <ChevronLeft size={14} />
              </Link>
              <Link className="icon-btn" href={`/?week=${shiftWeek(weekStart, 1)}`} aria-label="Next week">
                <ChevronRight size={14} />
              </Link>
            </div>
            {!isCurrentWeek(weekStart) && (
              <Link href="/" className="mono-hint" style={{ textDecoration: 'underline' }}>
                back to this week
              </Link>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CopyWeekButton weekStart={weekStart} />
          <Link className="btn btn-ink" href={`/market?week=${weekStart}`}>
            <Cart size={15} />
            <span>Build market list</span>
          </Link>
        </div>
      </header>

      <Board weekStart={weekStart} days={days} recipes={recipes} />

      <div className="board-hint">
        <Flame size={14} />
        <span className="mono-hint">Drag a dinner to another day · click an empty slot to plan it · everything lands on the market list</span>
      </div>
    </>
  );
}
