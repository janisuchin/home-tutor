/**
 * Tutor and parent insights (brief section 33), group compatibility, and achievements that reward
 * effort, curiosity, persistence, mastery, cooperation and real-world accomplishment (section 34).
 * No streaks and no pressure: badges are only ever earned, never lost.
 */
import type { Catalog, ItemMeta } from '../catalog';
import type { Child, Family, ProgressEvent } from '../model';
import { ageBandFor, ageFromBirth } from '../model';
import { deriveProgress, stageIndex, type ChildProgress } from './progress';
import { isVisible } from './gating';
import type { Reason } from './recommend';

export interface Insight {
  kind: 'accelerate' | 'connect-interest' | 'gap' | 'safety' | 'practice' | 'health';
  reason: Reason;
  itemId?: string;
}

const DAY = 24 * 3600 * 1000;

export function tutorInsights(
  child: Child,
  family: Family | undefined,
  catalog: Catalog,
  events: ProgressEvent[],
  now = Date.now(),
): Insight[] {
  const p = deriveProgress(child, events, catalog, now);
  const out: Insight[] = [];
  const visible = catalog.items.filter((i) => isVisible(i, child, family, new Date(now)));

  // Rapid progress: 3+ items in a subject in 14 days with good checks -> suggest the next step.
  for (const [subject, r] of p.subjectRecent) {
    if (r.done >= 3 && r.good >= Math.ceil(r.done * 0.6)) {
      const level = p.subjectLevels.get(subject) ?? 1;
      const next = visible
        .filter((i) => i.subject === subject && i.level > level - 1 && !p.completed.has(i.id))
        .sort((a, b) => a.level - b.level)[0];
      out.push({
        kind: 'accelerate',
        reason: { key: 'insight.accelerate', vars: { name: child.name, subject, next: next?.title ?? subject } },
        itemId: next?.id,
      });
    } else if (r.done >= 2 && r.good / r.done < 0.5) {
      out.push({ kind: 'practice', reason: { key: 'insight.practice', vars: { name: child.name, subject } } });
    }
  }

  // Connect an academic lesson to a strong interest ("connect today's fractions lesson to recipes").
  for (const interest of child.interests) {
    const bridge = visible.find(
      (i) =>
        i.area === 'core-academics' &&
        !p.completed.has(i.id) &&
        (i.interests.includes(interest) || (i.connects ?? []).map((c) => c.toLowerCase()).includes(interest)),
    );
    if (bridge)
      out.push({
        kind: 'connect-interest',
        reason: { key: 'insight.connect', vars: { name: child.name, interest, lesson: bridge.title } },
        itemId: bridge.id,
      });
  }

  // Competency gaps: core areas never touched.
  const touched = new Set<string>();
  for (const id of p.completed.keys()) {
    const it = catalog.items.find((i) => i.id === id);
    if (it) touched.add(it.area);
  }
  for (const area of ['first-aid', 'physical-education', 'life-skills', 'core-academics'] as const) {
    if (!touched.has(area) && !child.areasOff.includes(area)) {
      const a = catalog.areas.find((x) => x.area === area);
      out.push({ kind: 'gap', reason: { key: 'insight.gap', vars: { name: child.name, area: a?.title ?? area } } });
    }
  }

  // Safety requirements coming up in the plan.
  const amberRed = visible.filter((i) => (i.rating === 'amber' || i.rating === 'red') && !p.completed.has(i.id));
  if (amberRed.length && child.supervision === 'rarely')
    out.push({ kind: 'safety', reason: { key: 'insight.safety', vars: { name: child.name } } });

  return out.slice(0, 8);
}

/** Group compatibility for siblings, small groups and classrooms (brief sections 22, 33). */
export interface Compatibility {
  score: number; // 0..100
  sharedInterests: string[];
  bandSpread: number; // number of age bands between youngest and oldest
  sharedItems: ItemMeta[]; // items every member can do together
}

export function groupCompatibility(
  children: Child[],
  family: Family | undefined,
  catalog: Catalog,
  now = Date.now(),
): Compatibility {
  if (children.length === 0) return { score: 0, sharedInterests: [], bandSpread: 0, sharedItems: [] };
  const bands = ['3-5', '6-8', '9-11', '12-14', '15-17'];
  const idx = children.map((c) => bands.indexOf(ageBandFor(ageFromBirth(c.birth, new Date(now)))));
  const bandSpread = Math.max(...idx) - Math.min(...idx);
  const counts = new Map<string, number>();
  for (const c of children) for (const i of new Set(c.interests)) counts.set(i, (counts.get(i) ?? 0) + 1);
  const sharedInterests = [...counts.entries()].filter(([, n]) => n >= Math.max(2, Math.ceil(children.length / 2))).map(([i]) => i);
  const sharedItems = catalog.items
    .filter((i) => children.every((c) => isVisible(i, c, family, new Date(now))))
    .filter((i) => !i.healthModule) // health pathways stay private and individual (Mode D)
    .sort((a, b) => {
      const ia = a.interests.filter((x) => sharedInterests.includes(x)).length;
      const ib = b.interests.filter((x) => sharedInterests.includes(x)).length;
      return ib - ia || (a.kind === 'project' ? -1 : 0) - (b.kind === 'project' ? -1 : 0);
    })
    .slice(0, 12);
  const score = Math.round(
    Math.max(0, Math.min(100, 100 - bandSpread * 22 + sharedInterests.length * 8 + Math.min(20, sharedItems.length * 2) - 20)),
  );
  return { score, sharedInterests, bandSpread, sharedItems };
}

export interface Achievement {
  id: string;
  kind: 'effort' | 'curiosity' | 'persistence' | 'mastery' | 'cooperation' | 'real-world';
  emoji: string;
  titleKey: string;
  earned: boolean;
  progress: number; // 0..1
}

export function achievements(p: ChildProgress): Achievement[] {
  const completedCount = [...p.completed.values()].reduce((a, b) => a + b, 0);
  const areas = p.areaRecent.size;
  const mastered = [...p.stages.values()].filter((s) => stageIndex(s) >= 2).length;
  const list: Omit<Achievement, 'earned' | 'progress'>[] = [];
  const mk = (id: string, kind: Achievement['kind'], emoji: string, value: number, target: number) => ({
    id,
    kind,
    emoji,
    titleKey: `badge.${id}`,
    earned: value >= target,
    progress: Math.min(1, value / target),
  });
  void list;
  return [
    mk('first-step', 'effort', '👣', completedCount, 1),
    mk('busy-bee', 'effort', '🐝', completedCount, 10),
    mk('hard-worker', 'effort', '💪', p.totalMinutes, 300),
    mk('question-asker', 'curiosity', '❓', p.questions, 5),
    mk('explorer', 'curiosity', '🧭', areas, 5),
    mk('try-again', 'persistence', '🔁', p.retries, 1),
    mk('never-give-up', 'persistence', '🌱', p.retries, 5),
    mk('i-can-do-it', 'mastery', '⭐', mastered, 1),
    mk('skilled-hands', 'mastery', '🏅', mastered, 5),
    mk('team-player', 'cooperation', '🤝', p.groupActivities, 3),
    mk('real-world', 'real-world', '🌍', p.realWorld, 1),
    mk('helper', 'real-world', '🧰', p.realWorld, 5),
    mk('bookworm', 'effort', '📚', p.books.length, 5),
  ];
}

export function daysSince(t: number | undefined, now = Date.now()): number {
  return t ? Math.floor((now - t) / DAY) : Infinity;
}
