/** Dynamic learning map: all 17 areas with the child's level, plus interest pathways and careers. */
import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Card, Grid, Pill, Row, Screen, Section, Tile, Txt } from '../../../ui/kit';
import { areaColors, colors, useTheme } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { useCatalog, useChild, useProgress } from '../../../data/hooks';
import { useAppState } from '../../../data/store';
import { isVisible } from '../../../core/engine/gating';

export default function Explore() {
  const t = useT();
  const th = useTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const family = useAppState((s) => s.family);
  const catalog = useCatalog();
  const progress = useProgress(child);

  const areas = useMemo(() => {
    if (!catalog || !progress) return [];
    return catalog.areas
      .filter((a) => !child.areasOff.includes(a.area))
      .map((a) => {
        const items = catalog.items.filter((i) => i.area === a.area && isVisible(i, child, family));
        const done = items.filter((i) => progress.completed.has(i.id)).length;
        return { ...a, visible: items.length, done };
      })
      .filter((a) => a.visible > 0);
  }, [catalog, progress, child, family]);

  const map = useMemo(() => {
    if (!catalog || !progress) return [];
    // The learning map shows the child's level per subject (brief section 23).
    const subjects = new Map<string, { area: string; count: number }>();
    for (const i of catalog.items) if (isVisible(i, child, family)) subjects.set(i.subject, { area: i.area, count: (subjects.get(i.subject)?.count ?? 0) + 1 });
    return [...subjects.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([s, v]) => ({ subject: s, area: v.area, level: progress.subjectLevels.get(s) ?? 1 }))
      .sort((a, b) => a.area.localeCompare(b.area))
      .slice(0, 24);
  }, [catalog, progress, child, family]);

  const pathways = (catalog?.pathways ?? []).filter((p) => child.interests.includes(p.interest) || true);

  return (
    <Screen title={t('explore.title')} back={`/learn/${childId}`} testID="explore-screen">
      <Section title={`🗺️ ${t('explore.areas')}`}>
        <Grid columns={th.layout === 'phone' ? 2 : th.layout === 'tablet' ? 3 : 4}>
          {areas.map((a) => (
            <Tile
              key={a.area}
              testID={`area-${a.area}`}
              emoji={a.emoji}
              title={a.title}
              subtitle={t('explore.done', { a: a.done, b: a.visible })}
              tint={areaColors[a.area]?.bg}
              onPress={() => router.push(`/learn/${childId}/area/${a.area}`)}
            />
          ))}
        </Grid>
      </Section>

      {pathways.length ? (
        <Section title={`🧭 ${t('explore.pathways')}`}>
          <Txt variant="small">{t('explore.pathwaysHint')}</Txt>
          <Grid columns={th.layout === 'phone' ? 1 : 2}>
            {pathways.map((p) => (
              <Card key={p.id} testID={`pathway-${p.id}`} onPress={() => router.push(`/learn/${childId}/pathway/${p.id}`)} accessibilityLabel={p.title} tint={child.interests.includes(p.interest) ? colors.primarySoft : undefined}>
                <Txt variant="h3">
                  {p.emoji} {p.title}
                </Txt>
                <Txt variant="small">{p.steps.slice(0, 5).map((s) => s.title).join(' → ')} …</Txt>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      <Section title={`📈 ${t('explore.map')}`}>
        <Txt variant="small">{t('explore.mapHint')}</Txt>
        <Row wrap>
          {map.map((m) => (
            <Pill key={m.subject} text={`${m.subject} · ${t('common.level', { level: m.level })}`} fg={areaColors[m.area]?.fg} bg={areaColors[m.area]?.bg} />
          ))}
        </Row>
      </Section>

      <Card onPress={() => router.push(`/learn/${childId}/careers`)} tint={colors.amberSoft} accessibilityLabel={t('explore.careers')}>
        <Txt variant="h3">💼 {t('explore.careers')}</Txt>
        <Txt variant="small">{t('explore.careersHint')}</Txt>
      </Card>
    </Screen>
  );
}
