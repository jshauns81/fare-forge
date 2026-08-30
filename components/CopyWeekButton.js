'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wave } from '@/components/icons';

export default function CopyWeekButton({ weekStart }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function copyLastWeek() {
    setBusy(true);
    try {
      await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'copy', toWeek: weekStart }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn" onClick={copyLastWeek} disabled={busy}>
      <Wave size={15} />
      <span>{busy ? 'Copying…' : 'Copy last week'}</span>
    </button>
  );
}
