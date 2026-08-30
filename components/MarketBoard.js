'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CopyIcon, Plus, Printer, X } from '@/components/icons';

const AISLE_CLASS = {
  produce: 'aisle-produce',
  'meat & fish': 'aisle-meat',
  'dairy & eggs': 'aisle-dairy',
  bakery: 'aisle-pantry',
  frozen: 'aisle-dairy',
  pantry: 'aisle-pantry',
  'spice rail': 'aisle-spice',
  staples: 'aisle-other',
};

const STAPLE_SUGGESTIONS = ['milk', 'eggs', 'bread', 'bananas', 'coffee', 'butter', 'yogurt'];

export default function MarketBoard({ weekStart, weekLabel, dinnerCount, groups, initialChecks, initialExtras }) {
  const [checked, setChecked] = useState(() => new Set(initialChecks));
  const [extras, setExtras] = useState(initialExtras);
  const [customExtra, setCustomExtra] = useState('');
  const [copied, setCopied] = useState(false);

  const shoppable = useMemo(() => groups.filter((g) => g.aisle !== 'spice rail'), [groups]);
  const spiceRail = useMemo(() => groups.find((g) => g.aisle === 'spice rail'), [groups]);
  const totalItems = shoppable.reduce((n, g) => n + g.items.length, 0) + extras.length;
  const aisleCount = shoppable.filter((g) => g.items.length > 0).length + (extras.length ? 1 : 0);
  const doneCount = [...checked].filter(
    (k) =>
      shoppable.some((g) => g.items.some((it) => it.key === k)) ||
      extras.some((e) => `extra:${e.id}` === k),
  ).length;

  async function post(body) {
    await fetch('/api/market', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart, ...body }),
    });
  }

  function toggle(key) {
    const isNowChecked = !checked.has(key);
    setChecked((prev) => {
      const next = new Set(prev);
      if (isNowChecked) next.add(key);
      else next.delete(key);
      return next;
    });
    post({ op: 'check', itemKey: key, checked: isNowChecked });
  }

  async function addExtra(label) {
    const clean = label.trim();
    if (!clean) return;
    setCustomExtra('');
    const res = await fetch('/api/market', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart, op: 'addExtra', label: clean }),
    });
    const data = await res.json();
    if (data?.extra) setExtras((prev) => [...prev, data.extra]);
  }

  function removeExtra(id) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
    post({ op: 'removeExtra', id });
  }

  function copyAsText() {
    const lines = [`MARKET LIST · ${weekLabel.toUpperCase()}`];
    for (const g of shoppable) {
      if (!g.items.length) continue;
      lines.push('', g.aisle.toUpperCase());
      for (const it of g.items) {
        lines.push(`  [${checked.has(it.key) ? 'x' : ' '}] ${it.qty ? `${it.qty} ` : ''}${it.item}`);
      }
    }
    if (extras.length) {
      lines.push('', 'STAPLES & EXTRAS');
      for (const e of extras) lines.push(`  [${checked.has(`extra:${e.id}`) ? 'x' : ' '}] ${e.label}`);
    }
    if (spiceRail?.items.length) {
      lines.push('', 'CHECK THE SPICE RAIL', `  ${spiceRail.items.map((i) => i.item).join(' · ')}`);
    }
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Market List · week of {weekLabel}</span>
          <h1 className="page-title">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}, {aisleCount} {aisleCount === 1 ? 'aisle' : 'aisles'}
          </h1>
          <span className="page-sub">
            {dinnerCount > 0
              ? `Built from ${dinnerCount} planned ${dinnerCount === 1 ? 'dinner' : 'dinners'} · duplicates merged, units combined`
              : 'Nothing planned yet — put dinners on the board and the list builds itself.'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => window.print()}>
            <Printer size={15} />
            <span>Print receipt</span>
          </button>
          <button className="btn" onClick={copyAsText}>
            <CopyIcon size={15} />
            <span>{copied ? 'Copied!' : 'Copy as text'}</span>
          </button>
        </div>
      </header>

      {dinnerCount === 0 && totalItems === 0 ? (
        <div className="card" style={{ padding: 24, maxWidth: 480 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            The market list is forged from the <Link href="/">Week Board</Link>. Plan a few dinners and every
            ingredient lands here — merged, measured, and sorted by aisle.
          </p>
        </div>
      ) : (
        <div className="market-grid">
          {shoppable.map((g) =>
            g.items.length ? (
              <section key={g.aisle} className="card aisle-card">
                <div className="aisle-head">
                  <span className={`aisle-name ${AISLE_CLASS[g.aisle] || 'aisle-other'}`}>{g.aisle}</span>
                  <span className="aisle-count">
                    {g.items.length} {g.items.length === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {g.items.map((it) => (
                    <button key={it.key} className={`mk-row${checked.has(it.key) ? ' done' : ''}`} onClick={() => toggle(it.key)}>
                      <span className="mk-box">{checked.has(it.key) && <Check size={10} stroke="#FDF9F0" />}</span>
                      <span className="mk-qty">{it.qty || ''}</span>
                      <span className="mk-label">{it.item}</span>
                      {it.sources.length > 1 && <span className="mk-srcs">{it.sources.length} recipes</span>}
                    </button>
                  ))}
                </div>
              </section>
            ) : null,
          )}

          <section className="card aisle-card staples-card">
            <div className="aisle-head">
              <span className="aisle-name aisle-other">Staples & extras</span>
              <span className="aisle-count">ONE TAP TO ADD</span>
            </div>
            {extras.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {extras.map((e) => {
                  const key = `extra:${e.id}`;
                  return (
                    <span key={e.id} className={`mk-row${checked.has(key) ? ' done' : ''}`} style={{ display: 'flex' }}>
                      <button className="mk-box" onClick={() => toggle(key)} aria-label={`Check ${e.label}`}>
                        {checked.has(key) && <Check size={10} stroke="#FDF9F0" />}
                      </button>
                      <span className="mk-label" style={{ cursor: 'pointer' }} onClick={() => toggle(key)}>{e.label}</span>
                      <button className="mk-remove" onClick={() => removeExtra(e.id)} aria-label={`Remove ${e.label}`}>
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {STAPLE_SUGGESTIONS.filter((s) => !extras.some((e) => e.label === s)).map((s) => (
                <button key={s} className="staple-chip" onClick={() => addExtra(s)}>
                  <Plus size={11} />
                  <span>{s}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Add anything…"
                value={customExtra}
                onChange={(e) => setCustomExtra(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExtra(customExtra)}
                style={{ flex: 1, padding: '8px 10px', fontSize: 13 }}
              />
              <button className="btn" onClick={() => addExtra(customExtra)} style={{ padding: '8px 12px' }}>
                Add
              </button>
            </div>
          </section>

          {spiceRail && spiceRail.items.length > 0 && (
            <section className="card aisle-card">
              <div className="aisle-head">
                <span className="aisle-name aisle-spice">Spice rail</span>
                <span className="aisle-count">CHECK THE CUPBOARD FIRST</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {spiceRail.items.map((it) => (
                  <button
                    key={it.key}
                    className="staple-chip"
                    onClick={() => toggle(it.key)}
                    style={
                      checked.has(it.key)
                        ? { textDecoration: 'line-through', color: 'var(--ash)', background: 'var(--recess)' }
                        : undefined
                    }
                  >
                    {it.item}
                  </button>
                ))}
              </div>
              <span className="mono-hint">Tap what you already have — the rest is shopping.</span>
            </section>
          )}

          <section className="card aisle-card no-print" style={{ borderBottom: 'none', borderRadius: '10px 10px 0 0', paddingBottom: 0 }}>
            <span className="mono-hint" style={{ textAlign: 'center' }}>Fare Forge · market receipt</span>
            <span className="mono" style={{ fontSize: 11, textAlign: 'center', color: 'var(--ink-soft)' }}>
              {totalItems} ITEMS · {aisleCount} AISLES · {dinnerCount} DINNERS · {doneCount} IN THE CART
            </span>
            <svg className="receipt-zigzag" height="10" viewBox="0 0 264 10" preserveAspectRatio="none">
              <path
                d="M0 0 L11 10 L22 0 L33 10 L44 0 L55 10 L66 0 L77 10 L88 0 L99 10 L110 0 L121 10 L132 0 L143 10 L154 0 L165 10 L176 0 L187 10 L198 0 L209 10 L220 0 L231 10 L242 0 L253 10 L264 0"
                fill="none"
                stroke="#24201A"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </section>
        </div>
      )}
    </>
  );
}
