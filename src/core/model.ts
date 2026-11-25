/**
 * Home Tutor data model (the "Learning OS" of the brief):
 * Child -> Development Profile -> Core Curriculum -> Skills -> Interests -> Projects ->
 * Competencies -> Assessments -> Languages -> Health -> Physical Development -> Portfolio.
 *
 * Everything here is plain JSON so it can be stored offline, synced and exported.
 */
import type { AgeBand, AreaId, HealthModule } from './content-types';

/** Modes of operation, brief section 22. */
export const MODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type ModeId = (typeof MODES)[number];

export type Sex = 'girl' | 'boy' | 'unspecified';
export type HealthGuidance = 'parent' | 'tutor' | 'private';
export type WorldviewApproach = 'comparative' | 'family-first' | 'not-now';
export type Intensity = 'light' | 'balanced' | 'full';
export type Supervision = 'always' | 'often' | 'sometimes' | 'rarely';
export type OutdoorSpace = 'none' | 'balcony' | 'yard' | 'garden' | 'park-nearby' | 'rural';
export type LearningEnvironment = 'home' | 'tutor' | 'school' | 'mixed';
export type Equipment =
  | 'phone'
  | 'tablet'
  | 'computer'
  | 'printer'
  | 'books'
  | 'art-supplies'
  | 'science-kit'
  | 'tools'
  | 'kitchen'
  | 'bicycle'
  | 'internet'
  | 'garden-tools'
  | 'musical-instrument'
  | 'sports-gear';

export const EQUIPMENT: Equipment[] = [
  'phone',
  'tablet',
  'computer',
  'printer',
  'books',
  'art-supplies',
  'science-kit',
  'tools',
  'kitchen',
  'bicycle',
  'internet',
  'garden-tools',
  'musical-instrument',
  'sports-gear',
];

/** Learner type, brief section 2. */
export type LearnerType =
  | 'individual'
  | 'siblings'
  | 'small-group'
  | 'classroom'
  | 'tutor-led'
  | 'parent-led'
  | 'mixed-cohort';

export interface HealthSettings {
  /** Every module is OFF until the parent switches it on (owner decision 4). */
  modules: Partial<Record<HealthModule, boolean>>;
  guidance: HealthGuidance;
}

export interface Child {
  id: string;
  familyId: string;
  /** First name or nickname only. */
  name: string;
  avatar: string; // emoji
  color: string; // mascot colour key
  /** Year and month only ("2017-04"), enough for age and band. Minimal data. */
  birth: string;
  sex: Sex;
  country: string; // ISO alpha-2
  primaryLanguage: string; // BCP-47
  languagesSpoken: string[];
  studyLanguages: string[];
  educationLevel: string;
  learningEnvironment: LearningEnvironment;
  equipment: Equipment[];
  outdoorSpace: OutdoorSpace;
  supervision: Supervision;
  learnerTypes: LearnerType[];
  interests: string[];
  goals: string[];
  strengths: string[];
  growingAreas: string[];
  learningStyles: string[];
  /** Short note on physical/medical limitations so exercise adapts. Optional. */
  physicalNotes?: string;
  health: HealthSettings;
  /** Areas the parent switched off for this child. */
  areasOff: AreaId[];
  /** Parent-set level per subject (brief section 24); overrides the age default. */
  levelOverrides: Record<string, number>;
  dailyMinutes: number; // screen-time limit, 0 = no limit
  readAloud: boolean;
  updatedAt: number;
  deleted?: boolean;
}

export interface FamilySettings {
  intensity: Intensity;
  worldview: WorldviewApproach;
  /** Hours of learning per week the family aims for. */
  weeklyHours: number;
  dyslexiaFont: boolean;
  largeText: boolean;
  highContrast: boolean;
  uiLanguage: string;
  /** AI tutor seam: OFF and hidden (owner decision 5). */
  aiTutor: false;
  /** Reading list choices (D-053): a parent can hide a book or mark it approved. */
  bookPrefs?: Record<string, 'hidden' | 'approved'>;
}

export interface Family {
  id: string;
  name: string;
  mode: ModeId;
  country: string;
  /** PBKDF2 hash of the 4-6 digit parent PIN; set at family set-up. */
  pinHash?: string;
  pinSalt?: string;
  /** Parent gave consent for the child profiles at set-up (COPPA/GDPR-K). */
  consentAt?: number;
  /** What the family has at home (D-057), shared by every child; used by the engine and set-up. */
  equipment?: Equipment[];
  settings: FamilySettings;
  updatedAt: number;
}

export type ProgressEventType =
  | 'completed' // finished an item
  | 'check' // answered quick check questions
  | 'simulation' // finished a decision simulation
  | 'stage' // adult-confirmed competency stage (demonstrate/apply/teach)
  | 'evidence' // a real-world accomplishment counted towards a competency target
  | 'question' // the child asked a question (curiosity)
  | 'book' // a book read
  | 'minutes' // active learning minutes
  | 'attendance' // classroom attendance
  | 'goal'
  | 'interest';

/** Competency stages, brief section 27. */
export const STAGES = ['knows', 'understands', 'can-demonstrate', 'can-apply', 'can-teach'] as const;
export type Stage = (typeof STAGES)[number];

/** Progress is an append-only event log. Events never change, so sync never conflicts on them. */
export interface ProgressEvent {
  id: string;
  childId: string;
  at: number;
  type: ProgressEventType;
  itemId?: string;
  competencyId?: string;
  stage?: Stage;
  /** 0..1 for checks and simulations. */
  score?: number;
  minutes?: number;
  text?: string;
  /** Who recorded it. Stages above "understands" must be confirmed by an adult. */
  by: 'child' | 'parent' | 'tutor';
  /** Did the child try again after a miss (persistence)? */
  retry?: boolean;
  /** Done together with others (cooperation). */
  groupId?: string;
  /** A book from the reading list (type 'book'); text keeps the title for the passport. */
  bookId?: string;
  /** Set by the server on events a tutor wrote: the tutor link (so the parent sees which tutor). */
  tutorLinkId?: string;
}

export interface Group {
  id: string;
  name: string;
  kind: 'siblings' | 'small-group' | 'classroom';
  childIds: string[];
  updatedAt: number;
  deleted?: boolean;
}

export interface Assignment {
  id: string;
  groupId: string;
  itemId: string;
  due?: string;
  childIds: string[]; // empty = whole group
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface ProgressKeyInfo {
  id: string;
  childId: string;
  /** The code itself is only kept on the parent's device; the server stores a hash. */
  code: string;
  createdAt: number;
  expiresAt?: number;
  revoked?: boolean;
}

export function ageFromBirth(birth: string, now = new Date()): number {
  const [y, m] = birth.split('-').map(Number);
  if (!y) return 0;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < (m || 1)) age -= 1;
  return Math.max(0, age);
}

export function ageBandFor(age: number): AgeBand {
  if (age <= 5) return '3-5';
  if (age <= 8) return '6-8';
  if (age <= 11) return '9-11';
  if (age <= 14) return '12-14';
  return '15-17';
}

/** Look and feel by age (owner decision P1): picture-first 3-5, simple 6-9, fuller 10-17. */
export type AgeLook = 'picture' | 'simple' | 'full';
export function ageLookFor(age: number): AgeLook {
  if (age <= 5) return 'picture';
  if (age <= 9) return 'simple';
  return 'full';
}

/** Default learning level for a subject from age alone; real level then follows performance. */
export function defaultLevelForAge(age: number): number {
  return Math.min(10, Math.max(1, Math.round((age - 2) * 0.7)));
}

export const DEFAULT_FAMILY_SETTINGS: FamilySettings = {
  intensity: 'balanced',
  worldview: 'comparative',
  weeklyHours: 10,
  dyslexiaFont: false,
  largeText: false,
  highContrast: false,
  uiLanguage: 'en',
  aiTutor: false,
};

export function newChild(partial: Partial<Child> & Pick<Child, 'id' | 'familyId' | 'name' | 'birth'>): Child {
  return {
    avatar: '🦊',
    color: 'sun',
    sex: 'unspecified',
    country: 'IN',
    primaryLanguage: 'en',
    languagesSpoken: ['en'],
    studyLanguages: [],
    educationLevel: '',
    learningEnvironment: 'home',
    equipment: ['phone'],
    outdoorSpace: 'none',
    supervision: 'often',
    learnerTypes: ['individual', 'parent-led'],
    interests: [],
    goals: [],
    strengths: [],
    growingAreas: [],
    learningStyles: [],
    health: { modules: {}, guidance: 'parent' },
    areasOff: [],
    levelOverrides: {},
    dailyMinutes: 60,
    readAloud: true,
    updatedAt: Date.now(),
    ...partial,
  };
}
