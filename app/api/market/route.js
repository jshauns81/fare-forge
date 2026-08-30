import { NextResponse } from 'next/server';
import { addExtra, removeExtra, setCheck } from '@/lib/db';
import { isValidWeekStart } from '@/lib/weeks';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }
  const { op, weekStart } = body || {};
  if (!isValidWeekStart(weekStart)) return NextResponse.json({ error: 'Bad week' }, { status: 400 });

  try {
    if (op === 'check') {
      const { itemKey, checked } = body;
      if (!itemKey || String(itemKey).length > 200) return NextResponse.json({ error: 'Bad item' }, { status: 400 });
      setCheck(weekStart, String(itemKey), Boolean(checked));
      return NextResponse.json({ ok: true });
    }
    if (op === 'addExtra') {
      const label = String(body.label || '').trim().slice(0, 80);
      if (!label) return NextResponse.json({ error: 'Empty label' }, { status: 400 });
      const extra = addExtra(weekStart, label);
      return NextResponse.json({ ok: true, extra });
    }
    if (op === 'removeExtra') {
      removeExtra(body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
