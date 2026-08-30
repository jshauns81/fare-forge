'use client';

import { useMemo, useState } from 'react';
import { Check, Minus, Plus } from '@/components/icons';
import { parseIngredient, scaledQtyText } from '@/lib/ingredients';

export default function IngredientPanel({ ingredients, baseServings }) {
  const [servings, setServings] = useState(baseServings || null);
  const [done, setDone] = useState(() => new Set());

  const factor = baseServings && servings ? servings / baseServings : 1;
  const parsed = useMemo(() => ingredients.map((raw) => parseIngredient(raw)), [ingredients]);

  function toggle(i) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="ing-col">
      <div className="card ing-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="kicker">Ingredients · {ingredients.length}</span>
          {baseServings ? (
            <span className="serves-ctl">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer servings">
                <Minus size={13} />
              </button>
              <span className="mono">SERVES {servings}</span>
              <button onClick={() => setServings((s) => Math.min(24, s + 1))} aria-label="More servings">
                <Plus size={13} />
              </button>
            </span>
          ) : (
            <span className="mono-hint">tap to check off</span>
          )}
        </div>

        <div className="ing-list">
          {parsed.map((p, i) => {
            const qty = scaledQtyText(p, factor); // includes the unit when there is one
            const isDone = done.has(i);
            return (
              <button key={i} className={`ing-row${isDone ? ' done' : ''}`} onClick={() => toggle(i)}>
                <span className="ing-qty">{qty ?? '—'}</span>
                <span className="ing-text">
                  {p.item || p.raw}
                  {p.note ? <span style={{ color: 'var(--ash-deep)' }}> — {p.note}</span> : null}
                </span>
                {isDone && <Check size={13} stroke="#5F7F4C" style={{ flex: 'none', alignSelf: 'center' }} />}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 11 }}>
          <span className="mono-hint">
            {baseServings && servings !== baseServings
              ? `Scaled ×${(servings / baseServings).toFixed(2).replace(/\.?0+$/, '')} from serves ${baseServings}`
              : 'Tap a line to check it off as you cook'}
          </span>
        </div>
      </div>
    </div>
  );
}
