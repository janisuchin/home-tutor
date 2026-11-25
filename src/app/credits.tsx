/** Credits (D-052, D-053): every photo's author, source and licence, and the free books' licences. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Card, Grid, Screen, Section, Txt } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { useT } from '../i18n';
import { usePhotoData } from '../data/photos';
import { Photo, creditText } from '../ui/Photo';
import { loadBooks } from '../content/loader';
import type { Book } from '../core/content-types';

export default function Credits() {
  const t = useT();
  const th = useTheme();
  const data = usePhotoData();
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    loadBooks().then(setBooks).catch(() => {});
  }, []);
  const free = books.filter((b) => b.freeRead);
  const photos = [...(data?.photos ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <Screen title={t('credits.title')} testID="credits">
      <Txt>{t('credits.intro')}</Txt>
      <Section title={t('credits.photos', { n: photos.length })}>
        <Grid columns={th.layout === 'phone' ? 1 : th.layout === 'tablet' ? 2 : 3}>
          {photos.map((p) => (
            <Card key={p.id} testID={`credit-${p.id}`}>
              <Photo photo={p} thumb maxHeight={160} />
              <View style={{ gap: 2 }}>
                <Txt variant="small">{creditText(t, p)}</Txt>
                <Txt variant="small">{p.credit.provider} · {p.credit.sourceUrl}</Txt>
                <Txt variant="small">{p.credit.licenceUrl}</Txt>
                <Txt variant="small">{p.credit.changes}</Txt>
              </View>
            </Card>
          ))}
        </Grid>
      </Section>
      {free.length ? (
        <Section title={t('credits.books')}>
          {free.map((b) => (
            <Txt key={b.id} variant="small">
              {b.title}, {b.author} ({b.year}): {b.freeRead!.source}, {b.freeRead!.licence}
            </Txt>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
