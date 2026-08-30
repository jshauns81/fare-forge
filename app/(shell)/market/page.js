import MarketBoard from '@/components/MarketBoard';
import { getChecks, getExtras, getPlan } from '@/lib/db';
import { buildMarketList } from '@/lib/ingredients';
import { isValidWeekStart, shiftWeek, spanLabel, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Market List' };

export default async function MarketPage({ searchParams }) {
  const params = await searchParams;
  const weekStart = isValidWeekStart(params?.week) ? params.week : weekStartOf();
  const span = params?.span === '1' ? 1 : 2; // shop for the fortnight by default

  const entries = [];
  let dinnerCount = 0;
  for (let i = 0; i < span; i++) {
    const planned = getPlan(shiftWeek(weekStart, i)).filter((p) => p.recipe);
    dinnerCount += planned.length;
    for (const p of planned) {
      for (const ing of p.recipe.ingredients) entries.push({ raw: ing.raw, recipeTitle: p.recipe.title });
    }
  }
  const groups = buildMarketList(entries);

  // One shopping trip per period: checks and extras anchor on the first week.
  const checks = getChecks(weekStart);
  const extras = getExtras(weekStart);

  return (
    <MarketBoard
      weekStart={weekStart}
      periodLabel={spanLabel(weekStart, span)}
      span={span}
      dinnerCount={dinnerCount}
      groups={groups}
      initialChecks={checks}
      initialExtras={extras}
    />
  );
}
