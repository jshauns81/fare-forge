'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wave } from '@/components/icons';

export default function CopyWeekButton({ weekStart, span = 1 }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function copyPrevious() {
    setBusy(true);
    try {
      await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'copy', toWeek: weekStart, span }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const label = span === 2 ? 'Copy previous 2 weeks' : 'Copy last week';
  return (
    <button className="btn" onClick={copyPrevious} disabled={busy}>
      <Wave size={15} />
      <span>{busy ? 'Copying…' : label}</span>
    </button>
  );
}
