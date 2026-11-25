/** Shared view of a Learning Passport snapshot: child screen, Progress Key page and print. */
import React from 'react';
import { View } from 'react-native';
import { Card, Grid, Notice, Pill, ProgressBar, Row, Section, Txt } from './kit';
import { colors, space, useTheme } from './theme';
import { useT } from '../i18n';
import type { PassportSnapshot } from '../core/engine/passport';
import { STAGES } from '../core/model';

const GROUP_ICON: Record<string, string> = {
  academic: '📘',
  life: '🏠',
  physical: '🏃',
  emergency: '🚑',
  digital: '💻',
  global: '🌍',
  intellectual: '🧠',
  practical: '🔧',
  personal: '🌱',
};

export function PassportView({ snap, print }: { snap: PassportSnapshot; print?: boolean }) {
  const t = useT();
  const th = useTheme();
  const groups = [...new Set(snap.competencies.map((c) => c.group))];
  const cols = print ? 2 : th.layout === 'phone' ? 1 : 2;
  return (
    <View style={{ gap: space.lg }} testID="passport-view">
      <Card tint={colors.primarySoft}>
        <Txt variant="title">🛂 {t('passport.of', { name: snap.name })}</Txt>
        <Txt>{t('passport.summary', { age: snap.age, done: snap.completedCount, comps: snap.competencies.length })}</Txt>
        <Txt variant="small">{t('passport.generated', { date: new Date(snap.generatedAt).toLocaleDateString() })}</Txt>
      </Card>
      <Notice text={t('passport.knowledgeNote')} icon="🎓" />

      <Section title={`🧰 ${t('passport.canDo')}`}>
        {snap.competencies.length === 0 ? <Txt variant="small">{t('passport.none')}</Txt> : null}
        {groups.map((g) => (
          <View key={g} style={{ gap: space.sm }}>
            <Txt variant="h3">
              {GROUP_ICON[g] ?? '⭐'} {t(`group.${g}`)}
            </Txt>
            <Grid columns={cols}>
              {snap.competencies
                .filter((c) => c.group === g)
                .map((c) => {
                  const idx = c.stage ? STAGES.indexOf(c.stage) : -1;
                  return (
                    <Card key={c.id}>
                      <Txt bold>
                        {c.emoji} {c.title}
                      </Txt>
                      <Row wrap>
                        {STAGES.map((s, i) => (
                          <Pill key={s} text={`${i <= idx ? '●' : '○'} ${t(`stage.${s}`)}`} fg={i <= idx ? colors.white : colors.muted} bg={i <= idx ? colors.teal : colors.surfaceAlt} />
                        ))}
                      </Row>
                      {c.target > 1 ? <ProgressBar value={c.evidence / c.target} label={`${c.evidence}/${c.target}`} /> : null}
                      {c.target > 1 ? <Txt variant="small">{t('passport.evidence', { a: c.evidence, b: c.target })}</Txt> : null}
                      {c.needsCertification ? <Txt variant="small">🎓 {t('passport.needsCert')}</Txt> : null}
                    </Card>
                  );
                })}
            </Grid>
          </View>
        ))}
      </Section>

      {snap.levels.length ? (
        <Section title={`📈 ${t('passport.levels')}`}>
          <Txt variant="small">{t('passport.levelsNote')}</Txt>
          <Row wrap>
            {snap.levels.map((l) => (
              <Pill key={l.subject} text={`${l.subject} · ${t('common.level', { level: l.level })}`} bg={colors.skySoft} fg={colors.sky} />
            ))}
          </Row>
        </Section>
      ) : null}

      {snap.skillTrees.length ? (
        <Section title={`🌳 ${t('passport.skillTrees')}`}>
          <Grid columns={cols}>
            {snap.skillTrees.map((s) => (
              <Card key={s.id}>
                <Txt bold>
                  {s.emoji} {s.title}
                </Txt>
                <ProgressBar value={s.reached / s.total} label={s.title} />
                <Txt variant="small">{t('home.steps', { a: s.reached, b: s.total })}</Txt>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      {snap.projects.length ? (
        <Section title={`🚀 ${t('passport.projects')}`}>
          {snap.projects.map((p) => (
            <Txt key={p.id}>
              {p.emoji} {p.title}
            </Txt>
          ))}
        </Section>
      ) : null}

      <Grid columns={cols}>
        <Section title={`📚 ${t('home.books')}`}>
          {snap.books.length ? snap.books.map((b, i) => <Txt key={i}>📖 {b}</Txt>) : <Txt variant="small">—</Txt>}
        </Section>
        <Section title={`🗣️ ${t('passport.languages')}`}>
          <Txt>{t('passport.spoken', { list: snap.languages.spoken.join(', ') || '—' })}</Txt>
          <Txt>{t('passport.studying', { list: snap.languages.studying.join(', ') || '—' })}</Txt>
        </Section>
      </Grid>
      <Grid columns={cols}>
        <Section title={`💛 ${t('home.interests')}`}>
          <Txt>{snap.interests.map((i) => t(`interest.${i}`)).join(', ') || '—'}</Txt>
        </Section>
        <Section title={`🎯 ${t('home.goals')}`}>
          <Txt>{snap.goals.join(', ') || '—'}</Txt>
          {snap.strengths.length ? <Txt variant="small">{t('passport.strengths', { list: snap.strengths.join(', ') })}</Txt> : null}
        </Section>
      </Grid>
    </View>
  );
}
