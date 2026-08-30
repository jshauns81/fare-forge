import Link from 'next/link';
import NavLinks from '@/components/NavLinks';
import { FlameBase, LinkIcon } from '@/components/icons';
import { countRecipes, getPlan, getExtras } from '@/lib/db';
import { buildMarketList } from '@/lib/ingredients';
import { shiftWeek, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// The family plans a fortnight at a time: stats cover this week + next.
function fortnightStats() {
  const w0 = weekStartOf();
  const weeks = [w0, shiftWeek(w0, 1)];
  const daySets = [];
  const entries = [];
  for (const ws of weeks) {
    const plan = getPlan(ws);
    daySets.push(new Set(plan.map((p) => p.day)));
    for (const p of plan) {
      if (p.recipe) for (const ing of p.recipe.ingredients) entries.push({ raw: ing.raw, recipeTitle: p.recipe.title });
    }
  }
  const marketCount =
    buildMarketList(entries).reduce((n, g) => n + g.items.length, 0) + getExtras(w0).length;
  return { daySets, dinners: daySets[0].size + daySets[1].size, marketCount };
}

export default function ShellLayout({ children }) {
  const { daySets, dinners, marketCount } = fortnightStats();
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
          <span className="sidebar-stat-label">NEXT TWO WEEKS</span>
          <span className="sidebar-stat-value">{dinners} of 14 dinners set</span>
          {daySets.map((set, w) => (
            <div className="week-ticks" key={w}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <span key={d} className={`week-tick${set.has(d) ? ' set' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
