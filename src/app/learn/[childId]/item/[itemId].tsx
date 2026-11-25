/**
 * The lesson player. Every practical activity shows its Green/Amber/Red rating, the
 * Basic/Better/Advanced versions and material substitutions; health lessons show their source and
 * the "Awaiting review by a medical professional" label; first aid separates knowledge from
 * certified competency.
 */
import React, { useMemo, useState } from 'react';
import { View, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Button,
  Card,
  Choice,
  Grid,
  Notice,
  Pill,
  Row,
  SafetyBadge,
  Screen,
  Section,
  SpeakButton,
  Txt,
  say,
  duration,
} from '../../../../ui/kit';
import { Mascot } from '../../../../ui/Mascot';
import { areaColors, colors, space, useTheme } from '../../../../ui/theme';
import { useT } from '../../../../i18n';
import { useChild, useItem, useProgress, useVocab } from '../../../../data/hooks';
import { addEvent } from '../../../../data/store';
import type { ContentItem } from '../../../../core/content-types';

export default function ItemScreen() {
  const t = useT();
  const { childId, itemId } = useLocalSearchParams<{ childId: string; itemId: string }>();
  const child = useChild(childId)!;
  const { item, loading } = useItem(itemId);
  if (!item)
    return (
      <Screen title={loading ? t('common.loading') : t('item.notFound')}>
        <Mascot mood="think" />
      </Screen>
    );
  return <Player key={item.id} item={item} childId={child.id} />;
}

function Player({ item, childId }: { item: ContentItem; childId: string }) {
  const t = useT();
  const th = useTheme();
  const child = useChild(childId)!;
  const progress = useProgress(child);
  const picture = th.look === 'picture';
  const [step, setStep] = useState(0);
  const [version, setVersion] = useState<'basic' | 'better' | 'advanced'>('basic');
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(Date.now());
  const ac = areaColors[item.area];
  const done = progress?.completed.has(item.id);
  const rating = item.safety?.rating;
  const guidance = item.healthModule ? child.health.guidance : undefined;

  const complete = () => {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    addEvent({ childId, type: 'completed', itemId: item.id, by: 'child', minutes });
    addEvent({ childId, type: 'minutes', minutes: Math.min(minutes, item.minutes * 2), by: 'child' });
    setFinished(true);
    say(t('item.wellDone', { name: child.name }));
  };

  return (
    <Screen title={picture ? undefined : item.title} back={`/learn/${childId}`} testID="item">
      <Card tint={ac?.bg}>
        <Row>
          <Txt variant="display" style={{ fontSize: th.fs(picture ? 72 : 48), lineHeight: th.fs(picture ? 84 : 58) }}>
            {item.emoji}
          </Txt>
          <View style={{ flex: 1, gap: 6 }}>
            {picture ? <Txt variant="title">{item.title}</Txt> : null}
            <Txt>{item.summary}</Txt>
            <Row wrap>
              {rating ? <SafetyBadge rating={rating} /> : null}
              <Pill text={duration(t, item.minutes)} />
              {!picture ? <Pill text={t('common.level', { level: item.level })} /> : null}
              {done ? <Pill text={`✓ ${t('home.done')}`} fg={colors.green} bg={colors.greenSoft} /> : null}
            </Row>
          </View>
          <SpeakButton text={`${item.title}. ${item.summary}`} />
        </Row>
      </Card>

      {item.reviewStatus === 'awaiting-medical-review' ? <Notice tone="warn" icon="🩺" text={t('item.awaitingReview')} /> : null}
      {guidance === 'parent' ? <Notice text={t('item.guidance.parent')} icon="👪" /> : null}
      {guidance === 'tutor' ? <Notice text={t('item.guidance.tutor')} icon="🧑‍🏫" /> : null}
      {item.healthModule || item.area === 'health' ? <Notice text={t('item.medicalDisclaimer')} /> : null}

      {item.safety ? (
        <Card tint={rating === 'red' ? colors.redSoft : rating === 'amber' ? colors.amberSoft : colors.greenSoft} testID="safety">
          <SafetyBadge rating={item.safety.rating} long />
          <Txt>{item.safety.notes}</Txt>
          {item.safety.hazards.length ? <Txt variant="small">{t('item.hazards', { list: item.safety.hazards.join(', ') })}</Txt> : null}
        </Card>
      ) : null}
      {item.certificationNote ? <Notice tone="info" icon="🎓" text={item.certificationNote} /> : null}

      {item.kind === 'simulation' && item.simulation ? (
        <Simulation item={item} childId={childId} onDone={complete} />
      ) : (
        <Section title={t('item.steps')}>
          {picture ? (
            <Card testID="step-card">
              <Txt variant="small">{t('item.stepOf', { n: step + 1, total: item.steps.length })}</Txt>
              <Row>
                <Txt variant="h2" style={{ flex: 1 }}>
                  {item.steps[step]}
                </Txt>
                <SpeakButton text={item.steps[step]} />
              </Row>
              <Row>
                <Button variant="ghost" label={`◀ ${t('common.back')}`} disabled={step === 0} onPress={() => setStep(step - 1)} />
                {step < item.steps.length - 1 ? (
                  <Button
                    testID="next-step"
                    label={`${t('common.next')} ▶`}
                    style={{ flex: 1 }}
                    onPress={() => {
                      setStep(step + 1);
                      if (child.readAloud) say(item.steps[step + 1]);
                    }}
                  />
                ) : null}
              </Row>
            </Card>
          ) : (
            <Card>
              {item.steps.map((s, i) => (
                <Row key={i} style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ac?.fg ?? colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt color={colors.white} bold>
                      {i + 1}
                    </Txt>
                  </View>
                  <Txt style={{ flex: 1 }}>{s}</Txt>
                </Row>
              ))}
              <Row>
                <SpeakButton text={item.steps.join('. ')} label={t('item.readSteps')} />
              </Row>
            </Card>
          )}
        </Section>
      )}

      {item.versions ? (
        <Section title={t('item.versions')} testID="versions">
          <Choice
            value={version}
            onChange={setVersion}
            testID="version"
            options={[
              { value: 'basic', label: t('item.basic'), icon: '🆓' },
              { value: 'better', label: t('item.better'), icon: '🪙' },
              { value: 'advanced', label: t('item.advanced'), icon: '🧰' },
            ]}
          />
          <Card>
            <Row wrap>
              <Pill text={item.versions[version].cost} bg={colors.tealSoft} fg={colors.teal} />
            </Row>
            <Txt>{item.versions[version].description}</Txt>
            {item.versions[version].materials.length ? (
              <Txt variant="small">{t('item.materials', { list: item.versions[version].materials.join(', ') })}</Txt>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {item.substitutions?.length ? (
        <Section title={t('item.substitutions')} testID="substitutions">
          <Card>
            {item.substitutions.map((s, i) => (
              <Txt key={i}>
                🔁 {t('item.insteadOf', { instead: s.instead, use: s.use })}
              </Txt>
            ))}
          </Card>
        </Section>
      ) : null}

      {child.studyLanguages.length && item.languageHooks?.length ? (
        <LanguageCorner hooks={item.languageHooks} languages={child.studyLanguages} />
      ) : null}

      {item.check?.length && item.kind !== 'simulation' ? <Check item={item} childId={childId} /> : null}

      {item.kind !== 'simulation' ? (
        finished ? (
          <Card tint={colors.greenSoft} testID="finished">
            <Row>
              <Mascot size={80} mood="cheer" color={child.color} />
              <View style={{ flex: 1 }}>
                <Txt variant="h2">{t('item.wellDone', { name: child.name })}</Txt>
                {item.practical ? <Txt>{t('item.showAdult')}</Txt> : null}
              </View>
            </Row>
            <Button label={t('item.backHome')} onPress={() => router.replace(`/learn/${childId}`)} />
          </Card>
        ) : (
          <Button testID="complete" label={picture ? t('item.iDidIt.picture') : t('item.iDidIt')} icon="✅" onPress={complete} speak={picture} />
        )
      ) : null}

      {item.practical && item.competencies.length ? (
        <Button
          variant="ghost"
          icon="🧑‍🏫"
          label={t('item.adultConfirm')}
          onPress={() => router.push(`/parent/confirm?child=${childId}&item=${item.id}`)}
        />
      ) : null}

      {item.adultNote ? (
        <Card tint={colors.surfaceAlt}>
          <Txt variant="label">👪 {t('item.forAdults')}</Txt>
          <Txt variant="small">{item.adultNote}</Txt>
        </Card>
      ) : null}

      {item.sources?.length ? (
        <Section title={t('item.sources')} testID="sources">
          {item.sources.map((s, i) => (
            <Button
              key={i}
              small
              variant="ghost"
              label={`📎 ${s.publisher}: ${s.title}`}
              onPress={() => Linking.openURL(s.url)}
              accessibilityLabel={`${t('item.source')}: ${s.publisher}, ${s.title}`}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function LanguageCorner({ hooks, languages }: { hooks: string[]; languages: string[] }) {
  const t = useT();
  const [lang, setLang] = useState(languages[0]);
  const vocab = useVocab(lang);
  const words = useMemo(() => {
    if (!vocab) return [];
    return hooks.flatMap((h) => (vocab.concepts[h] ?? []).slice(0, 4)).slice(0, 8);
  }, [vocab, hooks]);
  if (!vocab || !words.length) return null;
  return (
    <Section title={`🌏 ${t('item.languageCorner', { language: vocab.name })}`} testID="language-corner">
      {languages.length > 1 ? (
        <Choice value={lang} onChange={setLang} options={languages.map((l) => ({ value: l, label: l.toUpperCase() }))} />
      ) : null}
      <Grid columns={2}>
        {words.map((w, i) => (
          <Card key={i} onPress={() => say(w.word, vocab.ttsLang)} accessibilityLabel={`${w.en}: ${w.romanised ?? w.word}`}>
            <Txt variant="h3" style={{ writingDirection: vocab.rtl ? 'rtl' : 'ltr' }}>
              {w.word} 🔊
            </Txt>
            {w.romanised ? <Txt variant="small">{w.romanised}</Txt> : null}
            <Txt variant="small">{w.en}</Txt>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}

function Check({ item, childId }: { item: ContentItem; childId: string }) {
  const t = useT();
  const qs = item.check!;
  const [answers, setAnswers] = useState<(number | undefined)[]>(qs.map(() => undefined));
  const [missed, setMissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const allAnswered = answers.every((a) => a !== undefined);
  const score = answers.filter((a, i) => a === qs[i].answer).length / qs.length;
  return (
    <Section title={`🧠 ${t('item.check')}`} testID="check">
      {qs.map((q, qi) => (
        <Card key={qi}>
          <Row>
            <Txt variant="h3" style={{ flex: 1 }}>
              {q.question}
            </Txt>
            <SpeakButton text={`${q.question}. ${q.options.join('. ')}`} />
          </Row>
          {q.options.map((o, oi) => {
            const chosen = answers[qi] === oi;
            const show = submitted && chosen;
            const right = oi === q.answer;
            return (
              <Button
                key={oi}
                testID={`check-${qi}-${oi}`}
                variant={show ? (right ? 'secondary' : 'danger') : chosen ? 'soft' : 'ghost'}
                label={`${show ? (right ? '✓ ' : '✗ ') : ''}${o}`}
                onPress={() => {
                  if (submitted) return;
                  const a = [...answers];
                  a[qi] = oi;
                  setAnswers(a);
                }}
              />
            );
          })}
          {submitted ? <Txt variant="small">{q.explain}</Txt> : null}
        </Card>
      ))}
      {!submitted ? (
        <Button
          testID="check-submit"
          label={t('item.checkAnswers')}
          disabled={!allAnswered}
          onPress={() => {
            setSubmitted(true);
            addEvent({ childId, type: 'check', itemId: item.id, score, by: 'child', retry: missed || undefined });
            say(score >= 0.67 ? t('item.checkGreat') : t('item.checkTry'));
          }}
        />
      ) : (
        <Card tint={score >= 0.67 ? colors.greenSoft : colors.amberSoft}>
          <Txt variant="h3">{score >= 0.67 ? t('item.checkGreat') : t('item.checkTry')}</Txt>
          <Txt>{t('item.score', { a: Math.round(score * qs.length), b: qs.length })}</Txt>
          {score < 1 ? (
            <Button
              small
              variant="ghost"
              label={t('item.tryAgain')}
              onPress={() => {
                setMissed(true);
                setSubmitted(false);
                setAnswers(qs.map(() => undefined));
              }}
            />
          ) : null}
        </Card>
      )}
    </Section>
  );
}

function Simulation({ item, childId, onDone }: { item: ContentItem; childId: string; onDone: () => void }) {
  const t = useT();
  const sim = item.simulation!;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [end, setEnd] = useState(false);
  const step = sim.steps[i];
  const opt = picked !== undefined ? step.options[picked] : undefined;
  return (
    <Section title={`🎬 ${t('item.simulation')}`} testID="simulation">
      <Card tint={colors.skySoft}>
        <Row>
          <Txt variant="h3" style={{ flex: 1 }}>
            {sim.scenario}
          </Txt>
          <SpeakButton text={sim.scenario} />
        </Row>
      </Card>
      {!end ? (
        <Card>
          <Txt variant="small">{t('item.stepOf', { n: i + 1, total: sim.steps.length })}</Txt>
          <Row>
            <Txt variant="h3" style={{ flex: 1 }}>
              {step.prompt}
            </Txt>
            <SpeakButton text={`${step.prompt}. ${step.options.map((o) => o.text).join('. ')}`} />
          </Row>
          {step.options.map((o, oi) => (
            <Button
              key={oi}
              testID={`sim-${i}-${oi}`}
              variant={picked === oi ? (o.correct ? 'secondary' : 'danger') : 'ghost'}
              label={`${picked === oi ? (o.correct ? '✓ ' : '✗ ') : ''}${o.text}`}
              onPress={() => {
                if (opt?.correct) return;
                setPicked(oi);
                if (o.correct) setCorrect((c) => c + (picked === undefined ? 1 : 0));
                else setMistakes((m) => m + 1);
                say(o.feedback);
              }}
            />
          ))}
          {opt ? <Notice tone={opt.correct ? 'ok' : 'warn'} text={opt.feedback} /> : null}
          {opt?.correct ? (
            <Button
              testID="sim-next"
              label={i < sim.steps.length - 1 ? t('common.next') : t('item.finish')}
              onPress={() => {
                if (i < sim.steps.length - 1) {
                  setI(i + 1);
                  setPicked(undefined);
                } else {
                  setEnd(true);
                  const score = correct / sim.steps.length;
                  addEvent({ childId, type: 'simulation', itemId: item.id, score, by: 'child', retry: mistakes > 0 || undefined });
                  onDone();
                }
              }}
            />
          ) : null}
        </Card>
      ) : (
        <Card tint={colors.greenSoft} testID="sim-done">
          <Txt variant="h2">{t('item.simDone')}</Txt>
          <Txt>{t('item.simScore', { a: correct, b: sim.steps.length })}</Txt>
          <Button label={t('item.backHome')} onPress={() => router.replace(`/learn/${childId}`)} />
        </Card>
      )}
    </Section>
  );
}
