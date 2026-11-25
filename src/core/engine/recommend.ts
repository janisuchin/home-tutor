/**
 * The what-next engine (brief section 41): "What does this particular child need next?"
 * Rule-based, deterministic and offline. It combines
 * AGE + DEVELOPMENT + KNOWLEDGE + SKILL + INTEREST + HEALTH + LANGUAGE + CULTURE + ENVIRONMENT +
 * GOALS + PERFORMANCE into a score with human-readable reasons.
 */
import type { AreaId } from '../content-types';
import type { Catalog, ItemMeta } from '../catalog';
import type { Child, Family, ProgressEvent } from '../model';
import { ageBandFor, ageFromBirth } from '../model';
import { deriveProgress, type ChildProgress } from './progress';
import { visibilityFor } from './gating';

export interface Reason {
  key: string; // i18n key
  vars?: Record<string, string | number>;
}

export interface Recommendation {
  item: ItemMeta;
  score: number;
  reasons: Reason[];
  needsAdult: boolean;
  needsProfessional: boolean;
}

/** Areas every child keeps in balance (brief section 1); the engine nudges under-practised ones. */
const BALANCE_AREAS: AreaId[] = [
  'core-academics',
  'life-skills',
  'physical-education',
  'first-aid',
  'nature-animals',
  'languages',
  'arts-creativity',
  'technology-ai',
  'financial-literacy',
  'environment',
  'civics-social',
];

const NEEDS_OUTDOOR_HINTS = ['garden', 'gardening', 'cycling', 'hiking', 'skating'];

export interface RecommendContext {
  now?: number;
  progress?: ChildProgress;
  /** Restrict to areas, e.g. when browsing. */
  areas?: AreaId[];
  /** Normal-edition gates even in the review edition (View as). */
  strict?: boolean;
}

function interestOverlap(item: ItemMeta, child: Child): string | undefined {
  const tags = new Set([...item.interests, item.subject.toLowerCase(), ...(item.connects ?? []).map((c) => c.toLowerCase())]);
  return child.interests.find((i) => tags.has(i.toLowerCase()));
}

export function scoreItem(
  item: ItemMeta,
  child: Child,
  family: Family | undefined,
  progress: ChildProgress,
  catalog: Catalog,
  now: number,
  strict = false,
): Recommendation | null {
  const vis = visibilityFor(item, child, family, new Date(now), { strict });
  if (!vis.visible) return null;
  const reasons: Reason[] = [];
  let score = 0;
  const age = ageFromBirth(child.birth, new Date(now));
  const band = ageBandFor(age);

  // AGE: own band first.
  if (item.ageBands.includes(band)) score += 2;

  // KNOWLEDGE + SKILL + DEVELOPMENT: closeness to the child's level in this subject.
  const level = progress.subjectLevels.get(item.subject) ?? 1;
  const gap = item.level - level;
  if (gap === 0 || gap === 1) {
    score += 4;
    reasons.push({ key: 'reason.level', vars: { subject: item.subject, level } });
  } else if (gap === -1) score += 2;
  else if (gap > 1) score -= 2 * (gap - 1);
  else score -= Math.min(4, -gap - 1);

  // PERFORMANCE: done already? Recently struggled in this subject -> prefer easier items.
  const times = progress.completed.get(item.id) ?? 0;
  if (times > 0) score -= 6 + times;
  const recent = progress.subjectRecent.get(item.subject);
  if (recent && recent.done >= 2 && recent.good / recent.done < 0.5) {
    if (gap <= 0) {
      score += 2;
      reasons.push({ key: 'reason.practice', vars: { subject: item.subject } });
    } else score -= 2;
  }
  const best = progress.checkScores.get(item.id);
  if (best !== undefined && best < 0.67) {
    score += 5; // try again: persistence is rewarded
    reasons.push({ key: 'reason.retry' });
  }

  // INTEREST.
  const interest = interestOverlap(item, child);
  if (interest) {
    score += 4;
    reasons.push({ key: 'reason.interest', vars: { interest } });
  }

  // GOALS: goal words match the subject, interests or title.
  const goal = child.goals.find((g) => {
    const w = g.toLowerCase();
    return w.includes(item.subject.toLowerCase()) || item.interests.some((i) => w.includes(i)) || item.title.toLowerCase().includes(w);
  });
  if (goal) {
    score += 3;
    reasons.push({ key: 'reason.goal', vars: { goal } });
  }

  // Balance across areas: under-practised areas get a nudge.
  if (BALANCE_AREAS.includes(item.area)) {
    const n = progress.areaRecent.get(item.area) ?? 0;
    if (n === 0) {
      score += 2;
      reasons.push({ key: 'reason.balance' });
    } else score -= Math.min(3, n * 0.5);
  }

  // SKILL TREE: next node in a tree the child already started.
  for (const s of item.skills) {
    const tree = catalog.skillTrees.find((t) => t.id === s.tree);
    const done = progress.skillNodesDone.get(s.tree);
    if (!tree || !done) continue;
    const idx = tree.nodes.findIndex((n) => n.id === s.node);
    const furthest = Math.max(-1, ...tree.nodes.map((n, i) => (done.has(n.id) ? i : -1)));
    if (idx === furthest + 1) {
      score += 3;
      reasons.push({ key: 'reason.nextSkill', vars: { tree: tree.title } });
      break;
    }
  }

  // LANGUAGE: items with vocabulary hooks shine when the child studies a language.
  if (child.studyLanguages.length && item.languageHooks?.length) {
    score += 1;
    reasons.push({ key: 'reason.language' });
  }

  // CULTURE: world projects for curiosity about other countries.
  if (item.kind === 'world-project') score += 1;

  // HEALTH: switched-on health modules are part of the plan, gently.
  if (item.healthModule) {
    score += 1;
    reasons.push({ key: 'reason.health' });
  }

  // ENVIRONMENT: supervision and space. Amber/red work needs an adult; if adults are rarely
  // around it moves down the list (it is never hidden: the family can plan it).
  if (vis.needsAdult && child.supervision === 'rarely') score -= 3;
  if (vis.needsProfessional) score -= 2;
  if (child.outdoorSpace === 'none' && NEEDS_OUTDOOR_HINTS.includes(item.subject.toLowerCase())) score -= 1;

  // Physical development is compulsory: keep it in every day.
  if (item.area === 'physical-education' && (progress.areaRecent.get('physical-education') ?? 0) < 3) score += 1;

  // Stable tie-break so the list does not jump around.
  score += (hash(item.id + child.id) % 100) / 1000;

  if (!reasons.length) reasons.push({ key: 'reason.explore' });
  return { item, score, reasons, needsAdult: vis.needsAdult, needsProfessional: vis.needsProfessional };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function recommend(
  child: Child,
  family: Family | undefined,
  catalog: Catalog,
  events: ProgressEvent[],
  ctx: RecommendContext = {},
): Recommendation[] {
  const now = ctx.now ?? Date.now();
  const progress = ctx.progress ?? deriveProgress(child, events, catalog, now);
  const out: Recommendation[] = [];
  for (const item of catalog.items) {
    if (ctx.areas && !ctx.areas.includes(item.area)) continue;
    const r = scoreItem(item, child, family, progress, catalog, now, ctx.strict);
    if (r) out.push(r);
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Today's learning: a short, balanced plan within the child's daily minutes.
 * At most one item per area, one practical or physical item, and the intensity setting decides size.
 */
export function todayPlan(
  child: Child,
  family: Family | undefined,
  catalog: Catalog,
  events: ProgressEvent[],
  now = Date.now(),
  strict = false,
): Recommendation[] {
  const recs = recommend(child, family, catalog, events, { now, strict });
  const intensity = family?.settings.intensity ?? 'balanced';
  const count = intensity === 'light' ? 3 : intensity === 'full' ? 6 : 4;
  const budget = child.dailyMinutes > 0 ? child.dailyMinutes : 90;
  const plan: Recommendation[] = [];
  const usedAreas = new Set<string>();
  let minutes = 0;
  const hasPhysical = () => plan.some((r) => r.item.area === 'physical-education');
  for (const r of recs) {
    if (plan.length >= count) break;
    if (r.item.kind === 'project' || r.item.kind === 'world-project') continue; // projects are missions
    if (usedAreas.has(r.item.area)) continue;
    if (minutes + r.item.minutes > budget && plan.length > 0) continue;
    plan.push(r);
    usedAreas.add(r.item.area);
    minutes += r.item.minutes;
  }
  if (!hasPhysical()) {
    const pe = recs.find((r) => r.item.area === 'physical-education' && r.item.kind !== 'project');
    if (pe) {
      if (plan.length >= count) plan.pop();
      plan.push(pe);
    }
  }
  return plan;
}

/** The current mission is the best project (or world project) for the child right now. */
export function currentMission(
  child: Child,
  family: Family | undefined,
  catalog: Catalog,
  events: ProgressEvent[],
  now = Date.now(),
): Recommendation | undefined {
  return recommend(child, family, catalog, events, { now }).find(
    (r) => r.item.kind === 'project' || r.item.kind === 'world-project',
  );
}
