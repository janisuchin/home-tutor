/** Parent view of one child: everything from brief section 32 in one place. */
import { confirmAsync } from '../../../ui/confirm';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Grid, Notice, Pill, Row, Screen, Section, Txt } from '../../../ui/kit';
import { ParentGate } from '../../../ui/ParentGate';
import { areaColors, colors, space, useTheme } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { deleteChild, grantExtraMinutes, saveChild, useAppState } from '../../../data/store';
import { useCatalog, useChild, useChildEvents, useProgress } from '../../../data/hooks';
import { recommend, todayPlan } from '../../../core/engine/recommend';
import { tutorInsights } from '../../../core/engine/insights';
import { ageFromBirth } from '../../../core/model';
import { minutesLeft } from '../../../core/screen-time';
import { reasonText } from '../../../ui/reasons';

export default function ParentChildScreen() {
  const t = useT();
  return (
    <ParentGate title={t('parent.title')}>
      <ParentChild />
    </ParentGate>
  );
}

function ParentChild() {
  const t = useT();
  const th = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useChild(id);
  const family = useAppState((s) => s.family);
  const usage = useAppState((s) => (id ? s.usage[id] : undefined));
  const catalog = useCatalog();
  const events = useChildEvents(id);
  const progress = useProgress(child);
  const plan = useMemo(() => (child && catalog ? todayPlan(child, family, catalog, events) : []), [child, catalog, family, events]);
  const upcoming = useMemo(
    () => (child && catalog ? recommend(child, family, catalog, events).filter((r) => !plan.some((p) => p.item.id === r.item.id)).slice(0, 6) : []),
    [child, catalog, family, events, plan],
  );
  const insights = useMemo(() => (child && catalog ? tutorInsights(child, family, catalog, events) : []), [child, catalog, family, events]);
  if (!child || !catalog || !progress) return <Screen title={t('common.loading')}>{null}</Screen>;

  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  const done = [...progress.completed.keys()].map((k) => byId.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
  const assessments = events.filter((e) => (e.type === 'check' || e.type === 'simulation') && e.itemId).slice(-10).reverse();
  const physical = done.filter((i) => i.area === 'physical-education');
  const projects = done.filter((i) => i.kind === 'project' || i.kind === 'world-project');
  const languageItems = done.filter((i) => i.area === 'languages');
  const questions = events.filter((e) => e.type === 'question').slice(-10).reverse();
  const modules = Object.entries(child.health.modules).filter(([, on]) => on).map(([m]) => m);
  const left = minutesLeft(child.dailyMinutes, usage);
  const cols = th.layout === 'phone' ? 1 : 2;

  return (
    <Screen title={`${child.avatar} ${child.name}`} testID="parent-child">
      <Row wrap>
        <Pill text={t('picker.age', { age: ageFromBirth(child.birth) })} />
        <Pill text={t('parent.completed', { n: progress.completed.size })} />
        <Pill text={t('parent.totalMinutes', { n: progress.totalMinutes })} />
      </Row>
      <Grid columns={th.layout === 'phone' ? 1 : 3}>
        <Button icon="✏️" label={t('parent.editProfile')} onPress={() => router.push(`/parent/child-edit?id=${child.id}`)} testID="edit-profile" />
        <Button variant="secondary" icon="🔑" label={t('parent.progressKey')} onPress={() => router.push(`/parent/keys/${child.id}`)} testID="progress-key" />
        <Button variant="ghost" icon="🖨️" label={t('parent.print')} onPress={() => router.push(`/print/${child.id}`)} testID="print-passport" />
      </Grid>

      {insights.length ? (
        <Section title={`💡 ${t('parent.insights')}`}>
          {insights.map((i, k) => (
            <Notice key={k} text={t(i.reason.key, i.reason.vars)} icon={i.kind === 'safety' ? '⚠️' : '💡'} />
          ))}
        </Section>
      ) : null}

      <Grid columns={cols}>
        <Section title={`☀️ ${t('parent.today')}`}>
          {plan.map((r) => (
            <Card key={r.item.id} tint={areaColors[r.item.area]?.bg}>
              <Txt bold>
                {r.item.emoji} {r.item.title}
              </Txt>
              <Txt variant="small">{reasonText(t, r)}</Txt>
            </Card>
          ))}
        </Section>
        <Section title={`🗓️ ${t('parent.upcoming')}`}>
          {upcoming.map((r) => (
            <Txt key={r.item.id}>
              {r.item.emoji} {r.item.title} <Txt variant="small">· {t(`area.${r.item.area}`)}</Txt>
            </Txt>
          ))}
        </Section>
      </Grid>

      <Section title={`📈 ${t('parent.progress')}`}>
        <Row wrap>
          {[...progress.subjectLevels.entries()]
            .filter(([s]) => done.some((d) => d.subject === s))
            .map(([s, l]) => (
              <Pill key={s} text={`${s} · ${t('common.level', { level: l })}`} bg={colors.skySoft} fg={colors.sky} />
            ))}
          {!done.length ? <Txt variant="small">{t('parent.nothingYet')}</Txt> : null}
        </Row>
      </Section>

      <Grid columns={cols}>
        <Section title={`🧠 ${t('parent.assessments')}`}>
          {assessments.length ? (
            assessments.map((e) => (
              <Txt key={e.id}>
                {byId.get(e.itemId!)?.emoji} {byId.get(e.itemId!)?.title}: {Math.round((e.score ?? 0) * 100)}%{e.retry ? ` · 🔁 ${t('parent.retried')}` : ''}
              </Txt>
            ))
          ) : (
            <Txt variant="small">{t('parent.nothingYet')}</Txt>
          )}
        </Section>
        <Section title={`🚀 ${t('parent.projects')}`}>
          {projects.length ? projects.map((p) => <Txt key={p.id}>{p.emoji} {p.title}</Txt>) : <Txt variant="small">{t('parent.nothingYet')}</Txt>}
        </Section>
        <Section title={`🏃 ${t('parent.physical')}`}>
          {physical.length ? physical.map((p) => <Txt key={p.id}>{p.emoji} {p.title}</Txt>) : <Txt variant="small">{t('parent.nothingYet')}</Txt>}
        </Section>
        <Section title={`🗣️ ${t('parent.languages')}`}>
          <Txt>{t('passport.studying', { list: child.studyLanguages.join(', ') || '—' })}</Txt>
          {languageItems.map((p) => (
            <Txt key={p.id}>{p.emoji} {p.title}</Txt>
          ))}
        </Section>
        <Section title={`📚 ${t('parent.reading')}`}>
          {progress.books.length ? progress.books.map((b, i) => <Txt key={i}>📖 {b}</Txt>) : <Txt variant="small">{t('parent.nothingYet')}</Txt>}
        </Section>
        <Section title={`❓ ${t('parent.childQuestions')}`}>
          {questions.length ? questions.map((q) => <Txt key={q.id}>💬 {q.text}</Txt>) : <Txt variant="small">{t('parent.nothingYet')}</Txt>}
        </Section>
      </Grid>

      <Section title={`🛡️ ${t('parent.controls')}`}>
        <Card>
          <Txt>
            {t('parent.health')}: {modules.length ? modules.map((m) => t(`health.${m}`)).join(', ') : t('parent.healthOff')} · {t(`guidance.${child.health.guidance}`)}
          </Txt>
          <Txt>{t('parent.interests', { list: child.interests.map((i) => t(`interest.${i}`)).join(', ') || '—' })}</Txt>
          <Txt>{t('parent.areasOff', { list: child.areasOff.map((a) => t(`area.${a}`)).join(', ') || t('parent.none') })}</Txt>
          <Txt>
            {t('parent.screenTime')}: {child.dailyMinutes ? t('common.minutes', { n: child.dailyMinutes }) : t('child.edit.noLimit')}
            {Number.isFinite(left) ? ` · ${t('home.minutesLeft', { n: Math.round(left) })}` : ''}
          </Txt>
          <Row wrap>
            <Button small variant="ghost" label={t('parent.extra15')} onPress={() => grantExtraMinutes(child.id, 15)} testID="extra-time" />
            <Button small variant="ghost" label={t('parent.readAloud', { state: child.readAloud ? t('common.on') : t('common.off') })} onPress={() => saveChild({ ...child, readAloud: !child.readAloud })} />
          </Row>
        </Card>
      </Section>

      <Button
        variant="danger"
        small
        icon="🗑️"
        label={t('parent.deleteChild', { name: child.name })}
        onPress={async () => {
          const ok = await confirmAsync(t('parent.deleteConfirm', { name: child.name }));
          if (ok) {
            deleteChild(child.id);
            router.replace('/parent');
          }
        }}
      />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
