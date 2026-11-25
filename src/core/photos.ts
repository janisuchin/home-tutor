/**
 * Photo index (D-052): which openly licensed photos illustrate which content ids. Pure and offline.
 */
import type { Photo } from './content-types';

/** Licences we accept (the repo and app are public): CC0, public domain, CC BY and CC BY-SA. */
export const ALLOWED_LICENCE = /^(CC0( 1\.0)?|Public domain|PDM( 1\.0)?|CC BY(-SA)? (2\.0|2\.5|3\.0|4\.0)( [A-Z]{2,3})?)$/i;
export const PHOTO_MAX_BYTES = 61_440; // 60 KB
export const THUMB_MAX_BYTES = 16_384; // 16 KB
export const PHOTO_MAX_WIDTH = 800;

export type PhotoIndex = Map<string, Photo[]>;

export function buildPhotoIndex(photos: Photo[]): PhotoIndex {
  const idx: PhotoIndex = new Map();
  for (const p of photos)
    for (const id of p.links) {
      const list = idx.get(id) ?? [];
      list.push(p);
      idx.set(id, list);
    }
  return idx;
}

/** Photos for the first ids that have any (e.g. the item itself, then its skill tree), deduplicated. */
export function photosFor(idx: PhotoIndex, ids: (string | undefined)[], limit = 1): Photo[] {
  const out: Photo[] = [];
  for (const id of ids) {
    if (!id) continue;
    for (const p of idx.get(id) ?? []) {
      if (out.length >= limit) return out;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

export const photoUrl = (base: string, p: Pick<Photo, 'id'>, thumb = false) => `${base}/photos/${p.id}${thumb ? '-thumb' : ''}.webp`;
