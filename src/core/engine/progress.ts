/**
 * Derives everything the app knows about a child's progress from the append-only event log:
 * completed items, competency stages (Knows -> Can teach), evidence counts, per-subject levels.
 */
import type { Catalog, ItemMeta } from '../catalog';
import type { Child, ProgressEvent, Stage } from '../model';
import { STAGES, ageFromBirth, defaultLevelForAge } from '../model';

export interface ChildProgress {
  completed: Map<string, number>; // itemId -> times completed
  lastDone: Map<string, number>; // itemId -> timestamp
  checkScores: Map<string, number>; // itemId -> best score 0..1
  stages: Map<string, Stage>; // competencyId -> highest stage
  evidence: Map<string, number>; // competencyId -> evidence count
  subjectLevels: Map<string, number>;
  areaRecent: Map<string, number>; // area -> completions in the last 14 days
  subjectRecent: Map<string, { done: number; good: number }>; // last 14 days
  minutesToday: number;
  totalMinutes: number;
  questions: number;
  books: string[];
  retries: number;
  groupActivities: number;
  realWorld: number; // adult-confirmed demonstrations/applications
  skillNodesDone: Map<string, Set<string>>; // tree -> nodes reached
}

export function stageIndex(s: Stage | undefined): number {
  return s ? STAGES.indexOf(s) : -1;
}

function maxStage(a: Stage | undefined, b: Stage): Stage {
  return stageIndex(b) > stageIndex(a) ? b : a ?? b;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function deriveProgress(
  child: Child,
  events: ProgressEvent[],
  catalog: Catalog,
  now = Date.now(),
): ChildProgress {
  const byId = new Map<string, ItemMeta>(catalog.items.map((i) => [i.id, i]));
  const p: ChildProgress = {
    completed: new Map(),
    lastDone: new Map(),
    checkScores: new Map(),
    stages: new Map(),
    evidence: new Map(),
    subjectLevels: new Map(),
    areaRecent: new Map(),
    subjectRecent: new Map(),
    minutesToday: 0,
    totalMinutes: 0,
    questions: 0,
    books: [],
    retries: 0,
    groupActivities: 0,
    realWorld: 0,
    skillNodesDone: new Map(),
  };
  const today = startOfDay(now);
  const recentFrom = now - 14 * 24 * 3600 * 1000;
  const sorted = [...events].filter((e) => e.childId === child.id).sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    const item = e.itemId ? byId.get(e.itemId) : undefined;
    if (e.retry) p.retries++;
    if (e.groupId) p.groupActivities++;
    switch (e.type) {
      case 'completed': {
        if (!e.itemId) break;
        p.completed.set(e.itemId, (p.completed.get(e.itemId) ?? 0) + 1);
        p.lastDone.set(e.itemId, e.at);
        if (item) {
          for (const c of item.competencies) p.stages.set(c, maxStage(p.stages.get(c), 'knows'));
          for (const s of item.skills) {
            if (!p.skillNodesDone.has(s.tree)) p.skillNodesDone.set(s.tree, new Set());
            p.skillNodesDone.get(s.tree)!.add(s.node);
          }
          if (e.at >= recentFrom) {
            p.areaRecent.set(item.area, (p.areaRecent.get(item.area) ?? 0) + 1);
            const r = p.subjectRecent.get(item.subject) ?? { done: 0, good: 0 };
            r.done++;
            p.subjectRecent.set(item.subject, r);
          }
        }
        break;
      }
      case 'check':
      case 'simulation': {
        if (!e.itemId || e.score === undefined) break;
        p.checkScores.set(e.itemId, Math.max(p.checkScores.get(e.itemId) ?? 0, e.score));
        if (item && e.score >= 0.67) {
          for (const c of item.competencies) p.stages.set(c, maxStage(p.stages.get(c), 'understands'));
          if (e.at >= recentFrom) {
            const r = p.subjectRecent.get(item.subject) ?? { done: 0, good: 0 };
            r.good++;
            p.subjectRecent.set(item.subject, r);
          }
        }
        break;
      }
      case 'stage': {
        if (!e.competencyId || !e.stage) break;
        // Stages above "understands" count only when an adult confirms them.
        if (stageIndex(e.stage) >= 2 && e.by === 'child') break;
        p.stages.set(e.competencyId, maxStage(p.stages.get(e.competencyId), e.stage));
        if (stageIndex(e.stage) >= 2) p.realWorld++;
        break;
      }
      case 'evidence': {
        if (!e.competencyId) break;
        p.evidence.set(e.competencyId, (p.evidence.get(e.competencyId) ?? 0) + 1);
        if (e.by !== 'child') p.realWorld++;
        break;
      }
      case 'question':
        p.questions++;
        break;
      case 'book':
        if (e.text) p.books.push(e.text);
        break;
      case 'minutes':
        p.totalMinutes += e.minutes ?? 0;
        if (e.at >= today) p.minutesToday += e.minutes ?? 0;
        break;
    }
  }
  // Subject levels: start from the parent override or the age default, then rise with mastery:
  // the level becomes one above the highest level the child has completed and passed in that subject.
  const age = ageFromBirth(child.birth, new Date(now));
  const base = defaultLevelForAge(age);
  const subjects = new Set(catalog.items.map((i) => i.subject));
  for (const s of subjects) {
    let level = child.levelOverrides[s] ?? base;
    for (const [id] of p.completed) {
      const it = byId.get(id);
      if (!it || it.subject !== s) continue;
      const score = p.checkScores.get(id);
      const passed = score === undefined || score >= 0.67;
      if (passed && it.level >= level) level = Math.min(10, it.level + 1);
    }
    p.subjectLevels.set(s, level);
  }
  return p;
}

/** Level of a subject for display, e.g. "Mathematics level 4" (brief section 23). */
export function levelOf(p: ChildProgress, subject: string, fallback = 1): number {
  return p.subjectLevels.get(subject) ?? fallback;
}
