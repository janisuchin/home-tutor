/**
 * What a child may see. Children's safety and privacy come before features.
 */
import type { AgeBand } from '../content-types';
import { AGE_BANDS } from '../content-types';
import type { ItemMeta } from '../catalog';
import type { Child, Family } from '../model';
import { ageBandFor, ageFromBirth } from '../model';
import { isUnlocked } from '../edition';

export type Visibility =
  | { visible: true; needsAdult: boolean; needsProfessional: boolean }
  | { visible: false; reason: 'health-off' | 'area-off' | 'age' | 'worldview' };

const WORLDVIEW_SUBJECTS = ['worldviews', 'religions', 'religion', 'beliefs', 'beliefs and practices', 'festivals'];

/** Bands a child may draw from: their own band, plus one band up/down when their level allows. */
export function allowedBands(child: Child, now = new Date()): AgeBand[] {
  const band = ageBandFor(ageFromBirth(child.birth, now));
  const idx = AGE_BANDS.indexOf(band);
  const out: AgeBand[] = [band];
  if (idx > 0) out.push(AGE_BANDS[idx - 1]);
  if (idx < AGE_BANDS.length - 1) out.push(AGE_BANDS[idx + 1]);
  return out;
}

export interface GateOptions {
  /** Apply the normal edition's gates even in the unlocked review edition (the View as panel). */
  strict?: boolean;
}

export function visibilityFor(item: ItemMeta, child: Child, family: Family | undefined, now = new Date(), opts: GateOptions = {}): Visibility {
  // Review edition: everything is open, but Amber and Red items keep their adult flags.
  if (!opts.strict && isUnlocked() && !child.id.startsWith('viewas-'))
    return { visible: true, needsAdult: item.rating === 'amber' || item.rating === 'red', needsProfessional: item.rating === 'red' };
  if (item.healthModule && !child.health.modules[item.healthModule]) return { visible: false, reason: 'health-off' };
  if (child.areasOff.includes(item.area)) return { visible: false, reason: 'area-off' };
  // Health modules are never offered outside their own age bands, whatever the level.
  const band = ageBandFor(ageFromBirth(child.birth, now));
  if (item.healthModule && !item.ageBands.includes(band)) return { visible: false, reason: 'age' };
  if (!item.ageBands.some((b) => allowedBands(child, now).includes(b))) return { visible: false, reason: 'age' };
  if (
    family?.settings.worldview === 'not-now' &&
    item.area === 'philosophy-worldviews' &&
    WORLDVIEW_SUBJECTS.includes(item.subject.toLowerCase())
  )
    return { visible: false, reason: 'worldview' };
  return {
    visible: true,
    needsAdult: item.rating === 'amber' || item.rating === 'red',
    needsProfessional: item.rating === 'red',
  };
}

export function isVisible(item: ItemMeta, child: Child, family?: Family, now = new Date(), opts: GateOptions = {}): boolean {
  return visibilityFor(item, child, family, now, opts).visible;
}
