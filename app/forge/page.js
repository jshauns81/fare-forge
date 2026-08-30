import ForgeClient from '@/components/ForgeClient';
import { shiftWeek, weekStartOf } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'The Forge' };

// The server decides what "this week" is (one clock, one timezone — set TZ
// when self-hosting); the client just renders it.
export default function ForgePage() {
  const weekStart = weekStartOf();
  return <ForgeClient weekStart={weekStart} nextWeekStart={shiftWeek(weekStart, 1)} />;
}
