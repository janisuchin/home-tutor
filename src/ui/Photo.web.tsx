/**
 * Web photo (D-052): a plain <img> with loading="lazy", width/height for no layout shift, alt text,
 * a hover title, and the credit on tap. Files are self-hosted on the Worker (/photos/*.webp), so no
 * third-party request ever leaves a family's browser; the service worker caches them after viewing.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from './kit';
import { colors, radius } from './theme';
import { useT } from '../i18n';
import { photoUrl } from '../core/photos';
import type { Photo as PhotoT } from '../core/content-types';

export function creditText(t: (k: string, v?: any) => string, p: PhotoT) {
  return t('photo.credit', { title: p.credit.title, author: p.credit.author || t('photo.unknownAuthor'), licence: p.credit.licence });
}

export function Photo({ photo, thumb, maxHeight = 320 }: { photo: PhotoT; thumb?: boolean; maxHeight?: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const credit = creditText(t, photo);
  return (
    <View testID={`photo-${photo.id}`} style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      <img
        src={photoUrl('', photo, thumb)}
        alt={photo.alt}
        title={credit}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight, objectFit: 'cover' }}
      />
      <Pressable
        testID={`photo-credit-${photo.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('photo.showCredit')}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={{ position: 'absolute', right: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
      >
        <Txt variant="small" color="#fff" bold>
          ⓘ
        </Txt>
      </Pressable>
      {open ? (
        <View style={{ padding: 8, gap: 2 }} testID={`photo-credit-text-${photo.id}`}>
          <Txt variant="small">{credit}</Txt>
          <Txt variant="small">
            <a href={photo.credit.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>
              {t('photo.source')}
            </a>
            {' · '}
            <a href={photo.credit.licenceUrl} target="_blank" rel="noopener noreferrer license" style={{ color: colors.primary }}>
              {t('photo.licence')}
            </a>
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
