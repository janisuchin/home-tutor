/**
 * Review edition (D-051): on first open there is a ready-made review family with no parent PIN and
 * three learners, so the owner can look at everything at once. Normal builds never call this.
 */
import { randomId } from '../core/crypto';
import { DEFAULT_FAMILY_SETTINGS, newChild, type Child } from '../core/model';
import { getState, saveChild, saveFamily } from './store';

export function ensureReviewFamily(now = new Date()) {
  const s = getState();
  if (s.family) return;
  const id = randomId();
  saveFamily({ id, name: 'Review family', mode: 'E', country: 'IN', consentAt: now.getTime(), settings: { ...DEFAULT_FAMILY_SETTINGS }, updatedAt: now.getTime() });
  const y = now.getFullYear();
  const kids: Partial<Child>[] = [
    { name: 'Reviewer 4', birth: `${y - 4}-01`, sex: 'girl', avatar: '🐣' },
    { name: 'Reviewer 9', birth: `${y - 9}-01`, sex: 'boy', avatar: '🦊' },
    { name: 'Reviewer 15', birth: `${y - 15}-01`, sex: 'unspecified', avatar: '🦉' },
  ];
  for (const k of kids) {
    saveChild(
      newChild({
        id: randomId(),
        familyId: id,
        name: k.name!,
        birth: k.birth!,
        ...k,
        // Every health pathway is visible for review, still labelled Awaiting review by a medical professional.
        health: { modules: { 'body-basics': true, 'growing-up-girl': true, 'growing-up-boy': true, 'adolescent-health': true }, guidance: 'parent' },
      }),
    );
  }
}
