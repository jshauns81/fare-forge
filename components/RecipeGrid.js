'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash } from '@/components/icons';

function minutesLabel(min) {
  if (min == null) return null;
  if (min >= 90) {
    const h = Math.round(min / 30) / 2;
    return `${h} hr${h !== 1 ? 's' : ''}`;
  }
  return `${min} min`;
}

export default function RecipeGrid({ recipes }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.tags?.some((t) => t.includes(needle)) ||
        (r.sourceSite || '').toLowerCase().includes(needle),
    );
  }, [q, recipes]);

  async function remove(id, title) {
    if (!confirm(`Toss “${title}” out of the Recipe Box? Planned days using it will be cleared too.`)) return;
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <>
      <input
        className="search-input"
        placeholder="Search by name, tag, or source…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="mono-hint">Nothing matches — try another word, or forge something new.</p>
      ) : (
        <div className="recipe-grid">
          {filtered.map((r) => (
            <div key={r.id} className="recipe-card">
              <Link href={`/recipes/${r.id}`} className="recipe-card-title" style={{ color: 'inherit' }}>
                {r.title}
              </Link>
              <span className="recipe-card-src">
                {r.sourceSite || 'pasted text'} · {r.ingredientCount} ing · {r.stepCount} steps
              </span>
              <span className="meal-meta">
                {[minutesLabel(r.totalMin), r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(' · ') || '—'}
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto' }}>
                {r.trimmedPct != null && r.trimmedPct > 0 && <span className="badge-trim">{r.trimmedPct}% trimmed</span>}
                {r.tags?.slice(0, 2).map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </span>
              <button
                onClick={() => remove(r.id, r.title)}
                aria-label={`Delete ${r.title}`}
                style={{ position: 'absolute', top: 12, right: 12, color: 'var(--ash)' }}
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
