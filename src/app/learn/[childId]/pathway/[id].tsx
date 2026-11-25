/** Interest pathway (the horse and bicycle examples): one interest opens many subjects. */
import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Row, Screen, Txt } from '../../../../ui/kit';
import { areaColors, colors, space } from '../../../../ui/theme';
import { useT } from '../../../../i18n';
import { useCatalog, useChild, useProgress } from '../../../../data/hooks';
import { useAppState } from '../../../../data/store';
import { isVisible } from '../../../../core/engine/gating';

export default function PathwayScreen() {
  const t = useT();
  const { childId, id } = useLocalSearchParams<{ childId: string; id: string }>();
  const child = useChild(childId)!;
  const family = useAppState((s) => s.family);
  const catalog = useCatalog();
  const progress = useProgress(child);
  const p = catalog?.pathways.find((x) => x.id === id);
  if (!p || !catalog) return <Screen title={t('common.loading')}>{null}</Screen>;
  return (
    <Screen title={`${p.emoji} ${p.title}`} testID="pathway">
      <Txt>{t('pathway.intro')}</Txt>
      {p.steps.map((s, i) => {
        const items = (s.itemIds ?? []).map((iid) => catalog.items.find((x) => x.id === iid)).filter((x): x is NonNullable<typeof x> => !!x && isVisible(x, child, family));
        const done = items.some((it) => progress?.completed.has(it.id));
        return (
          <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: done ? colors.green : areaColors[s.area]?.fg ?? colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Txt color={colors.white} bold>
                  {done ? '✓' : i + 1}
                </Txt>
              </View>
              {i < p.steps.length - 1 ? <View style={{ width: 4, flex: 1, backgroundColor: colors.border, minHeight: 24 }} /> : null}
            </View>
            <Card style={{ flex: 1, marginBottom: space.sm }} tint={areaColors[s.area]?.bg}>
              <Txt variant="h3">{s.title}</Txt>
              <Txt variant="small">{s.description}</Txt>
              <Row wrap>
                {items.map((it) => (
                  <Button key={it.id} small variant="ghost" label={`${it.emoji} ${it.title}`} onPress={() => router.push(`/learn/${childId}/item/${it.id}`)} />
                ))}
              </Row>
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
