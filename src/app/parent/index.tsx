/** Parent dashboard (brief section 32): see and control everything. */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Grid, Notice, Pill, Row, Screen, Section, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { colors, mascotColors, space, useTheme } from '../../ui/theme';
import { useT } from '../../i18n';
import { lockParent, useAppState } from '../../data/store';
import { useCatalog, useChildren } from '../../data/hooks';
import { deriveProgress } from '../../core/engine/progress';
import { ageFromBirth } from '../../core/model';
import { minutesLeft } from '../../core/screen-time';

export default function ParentScreen() {
  const t = useT();
  return (
    <ParentGate title={t('parent.title')}>
      <ParentDashboard />
    </ParentGate>
  );
}

function ParentDashboard() {
  const t = useT();
  const th = useTheme();
  const family = useAppState((s) => s.family)!;
  const account = useAppState((s) => s.account);
  const sync = useAppState((s) => s.sync);
  const events = useAppState((s) => s.events);
  const usage = useAppState((s) => s.usage);
  const children = useChildren();
  const catalog = useCatalog();
  const rows = useMemo(
    () =>
      catalog
        ? children.map((c) => {
            const p = deriveProgress(c, events, catalog);
            const questions = events.filter((e) => e.childId === c.id && e.type === 'question').length;
            return { c, p, questions };
          })
        : [],
    [children, events, catalog],
  );

  return (
    <Screen
      title={t('parent.title')}
      back="/"
      testID="parent-dashboard"
      right={<Button small variant="ghost" icon="🔒" label={t('parent.lock')} onPress={() => { lockParent(); router.replace('/'); }} />}
    >
      <Txt>{t('parent.intro')}</Txt>
      {!account ? (
        <Notice text={t('parent.notSignedIn')} icon="☁️" />
      ) : (
        <Notice tone="ok" text={t('parent.synced', { when: sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : t('common.never'), pending: sync.dirty.length })} />
      )}

      <Section
        title={t('parent.children')}
        right={<Button small icon="➕" label={t('parent.addChild')} onPress={() => router.push('/parent/child-edit')} testID="add-child" />}
      >
        <Grid columns={th.layout === 'phone' ? 1 : 2}>
          {rows.map(({ c, p, questions }) => {
            const modules = Object.entries(c.health.modules).filter(([, on]) => on).map(([m]) => m);
            const left = minutesLeft(c.dailyMinutes, usage[c.id]);
            return (
              <Card key={c.id} testID={`parent-child-${c.name}`} onPress={() => router.push(`/parent/child/${c.id}`)} accessibilityLabel={c.name} tint={mascotColors[c.color] + '18'}>
                <Row>
                  <Txt variant="title">{c.avatar}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{c.name}</Txt>
                    <Txt variant="small">{t('picker.age', { age: ageFromBirth(c.birth) })}</Txt>
                  </View>
                </Row>
                <Row wrap>
                  <Pill text={t('parent.completed', { n: p.completed.size })} />
                  <Pill text={t('parent.minutesToday', { n: p.minutesToday })} />
                  {Number.isFinite(left) ? <Pill text={t('home.minutesLeft', { n: Math.round(left) })} /> : null}
                  {questions ? <Pill text={t('parent.questions', { n: questions })} bg={colors.skySoft} fg={colors.sky} /> : null}
                </Row>
                <Txt variant="small">
                  {t('parent.health')}: {modules.length ? modules.map((m) => t(`health.${m}`)).join(', ') : t('parent.healthOff')}
                </Txt>
              </Card>
            );
          })}
        </Grid>
      </Section>

      <Grid columns={th.layout === 'phone' ? 1 : 3}>
        <Button variant="secondary" icon="⚙️" label={t('parent.settings')} onPress={() => router.push('/parent/settings')} testID="family-settings" />
        <Button variant="ghost" icon="☁️" label={account ? t('parent.account') : t('parent.signIn')} onPress={() => router.push('/account')} />
        <Button variant="ghost" icon="🏫" label={t('nav.classroom')} onPress={() => router.push('/classroom')} />
      </Grid>
      <Grid columns={th.layout === 'phone' ? 1 : 3}>
        <Button variant="ghost" icon="🧑‍🏫" label={t('nav.tutor')} onPress={() => router.push('/tutor')} />
        <Button variant="ghost" icon="📚" label={t('books.parentTitle')} testID="open-parent-books" onPress={() => router.push('/parent/books')} />
        <Button variant="ghost" icon="✉️" label={t('tutors.title')} testID="open-tutors" onPress={() => router.push('/parent/tutors')} />
        <Button variant="ghost" icon="🚑" label={t('nav.emergency')} onPress={() => router.push('/emergency')} />
      </Grid>
      <Card tint={colors.surfaceAlt}>
        <Txt variant="small">
          {t('parent.mode')}: {t('mode.label', { m: family.mode })} · {t(`mode.${family.mode}.title`)}
        </Txt>
        <Txt variant="small">{t('parent.notTeacher')}</Txt>
      </Card>
    </Screen>
  );
}
