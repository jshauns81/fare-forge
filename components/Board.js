'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Redo, X } from '@/components/icons';

const NOTE_PRESETS = ['Leftovers', 'Eating out', 'Takeout night', 'Fend for yourself'];

function minutesLabel(min) {
  if (min == null) return null;
  if (min >= 90) {
    const h = Math.round(min / 30) / 2;
    return `${h} hr${h !== 1 ? 's' : ''}`;
  }
  return `${min} min`;
}

export default function Board({ weeks, recipes, showWeekHeads = false }) {
  const router = useRouter();
  const [picker, setPicker] = useState(null); // { weekStart, day, abbr }
  const [dropKey, setDropKey] = useState(null); // `${weekStart}:${day}`
  const [busy, setBusy] = useState(false);

  async function call(body) {
    setBusy(true);
    try {
      await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(e, weekStart, day) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ week: weekStart, day }));
  }

  function onDrop(e, toWeek, toDay) {
    e.preventDefault();
    setDropKey(null);
    let from;
    try {
      from = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (!from || typeof from.week !== 'string' || !Number.isInteger(from.day)) return;
    if (from.week === toWeek && from.day === toDay) return;
    call({ op: 'move', fromWeek: from.week, fromDay: from.day, toWeek, toDay });
  }

  return (
    <>
      <div className="fortnight">
        {weeks.map((w) => (
          <section key={w.weekStart} className="week-sec" data-week={w.weekStart}>
            {showWeekHeads && (
              <div className="week-sec-head">
                <span className="week-sec-name">{w.rel || `Week of ${w.dates}`}</span>
                {w.rel && <span className="week-sec-dates">{w.dates}</span>}
                <span className="week-sec-rule" />
                <span className="week-sec-dates">{w.days.filter((d) => d.entry).length} of 7 set</span>
              </div>
            )}
            <div className="board">
              {w.days.map(({ day, abbr, dateNum, isToday, entry }) => {
                const key = `${w.weekStart}:${day}`;
                return (
                  <div
                    key={key}
                    className={`day-col${day >= 5 ? ' weekend' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropKey(key);
                    }}
                    onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
                    onDrop={(e) => onDrop(e, w.weekStart, day)}
                  >
                    <div className="day-head">
                      <span className="day-name">{abbr}</span>
                      <span className="day-num">{dateNum}</span>
                      {isToday && <span className="day-today">TODAY</span>}
                    </div>

                    {entry && entry.kind === 'recipe' && entry.recipe ? (
                      <div className="meal-card" draggable onDragStart={(e) => onDragStart(e, w.weekStart, day)}>
                        <Link href={`/recipes/${entry.recipe.id}`} className="meal-title" style={{ display: 'block' }}>
                          {entry.recipe.title}
                        </Link>
                        <span className="meal-meta">
                          {[minutesLabel(entry.recipe.totalMin), entry.recipe.servings ? `serves ${entry.recipe.servings}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'forged recipe'}
                        </span>
                        {entry.recipe.tags?.length > 0 && (
                          <span className="meal-tags">
                            {entry.recipe.tags.slice(0, 2).map((t) => (
                              <span key={t} className={`tag${t === 'kid pick' ? ' tag-leaf' : ''}`}>{t}</span>
                            ))}
                          </span>
                        )}
                        <button
                          className="meal-clear"
                          aria-label={`Clear ${abbr} ${dateNum}`}
                          disabled={busy}
                          onClick={() => call({ op: 'clear', weekStart: w.weekStart, day })}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : entry && entry.kind === 'note' ? (
                      <div className="note-card" draggable onDragStart={(e) => onDragStart(e, w.weekStart, day)}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Redo size={14} stroke="#8A7F70" />
                          <span className="meal-title">{entry.note}</span>
                        </span>
                        <button
                          className="meal-clear"
                          aria-label={`Clear ${abbr} ${dateNum}`}
                          disabled={busy}
                          onClick={() => call({ op: 'clear', weekStart: w.weekStart, day })}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`empty-slot${dropKey === key ? ' drop-target' : ''}`}
                        onClick={() => setPicker({ weekStart: w.weekStart, day, abbr, rel: w.rel })}
                        disabled={busy}
                        aria-label={`Plan ${abbr} ${dateNum}`}
                      >
                        <Plus size={17} />
                        <span className="empty-slot-label">Plan {abbr.charAt(0) + abbr.slice(1).toLowerCase()}</span>
                        <span className="mono-hint" style={{ fontSize: 9.5 }}>or drop a dinner here</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {picker != null && (
        <Picker
          heading={`Plan ${picker.abbr.charAt(0) + picker.abbr.slice(1).toLowerCase()}${picker.rel && picker.rel !== 'This week' ? ` · ${picker.rel.toLowerCase()}` : ''}`}
          recipes={recipes}
          onClose={() => setPicker(null)}
          onPickRecipe={(id) => {
            const { weekStart, day } = picker;
            setPicker(null);
            call({ op: 'set', weekStart, day, recipeId: id });
          }}
          onPickNote={(note) => {
            const { weekStart, day } = picker;
            setPicker(null);
            call({ op: 'set', weekStart, day, note });
          }}
        />
      )}
    </>
  );
}

function Picker({ heading, recipes, onClose, onPickRecipe, onPickNote }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return recipes;
    return recipes.filter(
      (r) => r.title.toLowerCase().includes(needle) || r.tags?.some((t) => t.includes(needle)),
    );
  }, [q, recipes]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{heading}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        <div className="modal-body">
          <input
            autoFocus
            placeholder="Search the Recipe Box…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="picker-note-row">
            {NOTE_PRESETS.map((n) => (
              <button key={n} className="staple-chip" onClick={() => onPickNote(n)}>
                {n}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mono-hint" style={{ margin: '8px 0' }}>
              Nothing in the box matches — forge a new recipe from a link
            </p>
          ) : (
            filtered.map((r) => (
              <button key={r.id} className="picker-row" onClick={() => onPickRecipe(r.id)}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="picker-row-title">{r.title}</span>
                  <span className="picker-row-meta">
                    {[minutesLabel(r.totalMin), r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
