import MarketBoard from '@/components/MarketBoard';
import { getChecks, getExtras, getPlan } from '@/lib/db';
import { buildMarketList } from '@/lib/ingredients';
import { isValidWeekStart, weekLabel, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Market List' };

export default async function MarketPage({ searchParams }) {
  const params = await searchParams;
  const weekStart = isValidWeekStart(params?.week) ? params.week : weekStartOf();

  const plan = getPlan(weekStart);
  const planned = plan.filter((p) => p.recipe);
  const entries = [];
  for (const p of planned) {
    for (const ing of p.recipe.ingredients) entries.push({ raw: ing.raw, recipeTitle: p.recipe.title });
  }
  const groups = buildMarketList(entries);
  const checks = getChecks(weekStart);
  const extras = getExtras(weekStart);

  return (
    <MarketBoard
      weekStart={weekStart}
      weekLabel={weekLabel(weekStart)}
      dinnerCount={planned.length}
      groups={groups}
      initialChecks={checks}
      initialExtras={extras}
    />
  );
}
