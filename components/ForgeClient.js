'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Box, Check, ChevronLeft, FlameBase, LinkIcon, Spinner } from '@/components/icons';
import { DAY_ABBR } from '@/lib/weeks';

const PENDING_LINES = [
  'Reaching the page…',
  'Looking for the recipe in the markup…',
  'Burning off ads, popups & backstory…',
];

// Week anchors come from the server so "this week" means the same thing
// here as on the board, whatever timezone the browser is in.
export default function ForgeClient({ weekStart, nextWeekStart }) {
  const [mode, setMode] = useState('link'); // link | text
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState('drop'); // drop | smelt | done | error
  const [report, setReport] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [planned, setPlanned] = useState(null);
  const [pendingStep, setPendingStep] = useState(0);
  const timerRef = useRef(null);

  async function forge() {
    if (!value.trim()) return;
    setPhase('smelt');
    setReport([]);
    setError(null);
    setResult(null);
    setPlanned(null);
    setPendingStep(0);
    timerRef.current = setInterval(() => {
      setPendingStep((s) => Math.min(s + 1, PENDING_LINES.length - 1));
    }, 900);

    let res, data;
    try {
      res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'link' ? { url: value.trim() } : { text: value }),
      });
      data = await res.json();
    } catch {
      data = { error: 'The Forge could not be reached. Is the app still running?' };
    }
    clearInterval(timerRef.current);

    if (!res?.ok || data?.error) {
      setError({ message: data?.error || 'Something went wrong.', hint: data?.hint || null });
      setPhase('error');
      return;
    }
    setReport(data.report || []);
    setResult(data.recipe);
    setPhase('done');
  }

  async function planIt(day, weekOffset) {
    const week = weekOffset === 1 ? nextWeekStart : weekStart;
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'set', weekStart: week, day, recipeId: result.id }),
    });
    setPlanned({ day, weekOffset });
  }

  function reset() {
    setPhase('drop');
    setValue('');
    setResult(null);
    setError(null);
    setPlanned(null);
  }

  return (
    <div className="forge-screen">
      <div className="forge-top">
        <Link href="/" className="forge-back">
          <ChevronLeft size={15} />
          <span>Back to the Week Board</span>
        </Link>
        <span className="mono-hint" style={{ color: '#7A6F5F' }}>Pinterest pins · food blogs · pasted text</span>
      </div>

      <div className="forge-title-wrap">
        <h1 className="forge-title">
          <FlameBase size={34} stroke="#C7521F" />
          <span>The Forge</span>
        </h1>
        <p className="forge-sub" style={{ margin: 0 }}>
          Paste any recipe link — it comes out just the ingredients and the way.
        </p>
      </div>

      <div className="forge-stage">
        {phase === 'drop' && (
          <div className="forge-card">
            <span className="forge-step-label">01 — Drop a link</span>
            <h2 className="forge-h2">What are we making?</h2>
            <div className="forge-toggle">
              <button className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}>Link</button>
              <button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Pasted text</button>
            </div>
            {mode === 'link' ? (
              <input
                autoFocus
                placeholder="https://www.pinterest.com/pin/…  or any recipe page"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && forge()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
              />
            ) : (
              <textarea
                autoFocus
                rows={8}
                placeholder={'Paste the whole page — title, ingredients, instructions.\nThe Forge picks the recipe out of anything.'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            <button className="btn btn-ember" onClick={forge} disabled={!value.trim()} style={{ fontSize: 15, padding: '11px 14px' }}>
              <FlameBase size={16} stroke="#FDF9F0" />
              <span>Forge it</span>
            </button>
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono-hint">If a site blocks robots</span>
              <span style={{ fontSize: 12.5, color: 'var(--ash-deep)', lineHeight: 1.5 }}>
                Switch to “Pasted text”, copy the whole page from your browser, and drop it in.
              </span>
            </div>
          </div>
        )}

        {phase === 'smelt' && (
          <div className="forge-card forge-card-dark">
            <span className="forge-step-label">02 — Smelting</span>
            <h2 className="forge-h2">Burning off the nonsense</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {PENDING_LINES.slice(0, pendingStep + 1).map((line, i) => (
                <div key={line} className="smelt-line">
                  {i < pendingStep ? <Check size={14} stroke="#7FA96B" /> : <Spinner size={14} stroke="#E08A5F" />}
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${30 + pendingStep * 30}%` }} />
              </div>
              <span className="mono-hint" style={{ color: '#7A6F5F' }}>Usually under a few seconds</span>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="forge-card">
            <span className="forge-step-label" style={{ color: 'var(--ember-deep)' }}>The forge went cold</span>
            <h2 className="forge-h2">{error.message}</h2>
            {error.hint && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ash-deep)', lineHeight: 1.55 }}>{error.hint}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ink" onClick={() => setPhase('drop')}>Try again</button>
              <button className="btn" onClick={() => { setMode('text'); setValue(''); setPhase('drop'); }}>Paste text instead</button>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="forge-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span className="forge-step-label">03 — Forged</span>
              {result.strip?.trimmedPct > 0 && <span className="badge-trim">{result.strip.trimmedPct}% trimmed</span>}
            </div>
            <h2 className="forge-h2" style={{ fontSize: 23 }}>{result.title}</h2>
            <span className="mono-hint">
              {result.ingredients.length} ingredients · {result.steps.length} steps
              {result.totalMin ? ` · ${result.totalMin} min` : ''}
              {result.servings ? ` · serves ${result.servings}` : ''}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--recess)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px' }}>
              {report.map((line) => (
                <div key={line} className="smelt-line" style={{ color: 'var(--ink-soft)' }}>
                  <Check size={14} stroke="#5F7F4C" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="mono-hint">
                {planned != null
                  ? `On the board — ${DAY_ABBR[planned.day]}${planned.weekOffset === 1 ? ' next week' : ''}`
                  : 'Plan it — this week or next'}
              </span>
              {[0, 1].map((weekOffset) => (
                <div key={weekOffset} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="mono-hint" style={{ fontSize: 9.5, minWidth: 40 }}>{weekOffset === 0 ? 'THIS' : 'NEXT'}</span>
                  {DAY_ABBR.map((abbr, day) => {
                    const isPicked = planned?.day === day && planned?.weekOffset === weekOffset;
                    return (
                      <button
                        key={abbr}
                        className="staple-chip"
                        aria-label={`${abbr}${weekOffset === 1 ? ' next week' : ' this week'}`}
                        style={isPicked ? { background: 'var(--ember)', color: 'var(--parchment)', borderColor: 'var(--ember-deep)' } : undefined}
                        onClick={() => planIt(day, weekOffset)}
                      >
                        {isPicked ? <Check size={11} /> : null}
                        {abbr}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-ink" href={`/recipes/${result.id}`}>
                <Box size={15} />
                <span>Open the recipe</span>
              </Link>
              <button className="btn" onClick={reset}>
                <LinkIcon size={15} />
                <span>Forge another</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="forge-footer">
        Extractor order: schema.org JSON-LD → microdata → readability heuristics · nothing kept but the recipe
      </div>
    </div>
  );
}
