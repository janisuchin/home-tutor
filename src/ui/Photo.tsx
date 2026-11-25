/**
 * A real, openly licensed photo with its credit (D-052). Native version: React Native Image from
 * the Worker that serves the app (self-hosted, never hotlinked). The web version is Photo.web.tsx.
 */
import React, { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { Txt } from './kit';
import { colors, radius } from './theme';
import { useT } from '../i18n';
import { publicBase } from '../data/api';
import { photoUrl } from '../core/photos';
import type { Photo as PhotoT } from '../core/content-types';

export function creditText(t: (k: string, v?: any) => string, p: PhotoT) {
  return t('photo.credit', { title: p.credit.title, author: p.credit.author || t('photo.unknownAuthor'), licence: p.credit.licence });
}

export function Photo({ photo, thumb, maxHeight = 320 }: { photo: PhotoT; thumb?: boolean; maxHeight?: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View testID={`photo-${photo.id}`} style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${photo.alt}. ${t('photo.showCredit')}`} onPress={() => setOpen(!open)}>
        <Image source={{ uri: photoUrl(publicBase(), photo, thumb) }} accessibilityLabel={photo.alt} style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight }} resizeMode="cover" />
      </Pressable>
      {open ? (
        <View style={{ padding: 8, gap: 4 }}>
          <Txt variant="small">{creditText(t, photo)}</Txt>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(photo.credit.sourceUrl)}>
            <Txt variant="small" color={colors.primary}>
              {t('photo.source')}
            </Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
