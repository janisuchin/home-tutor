/** Skill trees with visible progression (brief section 26). */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Grid, ProgressBar, Row, Screen, Txt } from '../../../ui/kit';
import { areaColors, colors, space, useTheme } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { useCatalog, useChild, useProgress } from '../../../data/hooks';

export default function Skills() {
  const t = useT();
  const th = useTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const catalog = useCatalog();
  const progress = useProgress(child);
  if (!catalog || !progress) return <Screen title={t('common.loading')}>{null}</Screen>;
  const trees = catalog.skillTrees
    .filter((tr) => !child.areasOff.includes(tr.area))
    .map((tr) => ({ tr, done: progress.skillNodesDone.get(tr.id) ?? new Set<string>() }))
    .sort((a, b) => b.done.size - a.done.size);
  return (
    <Screen title={t('skills.title')} back={`/learn/${childId}`} testID="skills-screen">
      <Txt>{t('skills.intro')}</Txt>
      <Grid columns={th.layout === 'phone' ? 1 : 2}>
        {trees.map(({ tr, done }) => (
          <Card key={tr.id} tint={done.size ? areaColors[tr.area]?.bg : undefined} testID={`tree-${tr.id}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="h3">
                {tr.emoji} {tr.title}
              </Txt>
              <Txt variant="small">
                {done.size}/{tr.nodes.length}
              </Txt>
            </Row>
            <ProgressBar value={done.size / tr.nodes.length} label={tr.title} color={areaColors[tr.area]?.fg} />
            <View style={{ gap: 2, marginTop: space.xs }}>
              {tr.nodes.map((n, i) => {
                const reached = done.has(n.id);
                return (
                  <View key={n.id}>
                    <Row>
                      <Txt>{reached ? '✅' : '⚪'}</Txt>
                      <Txt bold={reached} style={{ flex: 1 }} color={reached ? colors.text : colors.muted}>
                        {n.title}
                      </Txt>
                    </Row>
                    {i < tr.nodes.length - 1 ? (
                      <Txt variant="small" style={{ marginLeft: 6 }}>
                        ↓
                      </Txt>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Card>
        ))}
      </Grid>
    </Screen>
  );
}
