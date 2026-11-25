/** Tutor dashboard (brief section 33). */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Grid, Notice, Pill, Row, SafetyBadge, Screen, Section, Txt } from '../ui/kit';
import { ParentGate } from '../ui/ParentGate';
import { colors, useTheme } from '../ui/theme';
import { useT } from '../i18n';
import { useAppState } from '../data/store';
import { useCatalog, useChildren } from '../data/hooks';
import { tutorInsights, groupCompatibility } from '../core/engine/insights';
import { recommend } from '../core/engine/recommend';
import { deriveProgress } from '../core/engine/progress';
import { ageFromBirth } from '../core/model';
import { reasonText } from '../ui/reasons';

export default function TutorScreen() {
  const t = useT();
  return (
    <ParentGate title={t('tutor.title')}>
      <Tutor />
    </ParentGate>
  );
}

function Tutor() {
  const t = useT();
  const th = useTheme();
  const family = useAppState((s) => s.family);
  const events = useAppState((s) => s.events);
  const children = useChildren();
  const catalog = useCatalog();
  const data = useMemo(() => {
    if (!catalog) return [];
    return children.map((c) => {
      const p = deriveProgress(c, events, catalog);
      const recs = recommend(c, family, catalog, events, { progress: p });
      return {
        c,
        p,
        insights: tutorInsights(c, family, catalog, events),
        suggested: recs.slice(0, 3),
        safety: recs.filter((r) => r.needsAdult).slice(0, 3),
        projects: catalog.items.filter((i) => (i.kind === 'project' || i.kind === 'world-project') && p.completed.has(i.id)),
        checks: events.filter((e) => e.childId === c.id && (e.type === 'check' || e.type === 'simulation')).slice(-3),
      };
    });
  }, [children, events, catalog, family]);
  const compat = useMemo(() => (catalog && children.length > 1 ? groupCompatibility(children, family, catalog) : undefined), [children, catalog, family]);
  if (!catalog) return <Screen title={t('common.loading')}>{null}</Screen>;
  return (
    <Screen title={t('tutor.title')} testID="tutor">
      <Txt>{t('tutor.intro')}</Txt>
      {compat ? (
        <Card tint={colors.tealSoft}>
          <Txt variant="h3">🤝 {t('tutor.compat', { score: compat.score })}</Txt>
          <Txt variant="small">{t('tutor.compatBody', { spread: compat.bandSpread, shared: compat.sharedInterests.map((i) => t(`interest.${i}`)).join(', ') || '—' })}</Txt>
          <Button small variant="ghost" label={t('nav.classroom')} onPress={() => router.push('/classroom')} />
        </Card>
      ) : null}
      {data.map(({ c, p, insights, suggested, safety, projects, checks }) => (
        <Section key={c.id} title={`${c.avatar} ${c.name} · ${t('picker.age', { age: ageFromBirth(c.birth) })}`} testID={`tutor-${c.name}`}>
          {insights.map((i, k) => (
            <Notice key={k} text={t(i.reason.key, i.reason.vars)} icon={i.kind === 'safety' ? '⚠️' : i.kind === 'gap' ? '🧩' : '💡'} />
          ))}
          <Grid columns={th.layout === 'phone' ? 1 : 3}>
            <Card>
              <Txt variant="label">📌 {t('tutor.suggested')}</Txt>
              {suggested.map((r) => (
                <View key={r.item.id}>
                  <Txt bold>
                    {r.item.emoji} {r.item.title}
                  </Txt>
                  <Txt variant="small">{reasonText(t, r)}</Txt>
                </View>
              ))}
            </Card>
            <Card>
              <Txt variant="label">🛡️ {t('tutor.safety')}</Txt>
              {safety.length ? (
                safety.map((r) => (
                  <Row key={r.item.id} wrap>
                    {r.item.rating ? <SafetyBadge rating={r.item.rating} /> : null}
                    <Txt variant="small">{r.item.title}</Txt>
                  </Row>
                ))
              ) : (
                <Txt variant="small">{t('tutor.noSafety')}</Txt>
              )}
              {c.physicalNotes ? <Txt variant="small">🩺 {c.physicalNotes}</Txt> : null}
            </Card>
            <Card>
              <Txt variant="label">💛 {t('tutor.interests')}</Txt>
              <Row wrap>
                {c.interests.map((i) => (
                  <Pill key={i} text={t(`interest.${i}`)} />
                ))}
              </Row>
              <Txt variant="small">{t('tutor.assessments', { n: checks.length, done: p.completed.size, projects: projects.length })}</Txt>
            </Card>
          </Grid>
        </Section>
      ))}
    </Screen>
  );
}
