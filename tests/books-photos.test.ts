import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { child, family, NOW, root } from './helpers';
import type { Book, Photo } from '../src/core/content-types';
import { booksFor, bookCardLook, readBookIds, suggestBooks } from '../src/core/engine/books';
import { buildPhotoIndex, photosFor, ALLOWED_LICENCE } from '../src/core/photos';
import { validateBook, validatePhoto } from '../scripts/validate-content';

const book = (p: Partial<Book>): Book => ({
  id: 'b',
  title: 'T',
  author: 'A',
  year: 2000,
  band: '6-8',
  type: 'fiction',
  genre: 'adventure',
  interests: [],
  areas: ['languages'],
  why: 'Fun',
  verify: { source: 'openlibrary', workKey: '/works/OL1W' },
  ...p,
});
const BOOKS: Book[] = [
  book({ id: 'horse-story', interests: ['horses'], band: '6-8' }),
  book({ id: 'space-facts', type: 'non-fiction', interests: ['space'], band: '6-8' }),
  book({ id: 'baby-book', band: '3-5' }),
  book({ id: 'teen-book', band: '15-17' }),
  book({ id: 'hindi-tales', band: '6-8', languages: ['en', 'hi'], genre: 'folk tale' }),
];

describe('reading suggestions', () => {
  const kid = child({ birth: '2019-01', interests: ['horses'] }); // 7 years old
  it('offers the own band and the band below, never older bands or hidden books', () => {
    const ids = booksFor(BOOKS, kid, family(), new Date(NOW)).map((b) => b.id);
    expect(ids).toContain('baby-book');
    expect(ids).not.toContain('teen-book');
    const f = family({ settings: { ...family().settings, bookPrefs: { 'horse-story': 'hidden' } } });
    expect(booksFor(BOOKS, kid, f, new Date(NOW)).map((b) => b.id)).not.toContain('horse-story');
  });
  it('ranks by interest, parent approval and language, and skips books already read', () => {
    const s = suggestBooks(BOOKS, kid, family(), [], NOW);
    expect(s[0].book.id).toBe('horse-story');
    expect(s[0].reasons[0].key).toBe('reason.interest');
    const approved = family({ settings: { ...family().settings, bookPrefs: { 'space-facts': 'approved' } } });
    const s2 = suggestBooks(BOOKS, kid, approved, [{ id: 'e', childId: 'c1', at: NOW, type: 'book', bookId: 'horse-story', text: 'T', by: 'child' }], NOW);
    expect(s2.map((x) => x.book.id)).not.toContain('horse-story');
    expect(s2[0].book.id).toBe('space-facts');
    expect(s2[0].approved).toBe(true);
    const hindi = child({ birth: '2019-01', languagesSpoken: ['hi', 'en'] });
    expect(suggestBooks(BOOKS, hindi, family(), [], NOW)[0].book.id).toBe('hindi-tales');
  });
  it('records books read by id', () => {
    expect([...readBookIds([{ id: 'e', childId: 'c1', at: 1, type: 'book', bookId: 'x', by: 'child' }, { id: 'f', childId: 'c1', at: 1, type: 'book', text: 'free text', by: 'child' }])]).toEqual(['x']);
  });
  it('draws an original card instead of a publisher cover', () => {
    expect(bookCardLook(book({ genre: 'science', interests: ['space'] })).emoji).toBe('🚀');
    expect(bookCardLook(book({ id: 'x' })).hue).toBeGreaterThanOrEqual(0);
  });
  it('validator: every book needs a verification key, an age band and a type', () => {
    expect(validateBook(book({}))).toEqual([]);
    expect(validateBook(book({ verify: { source: 'openlibrary', workKey: '' } })).join()).toMatch(/verification key/);
    expect(validateBook(book({ band: '1-2' as any })).join()).toMatch(/age band/);
    expect(validateBook(book({ type: 'poem' as any })).join()).toMatch(/type/);
    expect(validateBook(book({ freeRead: { url: 'https://example.com/x', source: 'X', licence: 'PD' } })).join()).toMatch(/freeRead/);
  });
});

const photo = (p: Partial<Photo> = {}): Photo => ({
  id: 'zz-test-photo',
  title: 'Horse',
  alt: 'A brown horse in a field',
  areas: ['nature-animals'],
  links: ['item-1'],
  tags: ['horses'],
  width: 800,
  height: 600,
  bytes: 1000,
  thumbBytes: 100,
  credit: { title: 'Horse.jpg', author: 'Someone', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Horse.jpg', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', provider: 'Wikimedia Commons', changes: 'Resized' },
  ...p,
});
const ref = { itemIds: new Set(['item-1', 'health-1']), trees: new Map(), pathwayIds: new Set<string>(), careerIds: new Set<string>(), healthOnly: new Set(['health-1']) };

describe('photos', () => {
  it('indexes photos by the content they illustrate', () => {
    const a = photo({ id: 'a', links: ['item-1', 'tree-1'] });
    const b = photo({ id: 'b', links: ['tree-1'] });
    const idx = buildPhotoIndex([a, b]);
    expect(photosFor(idx, ['item-1', 'tree-1'])).toEqual([a]);
    expect(photosFor(idx, ['nothing', 'tree-1'], 2)).toEqual([a, b]);
    expect(photosFor(idx, [undefined, 'none'])).toEqual([]);
  });
  it('accepts only open licences', () => {
    for (const ok of ['CC0', 'CC0 1.0', 'Public domain', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0 DE']) expect(ALLOWED_LICENCE.test(ok)).toBe(true);
    for (const bad of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 2.0', 'GFDL', 'All rights reserved', '']) expect(ALLOWED_LICENCE.test(bad)).toBe(false);
  });
  it('validator fails a photo with no credit, a disallowed licence, a missing or oversized file, or a health link', () => {
    const errs = (p: Photo) => validatePhoto(p, root, ref).join('\n');
    expect(errs(photo({ credit: undefined as any }))).toMatch(/no credit/);
    expect(errs(photo({ credit: { ...photo().credit, licence: 'CC BY-NC 2.0' } }))).toMatch(/licence not allowed/);
    expect(errs(photo())).toMatch(/missing file/);
    expect(errs(photo({ links: ['health-1'] }))).toMatch(/diagrams/);
    expect(errs(photo({ links: ['nope'] }))).toMatch(/unknown link/);
    expect(errs(photo({ alt: '' }))).toMatch(/alt text/);
    const tmp = mkdtempSync(join(tmpdir(), 'ht-photo-'));
    mkdirSync(join(tmp, 'public', 'photos'), { recursive: true });
    writeFileSync(join(tmp, 'public', 'photos', 'zz-test-photo.webp'), Buffer.alloc(70_000));
    writeFileSync(join(tmp, 'public', 'photos', 'zz-test-photo-thumb.webp'), Buffer.alloc(1_000));
    expect(validatePhoto(photo(), tmp, ref).join('\n')).toMatch(/70000 bytes \(limit 61440\)/);
    writeFileSync(join(tmp, 'public', 'photos', 'zz-test-photo.webp'), Buffer.alloc(50_000));
    expect(validatePhoto(photo(), tmp, ref)).toEqual([]);
  });
});
