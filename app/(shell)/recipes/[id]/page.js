import Link from 'next/link';
import { notFound } from 'next/navigation';
import IngredientPanel from '@/components/IngredientPanel';
import PlanItMenu from '@/components/PlanItMenu';
import { ChevronLeft, External, Scissors } from '@/components/icons';
import { getPlan, getRecipe } from '@/lib/db';
import { DAY_NAMES, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export default async function RecipePage({ params }) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) notFound();

  const weekStart = weekStartOf();
  const plannedEntry = getPlan(weekStart).find((p) => p.recipe?.id === recipe.id);
  const plannedDay = plannedEntry ? DAY_NAMES[plannedEntry.day] : null;

  const trim = recipe.strip;

  return (
    <div className="recipe-page" style={{ gap: 0 }}>
      <div className="recipe-topbar">
        <Link href="/recipes" className="forge-back" style={{ color: 'var(--ash-deep)' }}>
          <ChevronLeft size={15} />
          <span>Recipe Box</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {trim && trim.trimmedPct > 0 && (
            <span className="badge-trim">
              <Scissors size={12} />
              {trim.trimmedPct}% trimmed · {trim.removedWords.toLocaleString('en-US')} words removed
            </span>
          )}
          {recipe.sourceUrl ? (
            <a className="src-chip" href={recipe.sourceUrl} target="_blank" rel="noreferrer noopener">
              <span>via {recipe.sourceSite}</span>
              <External size={12} />
            </a>
          ) : (
            <span className="src-chip">{recipe.sourceSite || 'pasted text'}</span>
          )}
        </div>
      </div>

      <div className="recipe-title-block">
        <h1 className="recipe-title">{recipe.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {recipe.prepMin != null && <span className="meta-chip">Prep {recipe.prepMin} min</span>}
          {recipe.cookMin != null && <span className="meta-chip">Cook {recipe.cookMin} min</span>}
          {recipe.totalMin != null && recipe.prepMin == null && recipe.cookMin == null && (
            <span className="meta-chip">{recipe.totalMin} min</span>
          )}
          {recipe.tags?.map((t) => (
            <span key={t} className="tag" style={{ padding: '5px 8px' }}>{t}</span>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <PlanItMenu recipeId={recipe.id} plannedDay={plannedDay} weekStart={weekStart} />
          </div>
        </div>
      </div>

      <div className="recipe-cols">
        <IngredientPanel
          ingredients={recipe.ingredients.map((i) => i.raw)}
          baseServings={recipe.servings}
        />

        <div className="steps-col">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="kicker">The way · {recipe.steps.length} steps</span>
          </div>
          {recipe.steps.map((step, i) => (
            <div key={i} className="step-row">
              <span className="step-num">{i + 1}</span>
              <p className="step-text" style={{ margin: 0 }}>{step}</p>
            </div>
          ))}
          {trim && trim.originalWords > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 8 }}>
              <span className="mono-hint">
                Forged from {trim.originalWords.toLocaleString('en-US')} words → {trim.keptWords.toLocaleString('en-US')}
                {recipe.sourceUrl ? ' · original always one click away' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
