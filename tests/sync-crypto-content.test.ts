import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pickWinner, mergeInto, type SyncRecord } from '../src/core/sync/merge';
import { sha256Hex, hashPin, randomCode, formatCode, normaliseCode, randomId } from '../src/core/crypto';
import { validateAll, validateItem } from '../scripts/validate-content';
import { root } from './helpers';
import { AREA_IDS, type ContentItem } from '../src/core/content-types';
import { INTERESTS } from '../src/core/countries';

const rec = (p: Partial<SyncRecord>): SyncRecord => ({ kind: 'child', id: 'c1', updatedAt: 1, data: { name: 'A' }, ...p });

describe('sync merge', () => {
  it('last writer wins on mutable records', () => {
    const a = rec({ updatedAt: 1, data: { name: 'old' } });
    const b = rec({ updatedAt: 2, data: { name: 'new' } });
    expect(pickWinner(a, b)).toBe(b);
    expect(pickWinner(b, a)).toBe(b);
  });
  it('ties resolve the same way on every device', () => {
    const a = rec({ updatedAt: 5, data: { name: 'Asha' } });
    const b = rec({ updatedAt: 5, data: { name: 'Bina' } });
    expect(pickWinner(a, b)).toBe(pickWinner(b, a) === a ? a : b);
    expect(pickWinner(a, b).data).toEqual(pickWinner(b, a).data);
    const del = rec({ updatedAt: 5, deleted: true });
    expect(pickWinner(a, del)).toBe(del);
    expect(pickWinner(del, a)).toBe(del);
  });
  it('events are immutable and merge by union', () => {
    const store = new Map<string, SyncRecord>();
    mergeInto(store, [rec({ kind: 'event', id: 'e1', data: { v: 1 } }), rec({ kind: 'event', id: 'e2' })]);
    const changed = mergeInto(store, [rec({ kind: 'event', id: 'e1', updatedAt: 99, data: { v: 2 } }), rec({ kind: 'event', id: 'e3' })]);
    expect(store.size).toBe(3);
    expect(store.get('event:e1')!.data).toEqual({ v: 1 });
    expect(changed).toEqual(['event:e3']);
  });
  it('two offline devices converge after exchanging changes in any order', () => {
    const d1 = [rec({ updatedAt: 10, data: { name: 'phone' } }), rec({ kind: 'event', id: 'x' })];
    const d2 = [rec({ updatedAt: 12, data: { name: 'tablet' } }), rec({ kind: 'event', id: 'y' })];
    const s1 = new Map<string, SyncRecord>();
    const s2 = new Map<string, SyncRecord>();
    mergeInto(s1, d1);
    mergeInto(s1, d2);
    mergeInto(s2, d2);
    mergeInto(s2, d1);
    expect([...s1.entries()].sort()).toEqual([...s2.entries()].sort());
    expect(s1.get('child:c1')!.data).toEqual({ name: 'tablet' });
  });
});

describe('crypto', () => {
  it('sha256 matches known vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });
  it('PIN hashes depend on salt and PIN', () => {
    expect(hashPin('1234', 's1')).toBe(hashPin('1234', 's1'));
    expect(hashPin('1234', 's1')).not.toBe(hashPin('1234', 's2'));
    expect(hashPin('1234', 's1')).not.toBe(hashPin('1235', 's1'));
  });
  it('codes avoid look-alike characters and round-trip formatting', () => {
    const c = randomCode(12);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(normaliseCode(formatCode(c).toLowerCase())).toBe(c);
    expect(randomId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('content validator', () => {
  it('all starter content passes', () => {
    const r = validateAll(root);
    expect(r.errors).toEqual([]);
    expect(r.stats.items).toBeGreaterThan(300);
    expect(r.stats.simulations).toBeGreaterThan(5);
  });
  const base: ContentItem = {
    id: 'life-test',
    kind: 'activity',
    area: 'life-skills',
    subject: 'cooking',
    title: 'Test',
    emoji: '🍳',
    ageBands: ['6-8'],
    level: 2,
    minutes: 10,
    summary: 'x',
    steps: ['a'],
    practical: true,
    competencies: [],
    skills: [],
    interests: [],
  };
  const errs = (i: Partial<ContentItem>, area = 'life-skills') => {
    const e: string[] = [];
    validateItem({ ...base, ...i } as ContentItem, area, e, []);
    return e.join('\n');
  };
  it('fails on a practical item without safety, versions or substitutions', () => {
    const e = errs({});
    expect(e).toMatch(/safety rating required/);
    expect(e).toMatch(/versions required/);
    expect(e).toMatch(/substitution required/);
  });
  it('fails on missing age bands and on amber items without sources', () => {
    expect(errs({ ageBands: [] })).toMatch(/ageBands required/);
    expect(errs({ safety: { rating: 'amber', hazards: [], notes: 'n' } })).toMatch(/sources required/);
  });
  it('fails on health content without a review label', () => {
    const e = errs({ area: 'health', practical: false, healthModule: 'body-basics', sources: [{ title: 't', publisher: 'WHO', url: 'https://www.who.int' }] }, 'health');
    expect(e).toMatch(/reviewStatus/);
  });
  it('every health and first-aid item cites a source and health items carry the review label', () => {
    for (const area of ['health', 'first-aid']) {
      const pack = JSON.parse(readFileSync(join(root, 'content', 'areas', `${area}.json`), 'utf8'));
      for (const it of pack.items) {
        expect(it.sources?.length, it.id).toBeGreaterThan(0);
        if (area === 'health') expect(it.reviewStatus, it.id).toBe('awaiting-medical-review');
      }
    }
  });
  it('animal content never claims humans can talk with animals', () => {
    const pack = readFileSync(join(root, 'content', 'areas', 'nature-animals.json'), 'utf8').toLowerCase();
    expect(pack).not.toMatch(/talk to (the )?animals like|speak animal language|animals understand (your|our) words/);
  });
});

describe('i18n', () => {
  const en = JSON.parse(readFileSync(join(root, 'src', 'i18n', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
  function walk(d: string): string[] {
    return readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.match(/\.tsx?$/) ? [join(d, f)] : []));
  }
  it('every static t() key used in the app exists in en.json', () => {
    const missing: string[] = [];
    for (const f of walk(join(root, 'src'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(['"]([a-zA-Z0-9_.-]+)['"]/g)) if (!(m[1] in en)) missing.push(`${m[1]} (${f.split('/src/')[1]})`);
      for (const m of src.matchAll(/key: '([a-z]+\.[a-zA-Z]+)'/g)) if (!(m[1] in en)) missing.push(m[1]);
    }
    expect(missing).toEqual([]);
  });
  it('dynamic key families are complete', () => {
    const families: Record<string, string[]> = {
      'mode.{}.title': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      'area.{}': [...AREA_IDS],
      'stage.{}': ['knows', 'understands', 'can-demonstrate', 'can-apply', 'can-teach'],
      'safety.{}': ['green', 'amber', 'red'],
      'kind.{}': ['lesson', 'activity', 'simulation', 'project', 'world-project'],
      'group.{}': ['academic', 'life', 'physical', 'emergency', 'digital', 'global', 'intellectual', 'practical', 'personal'],
      'interest.{}': INTERESTS.map((i) => i.tag),
      'badge.{}': ['first-step', 'busy-bee', 'hard-worker', 'question-asker', 'explorer', 'try-again', 'never-give-up', 'i-can-do-it', 'skilled-hands', 'team-player', 'real-world', 'helper', 'bookworm'],
    };
    const missing: string[] = [];
    for (const [pattern, values] of Object.entries(families)) for (const v of values) if (!(pattern.replace('{}', v) in en)) missing.push(pattern.replace('{}', v));
    expect(missing).toEqual([]);
  });
});
