/** Daily screen-time limits set by the parent (no addictive streaks, no pressure). */
export interface UsageDay {
  day: string; // YYYY-MM-DD local
  seconds: number;
  extraMinutes: number;
}

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addUsage(u: UsageDay | undefined, seconds: number, now = Date.now()): UsageDay {
  const day = dayKey(now);
  if (!u || u.day !== day) return { day, seconds, extraMinutes: 0 };
  return { ...u, seconds: u.seconds + seconds };
}

export function minutesLeft(limitMinutes: number, u: UsageDay | undefined, now = Date.now()): number {
  if (limitMinutes <= 0) return Infinity;
  const day = dayKey(now);
  const used = u && u.day === day ? u.seconds / 60 : 0;
  const extra = u && u.day === day ? u.extraMinutes : 0;
  return Math.max(0, limitMinutes + extra - used);
}
