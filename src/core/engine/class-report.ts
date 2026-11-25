/**
 * Class report (classroom mode): attendance and progress for one group over a period. Pure, so
 * it runs offline on the teacher's device and is unit tested. Printed from /classroom/report.
 */
import type { Catalog } from '../catalog';
import type { Child, Group, ProgressEvent } from '../model';

export interface ClassReportRow {
  childId: string;
  name: string;
  avatar: string;
  present: number;
  sessions: number;
  /** 0..100, or undefined when no sessions were recorded. */
  attendancePct?: number;
  completed: number;
  groupLessons: number;
  minutes: number;
  checks: number;
  /** Average check/simulation score, 0..100. */
  avgScore?: number;
  confirmedStages: number;
  areas: string[];
}

export interface ClassReport {
  groupId: string;
  groupName: string;
  from: string; // YYYY-MM-DD
  to: string;
  sessions: number;
  days: { day: string; present: number }[];
  rows: ClassReportRow[];
  averageAttendancePct?: number;
}

const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function buildClassReport(
  group: Group,
  children: Child[],
  attendance: Record<string, string[]> | undefined,
  events: ProgressEvent[],
  catalog: Catalog | undefined,
  opts: { days: number; now?: number },
): ClassReport {
  const now = opts.now ?? Date.now();
  const fromT = now - (opts.days - 1) * 86400_000;
  const from = dayOf(fromT);
  const to = dayOf(now);
  const members = children.filter((c) => !c.deleted && group.childIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const days = Object.entries(attendance ?? {})
    .filter(([d, ids]) => d >= from && d <= to && ids.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, ids]) => ({ day, present: ids.filter((id) => members.some((m) => m.id === id)).length, ids }));
  const sessions = days.length;
  const areaOf = new Map(catalog?.items.map((i) => [i.id, i.area]) ?? []);
  const rows = members.map((c) => {
    const evs = events.filter((e) => e.childId === c.id && e.at >= new Date(from + 'T00:00:00').getTime() && e.at <= now);
    const scored = evs.filter((e) => (e.type === 'check' || e.type === 'simulation') && typeof e.score === 'number');
    const completed = evs.filter((e) => e.type === 'completed');
    const present = days.filter((d) => d.ids.includes(c.id)).length;
    return {
      childId: c.id,
      name: c.name,
      avatar: c.avatar,
      present,
      sessions,
      attendancePct: sessions ? Math.round((present / sessions) * 100) : undefined,
      completed: completed.length,
      groupLessons: completed.filter((e) => e.groupId === group.id).length,
      minutes: evs.filter((e) => e.type === 'minutes').reduce((n, e) => n + (e.minutes ?? 0), 0),
      checks: scored.length,
      avgScore: scored.length ? Math.round((scored.reduce((n, e) => n + (e.score ?? 0), 0) / scored.length) * 100) : undefined,
      confirmedStages: evs.filter((e) => e.type === 'stage' && e.by !== 'child').length,
      areas: [...new Set(completed.map((e) => (e.itemId ? areaOf.get(e.itemId) : undefined)).filter((a): a is NonNullable<typeof a> => !!a))].sort(),
    };
  });
  const withPct = rows.filter((r) => r.attendancePct !== undefined);
  return {
    groupId: group.id,
    groupName: group.name,
    from,
    to,
    sessions,
    days: days.map(({ day, present }) => ({ day, present })),
    rows,
    averageAttendancePct: withPct.length ? Math.round(withPct.reduce((n, r) => n + (r.attendancePct ?? 0), 0) / withPct.length) : undefined,
  };
}
