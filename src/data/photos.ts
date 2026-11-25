/** Loads the photo credits file once (a lazy content file, never part of the entry bundle). */
import { useEffect, useState } from 'react';
import { loadPhotos } from '../content/loader';
import { buildPhotoIndex, type PhotoIndex } from '../core/photos';
import type { Photo } from '../core/content-types';

let cache: Promise<{ photos: Photo[]; index: PhotoIndex }> | undefined;

export function getPhotos() {
  cache ??= loadPhotos()
    .then((photos) => ({ photos, index: buildPhotoIndex(photos) }))
    .catch(() => {
      cache = undefined;
      return { photos: [] as Photo[], index: buildPhotoIndex([]) };
    });
  return cache;
}

export function usePhotoData() {
  const [data, setData] = useState<{ photos: Photo[]; index: PhotoIndex }>();
  useEffect(() => {
    let live = true;
    getPhotos().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  return data;
}
