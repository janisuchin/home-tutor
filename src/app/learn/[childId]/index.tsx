/**
 * Child home (brief section 34): current mission, today's learning, skill progress, projects,
 * achievements, books, questions, interests and goals. Picture-first for ages 3-5.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Grid, Pill, ProgressBar, Row, SafetyBadge, Screen, Section, SpeakButton, Tile, Txt, say, duration } from '../../../ui/kit';
import { Mascot } from '../../../ui/Mascot';
import { areaColors, colors, mascotColors, space, useTheme } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { useCatalog, useChild, useChildEvents, useProgress } from '../../../data/hooks';
import { loadBooks } from '../../../content/loader';
import { suggestBooks } from '../../../core/engine/books';
import type { Book } from '../../../core/content-types';
import { addEvent, setPlan, useAppState } from '../../../data/store';
import { currentMission, recommend, todayPlan } from '../../../core/engine/recommend';
import { reasonText } from '../../../ui/reasons';
import { achievements } from '../../../core/engine/insights';
import { dayKey, minutesLeft } from '../../../core/screen-time';
import { INTERESTS } from '../../../core/countries';


export default function ChildHome() {
  const t = useT();
  const th = useTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const family = useAppState((s) => s.family);
  const usage = useAppState((s) => s.usage[childId]);
  const catalog = useCatalog();
  const events = useChildEvents(childId);
  const progress = useProgress(child);
  const [question, setQuestion] = useState('');
  const [book, setBook] = useState('');
  const [bookList, setBookList] = useState<Book[]>([]);
  useEffect(() => {
    loadBooks().then(setBookList).catch(() => {});
  }, []);
  const nextBook = useMemo(() => suggestBooks(bookList, child, family, events, Date.now(), 1)[0], [bookList, child, family, events]);

  const stored = useAppState((s) => s.plans?.[childId]);
  const today = dayKey();
  const plan = useMemo(() => {
    if (!catalog) return [];
    const fresh = () => todayPlan(child, family, catalog, events);
    if (stored && stored.day === today) {
      const recs = recommend(child, family, catalog, events);
      const kept = stored.ids.map((id) => recs.find((r) => r.item.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
      if (kept.length) return kept;
    }
    return fresh();
  }, [catalog, child, family, events, stored, today]);
  useEffect(() => {
    if (plan.length && (!stored || stored.day !== today)) setPlan(childId, today, plan.map((r) => r.item.id));
  }, [plan, stored, today, childId]);
  const mission = useMemo(() => (catalog ? currentMission(child, family, catalog, events) : undefined), [catalog, child, family, events]);
  const badges = useMemo(() => (progress ? achievements(progress) : []), [progress]);
  const picture = th.look === 'picture';
  const left = minutesLeft(child.dailyMinutes, usage);
  const greeting = t(picture ? 'home.hello.picture' : 'home.hello', { name: child.name });

  if (!catalog || !progress)
    return (
      <Screen back="/">
        <Mascot size={100} mood="think" />
        <Txt>{t('common.loading')}</Txt>
      </Screen>
    );

  const trees = catalog.skillTrees
    .map((tr) => ({ tr, reached: tr.nodes.filter((n) => progress.skillNodesDone.get(tr.id)?.has(n.id)).length }))
    .filter((x) => x.reached > 0)
    .slice(0, 4);
  const doneToday = plan.filter((r) => {
    const last = progress.lastDone.get(r.item.id);
    return last && new Date(last).toDateString() === new Date().toDateString();
  }).length;

  return (
    <Screen back="/" testID="child-home">
      <Card tint={mascotColors[child.color] + '22'}>
        <Row>
          <Mascot size={picture ? 110 : 84} mood={doneToday > 0 ? 'cheer' : 'wave'} color={child.color} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="title">{greeting}</Txt>
            {!picture && <Txt>{doneToday === plan.length && plan.length > 0 ? t('home.allDone') : t('home.today', { n: plan.length - doneToday })}</Txt>}
            {Number.isFinite(left) ? <Txt variant="small">{t('home.minutesLeft', { n: Math.round(left) })}</Txt> : null}
          </View>
          <SpeakButton text={`${greeting}. ${t('home.today', { n: plan.length - doneToday })}`} />
        </Row>
      </Card>

      {mission ? (
        <Section title={`🎯 ${t('home.mission')}`}>
          <Card
            testID="mission"
            tint={colors.primarySoft}
            onPress={() => router.push(`/learn/${child.id}/item/${mission.item.id}`)}
            accessibilityLabel={`${t('home.mission')}: ${mission.item.title}`}
          >
            <Row>
              <Txt variant="display">{mission.item.emoji}</Txt>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="h2">{mission.item.title}</Txt>
                {!picture && <Txt variant="small">{reasonText(t, mission)}</Txt>}
                <Row wrap>
                  {mission.item.rating ? <SafetyBadge rating={mission.item.rating} /> : null}
                  <Pill text={duration(t, mission.item.minutes)} />
                </Row>
              </View>
            </Row>
          </Card>
        </Section>
      ) : null}

      <Section title={`☀️ ${t('home.todayTitle')}`} testID="today">
        <Grid>
          {plan.map((r) => {
            const done = progress.completed.has(r.item.id);
            const ac = areaColors[r.item.area];
            return (
              <Tile
                key={r.item.id}
                testID={`today-${r.item.id}`}
                emoji={r.item.emoji}
                title={r.item.title}
                subtitle={picture ? undefined : reasonText(t, r)}
                tint={done ? colors.greenSoft : ac?.bg}
                onPress={() => router.push(`/learn/${child.id}/item/${r.item.id}`)}
                badge={
                  <Row wrap style={{ justifyContent: 'center' }}>
                    {done ? <Pill text={`✓ ${t('home.done')}`} fg={colors.green} bg={colors.white} /> : null}
                    {r.item.rating && r.item.rating !== 'green' ? <SafetyBadge rating={r.item.rating} /> : null}
                  </Row>
                }
              />
            );
          })}
        </Grid>
      </Section>

      <Grid columns={th.layout === 'phone' ? 2 : 4}>
        <Tile emoji="🗺️" title={t('home.explore')} onPress={() => router.push(`/learn/${child.id}/explore`)} testID="explore" />
        <Tile emoji="🌳" title={t('home.skills')} onPress={() => router.push(`/learn/${child.id}/skills`)} testID="skills" />
        <Tile emoji="🛂" title={t('home.passport')} onPress={() => router.push(`/learn/${child.id}/passport`)} testID="passport" />
        <Tile emoji="🚀" title={t('home.projects')} onPress={() => router.push(`/learn/${child.id}/area/projects`)} />
      </Grid>

      {trees.length ? (
        <Section title={`🌳 ${t('home.skillProgress')}`}>
          <Grid columns={th.layout === 'phone' ? 1 : 2}>
            {trees.map(({ tr, reached }) => (
              <Card key={tr.id} onPress={() => router.push(`/learn/${child.id}/skills`)} accessibilityLabel={`${tr.title} ${reached}/${tr.nodes.length}`}>
                <Txt variant="h3">
                  {tr.emoji} {tr.title}
                </Txt>
                <ProgressBar value={reached / tr.nodes.length} label={tr.title} />
                <Txt variant="small">{t('home.steps', { a: reached, b: tr.nodes.length })}</Txt>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      <Section title={`🏅 ${t('home.achievements')}`}>
        <Txt variant="small">{t('home.achievementsNote')}</Txt>
        <Row wrap>
          {badges.map((b) => (
            <View
              key={b.id}
              accessible
              accessibilityLabel={`${t(b.titleKey)}${b.earned ? '' : ` (${Math.round(b.progress * 100)}%)`}`}
              style={{ alignItems: 'center', width: 92, gap: 2 }}
            >
              <View style={{ opacity: b.earned ? 1 : 0.35 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Txt variant="title">{b.emoji}</Txt>
              </View>
              <Txt variant="small" center color={b.earned ? colors.text : colors.muted}>
                {t(b.titleKey)}
              </Txt>
              {!b.earned ? <ProgressBar value={b.progress} label={t(b.titleKey)} /> : null}
            </View>
          ))}
        </Row>
      </Section>

      <Grid columns={th.layout === 'phone' ? 1 : 2}>
        <Section title={`❓ ${t('home.questions')}`}>
          <Card>
            <Txt variant="small">{t('home.questionsHint')}</Txt>
            <Field testID="question" label={t('home.askLabel')} value={question} onChangeText={setQuestion} />
            <Button
              small
              label={t('home.ask')}
              disabled={!question.trim()}
              onPress={() => {
                addEvent({ childId: child.id, type: 'question', text: question.trim(), by: 'child' });
                say(t('home.askThanks'));
                setQuestion('');
              }}
            />
            {events
              .filter((e) => e.type === 'question')
              .slice(-3)
              .reverse()
              .map((e) => (
                <Txt key={e.id} variant="small">
                  💬 {e.text}
                </Txt>
              ))}
          </Card>
        </Section>
        <Section title={`📚 ${t('home.books')}`}>
          <Card>
            {nextBook ? (
              <Txt testID="next-book">
                💡 {t('books.tryNext', { title: nextBook.book.title, author: nextBook.book.author })}
              </Txt>
            ) : null}
            <Button small variant="secondary" icon="📚" testID="open-books" label={t('books.find')} onPress={() => router.push(`/learn/${child.id}/books`)} />
            <Field label={t('home.bookLabel')} value={book} onChangeText={setBook} />
            <Button
              small
              label={t('home.addBook')}
              disabled={!book.trim()}
              onPress={() => {
                addEvent({ childId: child.id, type: 'book', text: book.trim(), by: 'child' });
                setBook('');
              }}
            />
            {progress.books.slice(-5).reverse().map((b, i) => (
              <Txt key={i}>📖 {b}</Txt>
            ))}
          </Card>
        </Section>
      </Grid>

      <Grid columns={th.layout === 'phone' ? 1 : 2}>
        <Section title={`💛 ${t('home.interests')}`}>
          <Row wrap>
            {child.interests.length ? (
              child.interests.map((i) => (
                <Pill key={i} text={`${INTERESTS.find((x) => x.tag === i)?.icon ?? '⭐'} ${t(`interest.${i}`)}`} bg={colors.primarySoft} fg={colors.primaryDark} />
              ))
            ) : (
              <Txt variant="small">{t('home.noInterests')}</Txt>
            )}
          </Row>
        </Section>
        <Section title={`🎯 ${t('home.goals')}`}>
          {child.goals.length ? child.goals.map((g) => <Txt key={g}>⭐ {g}</Txt>) : <Txt variant="small">{t('home.noGoals')}</Txt>}
        </Section>
      </Grid>
    </Screen>
  );
}
