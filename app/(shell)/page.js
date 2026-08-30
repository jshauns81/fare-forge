import Link from 'next/link';
import Board from '@/components/Board';
import CopyWeekButton from '@/components/CopyWeekButton';
import { Cart, ChevronLeft, ChevronRight, Flame } from '@/components/icons';
import { getPlan, listRecipes } from '@/lib/db';
import { DAY_ABBR, dayDate, isCurrentWeek, isValidWeekStart, relativeWeekName, shiftWeek, spanLabel, toISODate, weekLabel, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export default async function WeekBoardPage({ searchParams }) {
  const params = await searchParams;
  const weekStart = isValidWeekStart(params?.week) ? params.week : weekStartOf();
  const span = params?.span === '1' ? 1 : 2; // fortnight is the default
  const todayISO = toISODate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));

  const weeks = Array.from({ length: span }, (_, i) => {
    const ws = shiftWeek(weekStart, i);
    const byDay = new Map(getPlan(ws).map((p) => [p.day, p]));
    return {
      weekStart: ws,
      dates: weekLabel(ws),
      rel: relativeWeekName(ws),
      days: [0, 1, 2, 3, 4, 5, 6].map((day) => {
        const entry = byDay.get(day) || null;
        return {
          day,
          abbr: DAY_ABBR[day],
          dateNum: dayDate(ws, day).getUTCDate(),
          isToday: toISODate(dayDate(ws, day)) === todayISO,
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
      }),
    };
  });

  const recipes = listRecipes().map((r) => ({
    id: r.id,
    title: r.title,
    totalMin: r.totalMin,
    servings: r.servings,
    tags: r.tags,
  }));

  const dinnersSet = weeks.reduce((n, w) => n + w.days.filter((d) => d.entry).length, 0);

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Week Board{span === 2 ? ' · two weeks' : ''}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h1 className="page-title">{spanLabel(weekStart, span)}</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link
                className="icon-btn"
                href={`/?week=${shiftWeek(weekStart, -span)}&span=${span}`}
                aria-label={span === 2 ? 'Previous two weeks' : 'Previous week'}
              >
                <ChevronLeft size={14} />
              </Link>
              <Link
                className="icon-btn"
                href={`/?week=${shiftWeek(weekStart, span)}&span=${span}`}
                aria-label={span === 2 ? 'Next two weeks' : 'Next week'}
              >
                <ChevronRight size={14} />
              </Link>
            </div>
            <div className="seg-toggle">
              <Link href={`/?week=${weekStart}&span=1`} className={span === 1 ? 'active' : ''}>1 week</Link>
              <Link href={`/?week=${weekStart}&span=2`} className={span === 2 ? 'active' : ''}>2 weeks</Link>
            </div>
            {!isCurrentWeek(weekStart) && (
              <Link href={`/?span=${span}`} className="mono-hint" style={{ textDecoration: 'underline' }}>
                back to today
              </Link>
            )}
          </div>
          <span className="page-sub">{dinnersSet} of {span * 7} dinners set</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CopyWeekButton weekStart={weekStart} span={span} />
          <Link className="btn btn-ink" href={`/market?week=${weekStart}&span=${span}`}>
            <Cart size={15} />
            <span>Build market list</span>
          </Link>
        </div>
      </header>

      <Board weeks={weeks} recipes={recipes} showWeekHeads={span > 1} />

      <div className="board-hint">
        <Flame size={14} />
        <span className="mono-hint">Drag a dinner to any day — either week · click an empty slot to plan it · everything lands on the market list</span>
      </div>
    </>
  );
}
