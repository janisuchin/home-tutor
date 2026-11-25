/** Books (D-053): real books for the child's age, suggested by interest; read ones go to the passport. */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Choice, Row, Screen, Section, Txt } from '../../../ui/kit';
import { useT } from '../../../i18n';
import { useChild, useChildEvents } from '../../../data/hooks';
import { addEvent, useAppState } from '../../../data/store';
import { loadBooks } from '../../../content/loader';
import { booksFor, readBookIds, suggestBooks } from '../../../core/engine/books';
import { reasonText } from '../../../ui/reasons';
import { BookCard } from '../../../ui/BookCard';
import type { Book } from '../../../core/content-types';

export default function Books() {
  const t = useT();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const family = useAppState((s) => s.family);
  const events = useChildEvents(childId);
  const [books, setBooks] = useState<Book[]>([]);
  const [type, setType] = useState<'all' | 'fiction' | 'non-fiction'>('all');
  useEffect(() => {
    loadBooks().then(setBooks).catch(() => {});
  }, []);
  const read = readBookIds(events);
  const suggested = useMemo(() => suggestBooks(books, child, family, events), [books, child, family, events]);
  const all = useMemo(() => booksFor(books, child, family).filter((b) => type === 'all' || b.type === type).sort((a, b) => a.title.localeCompare(b.title)), [books, child, family, type]);
  const markRead = (b: Book) => addEvent({ childId: child.id, type: 'book', text: `${b.title} (${b.author})`, bookId: b.id, by: 'child' });
  const actions = (b: Book) => (
    <Row wrap>
      {read.has(b.id) ? (
        <Txt bold>✓ {t('books.read')}</Txt>
      ) : (
        <Button small testID={`read-${b.id}`} icon="✅" label={t('books.iReadIt')} onPress={() => markRead(b)} />
      )}
      {b.freeRead ? <Button small variant="ghost" icon="🌐" testID={`free-${b.id}`} label={t('books.readFree', { source: b.freeRead.source })} onPress={() => Linking.openURL(b.freeRead!.url)} /> : null}
    </Row>
  );
  return (
    <Screen title={`📚 ${t('books.title')}`} back={`/learn/${childId}`} testID="books-screen">
      <Txt>{t('books.intro')}</Txt>
      {suggested.length ? (
        <Section title={t('books.suggested')} testID="books-suggested">
          {suggested.map((s) => (
            <BookCard key={s.book.id} book={s.book} testID={`suggested-${s.book.id}`}>
              <Txt variant="small">💡 {reasonText(t, s, 2)}</Txt>
              {actions(s.book)}
            </BookCard>
          ))}
        </Section>
      ) : null}
      <Section title={t('books.all', { n: all.length })}>
        <Choice testID="books-type" value={type} onChange={setType} options={[{ value: 'all', label: t('books.allTypes') }, { value: 'fiction', label: t('books.fiction') }, { value: 'non-fiction', label: t('books.nonFiction') }]} />
        {all.map((b) => (
          <BookCard key={b.id} book={b} testID={`book-${b.id}`}>
            {actions(b)}
          </BookCard>
        ))}
      </Section>
    </Screen>
  );
}
