import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Grid, Row, SafetyBadge, Pill, Screen, Tile, Txt } from '../../../../ui/kit';
import { areaColors, colors, useTheme } from '../../../../ui/theme';
import { useT } from '../../../../i18n';
import { useCatalog, useChild, useChildEvents } from '../../../../data/hooks';
import { useAppState } from '../../../../data/store';
import { recommend } from '../../../../core/engine/recommend';
import { reasonText } from '../../../../ui/reasons';
import type { AreaId } from '../../../../core/content-types';

export default function AreaScreen() {
  const t = useT();
  const th = useTheme();
  const { childId, area } = useLocalSearchParams<{ childId: string; area: AreaId }>();
  const child = useChild(childId)!;
  const family = useAppState((s) => s.family);
  const catalog = useCatalog();
  const events = useChildEvents(childId);
  const recs = useMemo(() => (catalog ? recommend(child, family, catalog, events, { areas: [area] }) : []), [catalog, child, family, events, area]);
  const meta = catalog?.areas.find((a) => a.area === area);
  const doneIds = new Set(events.filter((e) => e.type === 'completed').map((e) => e.itemId));
  return (
    <Screen title={meta ? `${meta.emoji} ${meta.title}` : ''} testID="area-screen">
      {meta ? <Txt>{meta.description}</Txt> : null}
      <Grid columns={th.layout === 'phone' ? (th.look === 'picture' ? 2 : 1) : th.layout === 'tablet' ? 2 : 3}>
        {recs.map((r) => (
          <Tile
            key={r.item.id}
            testID={`item-${r.item.id}`}
            emoji={r.item.emoji}
            title={r.item.title}
            subtitle={reasonText(t, r, 1)}
            tint={doneIds.has(r.item.id) ? colors.greenSoft : areaColors[r.item.area]?.bg}
            onPress={() => router.push(`/learn/${childId}/item/${r.item.id}`)}
            badge={
              <Row wrap style={{ justifyContent: 'center' }}>
                {r.item.rating ? <SafetyBadge rating={r.item.rating} /> : null}
                {th.look !== 'picture' ? <Pill text={t(`kind.${r.item.kind}`)} /> : null}
              </Row>
            }
          />
        ))}
      </Grid>
      {!recs.length ? <Txt>{t('area.empty')}</Txt> : null}
    </Screen>
  );
}
