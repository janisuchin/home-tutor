import { useEffect, useMemo, useState } from 'react';
import type { Catalog } from '../core/catalog';
import type { AreaPack, ContentItem, VocabPack } from '../core/content-types';
import { loadCatalog, getCatalogSync, loadPack, loadVocab } from '../content/loader';
import { useAppState } from './store';
import { deriveProgress } from '../core/engine/progress';
import type { Child, ProgressEvent } from '../core/model';

let catalogPromise: Promise<Catalog> | undefined;

export function useCatalog(): Catalog | undefined {
  const [c, setC] = useState<Catalog | undefined>(getCatalogSync());
  useEffect(() => {
    if (c) return;
    catalogPromise ??= loadCatalog();
    let alive = true;
    catalogPromise.then((x) => alive && setC(x)).catch(() => {
      catalogPromise = undefined;
    });
    return () => {
      alive = false;
    };
  }, [c]);
  return c;
}

export function usePack(area: string | undefined): AreaPack | undefined {
  const [p, setP] = useState<AreaPack>();
  useEffect(() => {
    if (!area) return;
    let alive = true;
    loadPack(area).then((x) => alive && setP(x)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [area]);
  return p;
}

export function useItem(itemId: string | undefined): { item?: ContentItem; loading: boolean } {
  const catalog = useCatalog();
  const meta = catalog?.items.find((i) => i.id === itemId);
  const pack = usePack(meta?.area);
  const item = pack?.items.find((i) => i.id === itemId);
  return { item, loading: !catalog || (!!meta && !pack) };
}

export function useVocab(code: string | undefined): VocabPack | undefined {
  const [v, setV] = useState<VocabPack>();
  useEffect(() => {
    if (!code) return;
    let alive = true;
    loadVocab(code).then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, [code]);
  return v;
}

export function useChild(id: string | undefined): Child | undefined {
  const children = useAppState((s) => s.children);
  const c = id ? children[id] : undefined;
  return c && !c.deleted ? c : undefined;
}

export function useChildren(): Child[] {
  const children = useAppState((s) => s.children);
  return useMemo(() => Object.values(children).filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)), [children]);
}

export function useChildEvents(childId: string | undefined): ProgressEvent[] {
  const events = useAppState((s) => s.events);
  return useMemo(() => events.filter((e) => e.childId === childId), [events, childId]);
}

export function useProgress(child: Child | undefined) {
  const catalog = useCatalog();
  const events = useChildEvents(child?.id);
  return useMemo(() => (child && catalog ? deriveProgress(child, events, catalog) : undefined), [child, catalog, events]);
}
