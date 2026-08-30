import Link from 'next/link';
import NavLinks from '@/components/NavLinks';
import { FlameBase, LinkIcon } from '@/components/icons';
import { countRecipes, getPlan, getExtras } from '@/lib/db';
import { buildMarketList } from '@/lib/ingredients';
import { weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

function currentWeekStats() {
  const weekStart = weekStartOf();
  const plan = getPlan(weekStart);
  const dinnersSet = new Set(plan.map((p) => p.day));
  const entries = [];
  for (const p of plan) {
    if (p.recipe) for (const ing of p.recipe.ingredients) entries.push({ raw: ing.raw, recipeTitle: p.recipe.title });
  }
  const marketCount =
    buildMarketList(entries).reduce((n, g) => n + g.items.length, 0) + getExtras(weekStart).length;
  return { dinnersSet, marketCount };
}

export default function ShellLayout({ children }) {
  const { dinnersSet, marketCount } = currentWeekStats();
  const counts = { recipes: countRecipes(), market: marketCount };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">
          <span className="wordmark-glyph">
            <FlameBase size={19} stroke="#C7521F" />
          </span>
          <span className="wordmark-text">FARE<br />FORGE</span>
        </Link>

        <NavLinks counts={counts} />

        <Link href="/forge" className="forge-cta">
          <LinkIcon size={15} />
          <span>Forge a recipe</span>
        </Link>

        <div className="sidebar-stat">
          <span className="sidebar-stat-label">THIS WEEK</span>
          <span className="sidebar-stat-value">{dinnersSet.size} of 7 dinners set</span>
          <div className="week-ticks">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <span key={d} className={`week-tick${dinnersSet.has(d) ? ' set' : ''}`} />
            ))}
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
