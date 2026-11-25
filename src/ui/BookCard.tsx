/** An original illustrated book card (no publisher cover images: they are copyrighted). */
import React from 'react';
import { View } from 'react-native';
import { Pill, Row, Txt } from './kit';
import { colors, radius, space } from './theme';
import { useT } from '../i18n';
import { bookCardLook } from '../core/engine/books';
import type { Book } from '../core/content-types';

export function BookCard({ book, children, testID }: { book: Book; children?: React.ReactNode; testID?: string }) {
  const t = useT();
  const look = bookCardLook(book);
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 64, height: 88, borderRadius: 6, backgroundColor: `hsl(${look.hue}, 70%, 86%)`, borderLeftWidth: 8, borderLeftColor: `hsl(${look.hue}, 55%, 40%)`, alignItems: 'center', justifyContent: 'center' }}
      >
        <Txt style={{ fontSize: 30, lineHeight: 36 }}>{look.emoji}</Txt>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="h3">{book.title}</Txt>
        <Txt variant="small">
          {book.author} · {book.year}
        </Txt>
        <Txt>{book.why}</Txt>
        <Row wrap>
          <Pill text={t(book.type === 'fiction' ? 'books.fiction' : 'books.nonFiction')} />
          <Pill text={book.genre} />
          {(book.languages ?? []).filter((l) => l !== 'en').map((l) => (
            <Pill key={l} text={t(`books.lang.${l === 'hi' || l === 'gu' ? l : 'other'}`)} bg={colors.tealSoft} />
          ))}
        </Row>
        {book.contentNotes ? <Txt variant="small">⚠️ {t('books.contentNote', { note: book.contentNotes })}</Txt> : null}
        {children}
      </View>
    </View>
  );
}
