/**
 * Learning Passport / Life Competency Passport (brief sections 25, 27 and the closing paragraph):
 * "the academic transcript tells you what the child studied; the competency portfolio shows you what
 * the child can actually do". The snapshot is what a Progress Key shows (read-only) and what the
 * printable passport prints. It holds a first name only and no contact details.
 */
import type { Catalog } from '../catalog';
import type { CompetencyGroup } from '../content-types';
import type { Child, ProgressEvent, Stage } from '../model';
import { ageFromBirth } from '../model';
import { deriveProgress, stageIndex } from './progress';

export interface PassportCompetency {
  id: string;
  title: string;
  emoji: string;
  group: CompetencyGroup;
  stage?: Stage;
  evidence: number;
  target: number;
  needsCertification: boolean;
}

export interface PassportSnapshot {
  version: 1;
  name: string;
  age: number;
  generatedAt: number;
  levels: { subject: string; level: number }[];
  competencies: PassportCompetency[];
  completedCount: number;
  projects: { id: string; title: string; emoji: string }[];
  skillTrees: { id: string; title: string; emoji: string; reached: number; total: number }[];
  books: string[];
  interests: string[];
  goals: string[];
  strengths: string[];
  languages: { spoken: string[]; studying: string[] };
  totalMinutes: number;
}

export function buildPassport(child: Child, events: ProgressEvent[], catalog: Catalog, now = Date.now()): PassportSnapshot {
  const p = deriveProgress(child, events, catalog, now);
  const touchedSubjects = new Set<string>();
  for (const id of p.completed.keys()) {
    const it = catalog.items.find((i) => i.id === id);
    if (it) touchedSubjects.add(it.subject);
  }
  const competencies: PassportCompetency[] = catalog.competencies
    .map((c) => ({
      id: c.id,
      title: c.title,
      emoji: c.emoji,
      group: c.group,
      stage: p.stages.get(c.id),
      evidence: p.evidence.get(c.id) ?? 0,
      target: c.target ?? 1,
      needsCertification: !!c.needsCertification,
    }))
    .filter((c) => c.stage || c.evidence > 0)
    .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || b.evidence - a.evidence);
  return {
    version: 1,
    name: child.name,
    age: ageFromBirth(child.birth, new Date(now)),
    generatedAt: now,
    levels: [...touchedSubjects].sort().map((s) => ({ subject: s, level: p.subjectLevels.get(s) ?? 1 })),
    competencies,
    completedCount: p.completed.size,
    projects: [...p.completed.keys()]
      .map((id) => catalog.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && (i.kind === 'project' || i.kind === 'world-project'))
      .map((i) => ({ id: i.id, title: i.title, emoji: i.emoji })),
    skillTrees: catalog.skillTrees
      .map((t) => ({
        id: t.id,
        title: t.title,
        emoji: t.emoji,
        reached: t.nodes.filter((n) => p.skillNodesDone.get(t.id)?.has(n.id)).length,
        total: t.nodes.length,
      }))
      .filter((t) => t.reached > 0),
    books: p.books,
    interests: child.interests,
    goals: child.goals,
    strengths: child.strengths,
    languages: { spoken: child.languagesSpoken, studying: child.studyLanguages },
    totalMinutes: p.totalMinutes,
  };
}
