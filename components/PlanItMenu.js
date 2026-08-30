'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Board, Check } from '@/components/icons';
import { DAY_ABBR } from '@/lib/weeks';

export default function PlanItMenu({ recipeId, plannedDay, weekStart }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function planIt(day) {
    setBusy(true);
    try {
      await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'set', weekStart, day, recipeId }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (plannedDay && !open) {
    return (
      <button className="btn btn-ink" onClick={() => setOpen(true)}>
        <Board size={15} />
        <span>On the board · {plannedDay}</span>
      </button>
    );
  }

  return open ? (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {DAY_ABBR.map((abbr, day) => (
        <button key={abbr} className="staple-chip" disabled={busy} onClick={() => planIt(day)}>
          {abbr}
        </button>
      ))}
      <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ fontSize: 12.5 }}>
        cancel
      </button>
    </span>
  ) : (
    <button className="btn btn-ink" onClick={() => setOpen(true)}>
      <Board size={15} />
      <span>Put it on the board</span>
    </button>
  );
}
