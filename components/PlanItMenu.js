'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Board } from '@/components/icons';
import { DAY_ABBR, shiftWeek } from '@/lib/weeks';

export default function PlanItMenu({ recipeId, plannedLabel, weekStart }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function planIt(week, day) {
    setBusy(true);
    try {
      await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'set', weekStart: week, day, recipeId }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-ink" onClick={() => setOpen(true)}>
        <Board size={15} />
        <span>{plannedLabel ? `On the board · ${plannedLabel}` : 'Put it on the board'}</span>
      </button>
    );
  }

  const rows = [
    { label: 'This week', week: weekStart },
    { label: 'Next week', week: shiftWeek(weekStart, 1) },
  ];

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {rows.map(({ label, week }) => (
        <span key={week} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="mono-hint" style={{ fontSize: 9.5, minWidth: 74, textAlign: 'right' }}>{label.toUpperCase()}</span>
          {DAY_ABBR.map((abbr, day) => (
            <button
              key={abbr}
              className="staple-chip"
              disabled={busy}
              onClick={() => planIt(week, day)}
              aria-label={`${abbr} ${label.toLowerCase()}`}
            >
              {abbr}
            </button>
          ))}
        </span>
      ))}
      <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ fontSize: 12.5 }}>
        cancel
      </button>
    </span>
  );
}
