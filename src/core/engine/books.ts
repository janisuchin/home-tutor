/**
 * Reading suggestions (D-053): which real books to offer a child next. Rule-based and offline,
 * like the what-next engine: age band, interests, goals, areas being learned, parent choices.
 */
import { AGE_BANDS, type Book } from '../content-types';
import type { Child, Family, ProgressEvent } from '../model';
import { ageBandFor, ageFromBirth } from '../model';
import type { Reason } from './recommend';

export interface BookSuggestion {
  book: Book;
  score: number;
  reasons: Reason[];
  approved: boolean;
}

export function readBookIds(events: ProgressEvent[]): Set<string> {
  return new Set(events.filter((e) => e.type === 'book' && e.bookId).map((e) => e.bookId!));
}

/** Books a child may see: their band and the band below (easy reads), never hidden ones. */
export function booksFor(books: Book[], child: Child, family: Family | undefined, now = new Date()): Book[] {
  const band = ageBandFor(ageFromBirth(child.birth, now));
  const i = AGE_BANDS.indexOf(band);
  const bands = new Set([band, AGE_BANDS[Math.max(0, i - 1)]]);
  const prefs = family?.settings.bookPrefs ?? {};
  return books.filter((b) => bands.has(b.band) && prefs[b.id] !== 'hidden');
}

export function suggestBooks(books: Book[], child: Child, family: Family | undefined, events: ProgressEvent[], now = Date.now(), limit = 6): BookSuggestion[] {
  const date = new Date(now);
  const band = ageBandFor(ageFromBirth(child.birth, date));
  const read = readBookIds(events);
  const prefs = family?.settings.bookPrefs ?? {};
  const interests = new Set(child.interests.map((x) => x.toLowerCase()));
  const readTypes = events.filter((e) => e.type === 'book' && e.bookId).map((e) => books.find((b) => b.id === e.bookId)?.type);
  const fiction = readTypes.filter((t) => t === 'fiction').length;
  const nonFiction = readTypes.filter((t) => t === 'non-fiction').length;
  const out: BookSuggestion[] = [];
  for (const book of booksFor(books, child, family, date)) {
    if (read.has(book.id)) continue;
    const reasons: Reason[] = [];
    let score = book.band === band ? 3 : 1;
    const interest = book.interests.find((x) => interests.has(x.toLowerCase()));
    if (interest) {
      score += 4;
      reasons.push({ key: 'reason.interest', vars: { interest } });
    }
    const goal = child.goals.find((g) => book.interests.some((x) => g.toLowerCase().includes(x)) || g.toLowerCase().includes(book.genre.toLowerCase()));
    if (goal) {
      score += 2;
      reasons.push({ key: 'reason.goal', vars: { goal } });
    }
    if (child.areasOff.some((a) => book.areas.includes(a))) score -= 3;
    // Balance fiction and non-fiction.
    if ((book.type === 'fiction' && fiction < nonFiction) || (book.type === 'non-fiction' && nonFiction < fiction)) {
      score += 1;
      reasons.push({ key: book.type === 'fiction' ? 'books.reason.story' : 'books.reason.facts' });
    }
    // A book in a language the child speaks (Hindi, Gujarati...) besides English.
    const lang = (book.languages ?? []).find((l) => l !== 'en' && (child.languagesSpoken.some((x) => x.startsWith(l)) || child.primaryLanguage.startsWith(l)));
    if (lang) {
      score += 2;
      reasons.push({ key: 'books.reason.language' });
    }
    const approved = prefs[book.id] === 'approved';
    if (approved) {
      score += 3;
      reasons.push({ key: 'books.reason.approved' });
    }
    if (book.freeRead) {
      score += 1;
      reasons.push({ key: 'books.reason.free' });
    }
    score += (hash(book.id + child.id) % 100) / 1000;
    out.push({ book, score, reasons, approved });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A friendly card look for a book without a cover image (publisher covers are copyrighted). */
export function bookCardLook(book: Pick<Book, 'id' | 'genre' | 'type' | 'interests'>): { emoji: string; hue: number } {
  const g = `${book.genre} ${book.interests.join(' ')}`.toLowerCase();
  const pairs: [RegExp, string][] = [
    [/space|astronom/, '🚀'], [/dinosaur/, '🦕'], [/horse/, '🐴'], [/dog/, '🐶'], [/cat/, '🐱'], [/bird/, '🐦'], [/insect|bug/, '🐞'],
    [/ocean|sea|fish/, '🐠'], [/animal/, '🦁'], [/plant|garden|tree|nature/, '🌳'], [/poem|poetry/, '📝'], [/folk|myth|fable|fairy/, '🪔'],
    [/biograph|memoir/, '🧑'], [/history/, '🏛️'], [/science/, '🔬'], [/math|count/, '🔢'], [/money/, '🪙'], [/music/, '🎵'], [/art|draw/, '🎨'],
    [/sport|cricket|football/, '⚽'], [/cook|food/, '🍲'], [/computer|tech|machine|robot/, '🤖'], [/mystery/, '🔍'], [/fantasy|magic/, '🐉'], [/adventure/, '🧭'],
  ];
  const emoji = pairs.find(([re]) => re.test(g))?.[1] ?? (book.type === 'fiction' ? '📖' : '📘');
  return { emoji, hue: hash(book.id) % 360 };
}
