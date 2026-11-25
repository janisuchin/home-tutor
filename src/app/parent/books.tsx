/** Parent: the reading list per age band; hide a book or mark it approved (D-053). */
import React, { useEffect, useMemo, useState } from 'react';
import { Choice, Notice, Row, Screen, Txt, Chip } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { useT } from '../../i18n';
import { useAppState, saveFamily, getState } from '../../data/store';
import { loadBooks } from '../../content/loader';
import { BookCard } from '../../ui/BookCard';
import { AGE_BANDS, type AgeBand, type Book } from '../../core/content-types';

export default function ParentBooks() {
  const t = useT();
  return (
    <ParentGate title={t('books.parentTitle')}>
      <Inner />
    </ParentGate>
  );
}

function Inner() {
  const t = useT();
  const family = useAppState((s) => s.family);
  const [books, setBooks] = useState<Book[]>([]);
  const [band, setBand] = useState<AgeBand>('6-8');
  useEffect(() => {
    loadBooks().then(setBooks).catch(() => {});
  }, []);
  const list = useMemo(() => books.filter((b) => b.band === band).sort((a, b) => a.title.localeCompare(b.title)), [books, band]);
  const prefs = family?.settings.bookPrefs ?? {};
  const setPref = (id: string, v: 'hidden' | 'approved' | undefined) => {
    const f = getState().family;
    if (!f) return;
    const next = { ...(f.settings.bookPrefs ?? {}) };
    if (v) next[id] = v;
    else delete next[id];
    saveFamily({ ...f, settings: { ...f.settings, bookPrefs: next } });
  };
  return (
    <Screen title={`📚 ${t('books.parentTitle')}`} testID="parent-books">
      <Txt>{t('books.parentIntro')}</Txt>
      <Notice text={t('books.realOnly')} />
      <Choice testID="books-band" value={band} onChange={setBand} options={AGE_BANDS.map((b) => ({ value: b, label: t('books.band', { band: b }) }))} />
      <Txt variant="small">{t('books.count', { n: list.length })}</Txt>
      {list.map((b) => (
        <BookCard key={b.id} book={b} testID={`pbook-${b.id}`}>
          <Row wrap>
            <Chip testID={`approve-${b.id}`} icon="👍" label={t('books.approve')} selected={prefs[b.id] === 'approved'} onPress={() => setPref(b.id, prefs[b.id] === 'approved' ? undefined : 'approved')} />
            <Chip testID={`hide-${b.id}`} icon="🙈" label={t('books.hide')} selected={prefs[b.id] === 'hidden'} onPress={() => setPref(b.id, prefs[b.id] === 'hidden' ? undefined : 'hidden')} />
          </Row>
        </BookCard>
      ))}
    </Screen>
  );
}
