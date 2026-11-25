/**
 * Native content loader: all content is bundled in the app (works with no network at all).
 * The web build uses loader.web.ts instead.
 */
import type { Catalog } from '../core/catalog';
import type { AreaPack, Career, EmergencyNumber, VocabPack } from '../core/content-types';
import * as gen from '../content-generated';

export async function loadCatalog(): Promise<Catalog> {
  return gen.catalog as Catalog;
}
export function getCatalogSync(): Catalog | undefined {
  return gen.catalog as Catalog;
}
export async function loadPack(area: string): Promise<AreaPack> {
  return gen.packs[area] as AreaPack;
}
export const loadEmergencyNumbers = async () => gen.emergencyNumbers as EmergencyNumber[];
export const loadCareers = async () => gen.careers as Career[];
export const loadVocab = async (code: string) => gen.languages[code] as VocabPack | undefined;
export async function downloadAllForOffline(_onProgress?: (done: number, total: number) => void): Promise<number> {
  return 0; // already on the device
}
