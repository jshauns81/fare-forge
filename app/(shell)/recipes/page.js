import Link from 'next/link';
import RecipeGrid from '@/components/RecipeGrid';
import { LinkIcon } from '@/components/icons';
import { listRecipes } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Recipe Box' };

export default function RecipeBoxPage() {
  const recipes = listRecipes().map((r) => ({
    id: r.id,
    title: r.title,
    sourceSite: r.sourceSite,
    totalMin: r.totalMin,
    servings: r.servings,
    tags: r.tags,
    trimmedPct: r.strip?.trimmedPct ?? null,
    ingredientCount: r.ingredients.length,
    stepCount: r.steps.length,
  }));

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Recipe Box</span>
          <h1 className="page-title">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}, forged clean
          </h1>
          <span className="page-sub">Every one stripped to ingredients and the way — sources credited, originals a click away.</span>
        </div>
        <Link className="btn btn-ember" href="/forge">
          <LinkIcon size={15} />
          <span>Forge a recipe</span>
        </Link>
      </header>

      <RecipeGrid recipes={recipes} />
    </>
  );
}
