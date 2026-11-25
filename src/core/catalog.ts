/**
 * The catalogue is the light index of all content items (no steps or long text), small enough to
 * load at start-up so the offline what-next engine can rank everything. Full items load per area.
 */
import type {
  AreaId,
  AreaPack,
  Competency,
  ContentItem,
  Pathway,
  SafetyRating,
  SkillTree,
} from './content-types';

export interface ItemMeta {
  id: string;
  kind: ContentItem['kind'];
  area: AreaId;
  subject: string;
  title: string;
  emoji: string;
  ageBands: ContentItem['ageBands'];
  level: number;
  minutes: number;
  practical: boolean;
  rating?: SafetyRating;
  interests: string[];
  competencies: string[];
  skills: { tree: string; node: string }[];
  connects?: string[];
  languageHooks?: string[];
  healthModule?: ContentItem['healthModule'];
}

export interface AreaMeta {
  area: AreaId;
  title: string;
  emoji: string;
  description: string;
  count: number;
}

export interface Catalog {
  version: string;
  areas: AreaMeta[];
  items: ItemMeta[];
  skillTrees: SkillTree[];
  competencies: Competency[];
  pathways: Pathway[];
}

export function toMeta(i: ContentItem): ItemMeta {
  const m: ItemMeta = {
    id: i.id,
    kind: i.kind,
    area: i.area,
    subject: i.subject,
    title: i.title,
    emoji: i.emoji,
    ageBands: i.ageBands,
    level: i.level,
    minutes: i.minutes,
    practical: i.practical,
    interests: i.interests,
    competencies: i.competencies,
    skills: i.skills,
  };
  if (i.safety) m.rating = i.safety.rating;
  if (i.connects?.length) m.connects = i.connects;
  if (i.languageHooks?.length) m.languageHooks = i.languageHooks;
  if (i.healthModule) m.healthModule = i.healthModule;
  return m;
}

export function buildCatalog(packs: AreaPack[], version: string): Catalog {
  return {
    version,
    areas: packs.map((p) => ({
      area: p.area,
      title: p.title,
      emoji: p.emoji,
      description: p.description,
      count: p.items.length,
    })),
    items: packs.flatMap((p) => p.items.map(toMeta)),
    skillTrees: packs.flatMap((p) => p.skillTrees),
    competencies: packs.flatMap((p) => p.competencies),
    pathways: packs.flatMap((p) => p.pathways ?? []),
  };
}
