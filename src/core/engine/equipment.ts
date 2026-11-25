/**
 * Family equipment inventory (D-057). The engine guesses what an item needs from its subject,
 * interests and links, and compares it with what the family (and the child) have at home.
 * Missing equipment never hides an item: every practical item has substitutions; it only moves down.
 */
import type { ItemMeta } from '../catalog';
import type { Child, Equipment, Family } from '../model';

const RULES: [Equipment, RegExp][] = [
  ['bicycle', /\b(bicycles?|cycling|bike)\b/],
  ['kitchen', /\b(cooking|baking|kitchen|nutrition|recipes?)\b/],
  ['computer', /\b(computers?|coding|programming|spreadsheets?|typing)\b/],
  ['musical-instrument', /\b(music|instruments?|rhythm)\b/],
  ['art-supplies', /\b(drawing|painting|art|crafts?)\b/],
  ['garden-tools', /\b(gardening|garden|plants|compost)\b/],
  ['tools', /\b(tools|woodwork|repairs?|plumbing|electrics?)\b/],
  ['science-kit', /\b(chemistry|experiments?|microscope)\b/],
  ['sports-gear', /\b(football|cricket|basketball|badminton|tennis|skating)\b/],
];

export function itemNeeds(item: Pick<ItemMeta, 'subject' | 'interests' | 'connects' | 'practical'>): Equipment[] {
  if (!item.practical) return [];
  const text = [item.subject, ...item.interests, ...(item.connects ?? [])].join(' ').toLowerCase();
  return RULES.filter(([, re]) => re.test(text)).map(([e]) => e);
}

/** Everything available to this child: the family inventory plus the child's own things. */
export function availableEquipment(child: Child, family: Family | undefined): Set<Equipment> {
  return new Set([...(family?.equipment ?? []), ...child.equipment]);
}

/** Only judged when the family filled in an inventory; otherwise we do not assume anything is missing. */
export function equipmentFit(item: ItemMeta, child: Child, family: Family | undefined): { have: Equipment[]; missing: Equipment[] } | undefined {
  if (!family?.equipment?.length) return undefined;
  const needs = itemNeeds(item);
  if (!needs.length) return undefined;
  const have = availableEquipment(child, family);
  return { have: needs.filter((e) => have.has(e)), missing: needs.filter((e) => !have.has(e)) };
}
