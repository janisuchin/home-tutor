/**
 * Home Tutor content schema.
 *
 * Every content pack lives in content/areas/<area>.json (one file per learning area)
 * and is checked by scripts/validate-content.ts. The build fails on missing safety
 * ratings, sources, age bands or material substitutions.
 */

/** The 17 learning areas from brief section 1. */
export const AREA_IDS = [
  'core-academics',
  'life-skills',
  'physical-education',
  'health',
  'first-aid',
  'nature-animals',
  'civics-social',
  'financial-literacy',
  'technology-ai',
  'languages',
  'arts-creativity',
  'philosophy-worldviews',
  'environment',
  'careers',
  'special-interests',
  'projects',
  'independent-learning',
] as const;
export type AreaId = (typeof AREA_IDS)[number];

export const AGE_BANDS = ['3-5', '6-8', '9-11', '12-14', '15-17'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Brief section 38: GREEN independent, AMBER adult supervision, RED professional supervision/training. */
export type SafetyRating = 'green' | 'amber' | 'red';

export type ItemKind = 'lesson' | 'activity' | 'simulation' | 'project' | 'world-project';

/** Health modules are OFF by default and switched on per child by the parent (owner decision 4). */
export type HealthModule =
  | 'body-basics' // body parts, hygiene, privacy, safe/unsafe touch, asking for help (all children)
  | 'growing-up-girl' // pre-puberty + puberty, female pathway
  | 'growing-up-boy' // pre-puberty + puberty, male pathway
  | 'adolescent-health'; // consent, relationships, check-ups, talking to a doctor

export interface Source {
  title: string;
  publisher: string; // e.g. "World Health Organization", "NHS", "UNESCO", "IFRC", "Red Cross"
  url: string; // https:// link to the public page
}

export interface ProjectVersion {
  /** What it costs in plain words, e.g. "Free", "Under 5 USD". */
  cost: string;
  materials: string[];
  description: string;
}

export interface Substitution {
  instead: string; // the recommended equipment
  use: string; // what a family can use if it is unavailable
}

export interface CheckQuestion {
  question: string;
  options: string[]; // 2-4 short options
  answer: number; // index into options
  explain: string; // shown after answering, kind wording
}

export interface SimulationOption {
  text: string;
  correct: boolean;
  feedback: string;
}
export interface SimulationStep {
  prompt: string;
  options: SimulationOption[]; // 2-4 options, at least one correct
}

export interface ContentItem {
  /** Unique, kebab-case, prefixed by a short area tag, e.g. "life-fix-leaking-sink". */
  id: string;
  kind: ItemKind;
  area: AreaId;
  /** Subject inside the area, e.g. "mathematics", "plumbing", "swimming". Used for the learning map. */
  subject: string;
  title: string;
  emoji: string;
  ageBands: AgeBand[]; // at least one
  /** Learning level 1-10, independent of age (brief section 24). */
  level: number;
  minutes: number;
  /** Child-facing summary, short and plain. */
  summary: string;
  /** Step-by-step instructions the child (with an adult if needed) follows. */
  steps: string[];
  /** True for anything done with hands, body, tools, food, animals, water, fire, electricity, vehicles. */
  practical: boolean;
  /** Required when practical, and for every simulation/project. */
  safety?: {
    rating: SafetyRating;
    hazards: string[];
    notes: string;
  };
  /** Required when practical or kind is project/world-project (brief section 36). */
  versions?: {
    basic: ProjectVersion;
    better: ProjectVersion;
    advanced: ProjectVersion;
  };
  /** Required (at least one) when practical (brief section 37). */
  substitutions?: Substitution[];
  /** Required for health, first-aid and any amber/red item. */
  sources?: Source[];
  /** Competency ids (Life Competency Passport) this item builds evidence for. */
  competencies: string[];
  /** Skill tree nodes this item advances: { tree: skill tree id, node: node id }. */
  skills: { tree: string; node: string }[];
  /** Interest tags, lowercase, e.g. "animals", "horses", "bicycles", "cooking", "space". */
  interests: string[];
  /** Vocabulary concept keys woven in for a study language (brief section 18), e.g. "numbers", "fruit". */
  languageHooks?: string[];
  /** Subjects this item connects to (cross-curricular), e.g. ["mathematics", "nutrition"]. */
  connects?: string[];
  check?: CheckQuestion[];
  /** Required when kind is simulation (brief section 28). */
  simulation?: { scenario: string; steps: SimulationStep[] };
  /** Gated health content; only shown when the parent switches that module on. */
  healthModule?: HealthModule;
  /** Health/puberty content must carry 'awaiting-medical-review' until a professional signs it off. */
  reviewStatus?: 'awaiting-medical-review' | 'reviewed';
  /** For first aid, swimming, martial arts, etc.: what real-world training/certification is needed. */
  certificationNote?: string;
  /** Short note for the supervising adult. */
  adultNote?: string;
}

export interface SkillTreeNode {
  id: string;
  title: string;
  description: string;
}
export interface SkillTree {
  id: string; // e.g. "plumbing"
  area: AreaId;
  title: string;
  emoji: string;
  /** Ordered from first to last (brief section 26). */
  nodes: SkillTreeNode[];
}

/** Brief section 40 groups for the Life Competency Passport. */
export const COMPETENCY_GROUPS = [
  'academic',
  'life',
  'physical',
  'emergency',
  'digital',
  'global',
  'intellectual',
  'practical',
  'personal',
] as const;
export type CompetencyGroup = (typeof COMPETENCY_GROUPS)[number];

export interface Competency {
  id: string; // e.g. "cook-10-meals"
  area: AreaId;
  group: CompetencyGroup;
  title: string; // "Can cook 10 meals"
  emoji: string;
  /** How many pieces of evidence reach the target, e.g. 10 meals. Default 1. */
  target?: number;
  /** True when the real-world version needs a certificate from an accredited course (e.g. CPR). */
  needsCertification?: boolean;
}

export interface PathwayStep {
  title: string;
  area: AreaId;
  subject: string;
  description: string;
  itemIds?: string[];
}
/** Interest pathway (brief, horse and bicycle examples). */
export interface Pathway {
  id: string;
  interest: string; // matches interest tags
  title: string;
  emoji: string;
  ageBands: AgeBand[];
  steps: PathwayStep[];
}

export interface AreaPack {
  area: AreaId;
  title: string;
  emoji: string;
  description: string;
  skillTrees: SkillTree[];
  competencies: Competency[];
  items: ContentItem[];
  pathways?: Pathway[];
}

/** Areas whose every item must cite sources. */
export const SOURCE_REQUIRED_AREAS: AreaId[] = ['health', 'first-aid'];

export interface EmergencyNumber {
  countryCode: string; // ISO 3166-1 alpha-2
  country: string;
  general?: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  source: Source;
  verified: boolean;
  note?: string;
}

export interface Career {
  id: string;
  family: string;
  title: string;
  emoji: string;
  description: string;
  ageBands: AgeBand[];
  tryAtHome: string[];
  subjects: string[];
  interests: string[];
}

/** Vocabulary pack for a study language (brief sections 18-19). */
export interface VocabPack {
  language: string; // BCP-47, e.g. "ja"
  name: string; // English name
  nativeName: string;
  ttsLang: string; // e.g. "ja-JP"
  rtl?: boolean;
  concepts: Record<string, { en: string; word: string; romanised?: string }[]>;
}
