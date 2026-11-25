/**
 * Learner profile (brief section 2): every field, grouped into short sections.
 * Minimal data: first name or nickname, birth year and month, no photos, no contact details.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Choice, Field, Notice, Row, Screen, Section, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { mascotColors, space } from '../../ui/theme';
import { useT } from '../../i18n';
import { saveChild, useAppState } from '../../data/store';
import { useCatalog } from '../../data/hooks';
import {
  EQUIPMENT,
  newChild,
  ageFromBirth,
  type Child,
  type LearnerType,
  type HealthGuidance,
} from '../../core/model';
import { AREA_IDS, type HealthModule } from '../../core/content-types';
import { randomId } from '../../core/crypto';
import { COUNTRIES, INTERESTS, LANGUAGES, STUDY_LANGUAGES } from '../../core/countries';

const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐢', '🦄', '🐙', '🐝', '🦁', '🐳', '🐧', '🦒', '🐨', '🐞', '🌟'];
const LEARNER_TYPES: LearnerType[] = ['individual', 'siblings', 'small-group', 'classroom', 'tutor-led', 'parent-led', 'mixed-cohort'];
const STYLES = ['seeing', 'listening', 'doing', 'reading', 'talking', 'moving'];
const HEALTH_MODULES: HealthModule[] = ['body-basics', 'growing-up-girl', 'growing-up-boy', 'adolescent-health'];
const SCREEN_MINUTES = [0, 30, 45, 60, 90, 120];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function ChildEditScreen() {
  const t = useT();
  return (
    <ParentGate title={t('child.edit.title')}>
      <ChildEdit />
    </ParentGate>
  );
}

function ChildEdit() {
  const t = useT();
  const { id, first } = useLocalSearchParams<{ id?: string; first?: string }>();
  const family = useAppState((s) => s.family);
  const existing = useAppState((s) => (id ? s.children[id] : undefined));
  const catalog = useCatalog();
  const now = new Date();
  const [c, setC] = useState<Child>(
    () =>
      existing ??
      newChild({
        id: randomId(),
        familyId: family?.id ?? '',
        name: '',
        birth: `${now.getFullYear() - 7}-01`,
        country: family?.country ?? 'IN',
        learnerTypes: family?.mode === 'E' ? ['siblings', 'parent-led'] : family?.mode === 'G' ? ['classroom'] : ['individual', 'parent-led'],
      }),
  );
  const [goals, setGoals] = useState(c.goals.join(', '));
  const [strengths, setStrengths] = useState(c.strengths.join(', '));
  const [growing, setGrowing] = useState(c.growingAreas.join(', '));
  const [error, setError] = useState('');
  const set = (p: Partial<Child>) => setC((x) => ({ ...x, ...p }));
  const [by, bm] = c.birth.split('-').map(Number);
  const age = ageFromBirth(c.birth);
  const subjects = useMemo(() => {
    if (!catalog) return [] as string[];
    const counts = new Map<string, number>();
    for (const i of catalog.items) if (i.area === 'core-academics' || i.area === 'languages' || i.area === 'technology-ai') counts.set(i.subject, (counts.get(i.subject) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  }, [catalog]);

  const save = () => {
    if (!c.name.trim()) return setError(t('child.edit.nameRequired'));
    if (age < 2 || age > 19) return setError(t('child.edit.ageRange'));
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    saveChild({ ...c, name: c.name.trim(), goals: split(goals), strengths: split(strengths), growingAreas: split(growing) });
    if (first) router.replace('/');
    else router.back();
  };

  return (
    <Screen title={existing ? t('child.edit.titleEdit', { name: existing.name }) : t('child.edit.title')} testID="child-edit">
      <Section title={t('child.edit.basic')}>
        <Card>
          <Field testID="child-name" label={t('child.edit.name')} value={c.name} onChangeText={(name) => set({ name })} hint={t('child.edit.nameHint')} />
          <Txt variant="label">{t('child.edit.avatar')}</Txt>
          <Row wrap>
            {AVATARS.map((a) => (
              <Chip key={a} label={a} selected={c.avatar === a} onPress={() => set({ avatar: a })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.colour')}</Txt>
          <Row wrap>
            {Object.keys(mascotColors).map((k) => (
              <Chip key={k} label={t(`colour.${k}`)} selected={c.color === k} onPress={() => set({ color: k })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.birth')}</Txt>
          <Row wrap>
            <Button small variant="ghost" label="−" accessibilityLabel={t('child.edit.olderYear')} onPress={() => set({ birth: `${by - 1}-${String(bm).padStart(2, '0')}` })} />
            <Txt variant="h3" style={{ minWidth: 70, textAlign: 'center' }}>
              {by}
            </Txt>
            <Button small variant="ghost" label="+" accessibilityLabel={t('child.edit.youngerYear')} onPress={() => set({ birth: `${by + 1}-${String(bm).padStart(2, '0')}` })} />
            <Txt>{t(`month.${bm}`)}</Txt>
            <Button small variant="ghost" label="‹" accessibilityLabel={t('child.edit.prevMonth')} onPress={() => set({ birth: `${by}-${String(bm === 1 ? 12 : bm - 1).padStart(2, '0')}` })} />
            <Button small variant="ghost" label="›" accessibilityLabel={t('child.edit.nextMonth')} onPress={() => set({ birth: `${by}-${String(bm === 12 ? 1 : bm + 1).padStart(2, '0')}` })} />
          </Row>
          <Txt variant="small" testID="child-age">{t('child.edit.ageIs', { age })}</Txt>
          <Txt variant="label">{t('child.edit.sex')}</Txt>
          <Choice
            testID="sex"
            value={c.sex}
            onChange={(sex) => set({ sex })}
            options={[
              { value: 'girl', label: t('sex.girl') },
              { value: 'boy', label: t('sex.boy') },
              { value: 'unspecified', label: t('sex.unspecified') },
            ]}
          />
          <Txt variant="small">{t('child.edit.sexHint')}</Txt>
        </Card>
      </Section>

      <Section title={t('child.edit.languages')}>
        <Card>
          <Txt variant="label">{t('child.edit.country')}</Txt>
          <Row wrap>
            {COUNTRIES.map((x) => (
              <Chip key={x.code} label={`${x.flag} ${x.name}`} selected={c.country === x.code} onPress={() => set({ country: x.code })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.primaryLanguage')}</Txt>
          <Row wrap>
            {LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.name} selected={c.primaryLanguage === l.code} onPress={() => set({ primaryLanguage: l.code })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.spoken')}</Txt>
          <Row wrap>
            {LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.name} selected={c.languagesSpoken.includes(l.code)} onPress={() => set({ languagesSpoken: toggle(c.languagesSpoken, l.code) })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.studying')}</Txt>
          <Row wrap>
            {LANGUAGES.filter((l) => STUDY_LANGUAGES.includes(l.code)).map((l) => (
              <Chip key={l.code} testID={`study-${l.code}`} label={l.name} selected={c.studyLanguages.includes(l.code)} onPress={() => set({ studyLanguages: toggle(c.studyLanguages, l.code) })} />
            ))}
          </Row>
          <Txt variant="small">{t('child.edit.studyingHint')}</Txt>
        </Card>
      </Section>

      <Section title={t('child.edit.environment')}>
        <Card>
          <Field label={t('child.edit.educationLevel')} value={c.educationLevel} onChangeText={(educationLevel) => set({ educationLevel })} placeholder={t('child.edit.educationLevel.placeholder')} />
          <Txt variant="label">{t('child.edit.learningEnvironment')}</Txt>
          <Choice
            value={c.learningEnvironment}
            onChange={(learningEnvironment) => set({ learningEnvironment })}
            options={(['home', 'tutor', 'school', 'mixed'] as const).map((v) => ({ value: v, label: t(`env.${v}`) }))}
          />
          <Txt variant="label">{t('child.edit.learnerTypes')}</Txt>
          <Row wrap>
            {LEARNER_TYPES.map((l) => (
              <Chip key={l} label={t(`learner.${l}`)} selected={c.learnerTypes.includes(l)} onPress={() => set({ learnerTypes: toggle(c.learnerTypes, l) })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.supervision')}</Txt>
          <Choice
            value={c.supervision}
            onChange={(supervision) => set({ supervision })}
            options={(['always', 'often', 'sometimes', 'rarely'] as const).map((v) => ({ value: v, label: t(`supervision.${v}`) }))}
          />
          <Txt variant="label">{t('child.edit.outdoor')}</Txt>
          <Choice
            value={c.outdoorSpace}
            onChange={(outdoorSpace) => set({ outdoorSpace })}
            options={(['none', 'balcony', 'yard', 'garden', 'park-nearby', 'rural'] as const).map((v) => ({ value: v, label: t(`outdoor.${v}`) }))}
          />
          <Txt variant="label">{t('child.edit.equipment')}</Txt>
          <Row wrap>
            {EQUIPMENT.map((e) => (
              <Chip key={e} label={t(`equipment.${e}`)} selected={c.equipment.includes(e)} onPress={() => set({ equipment: toggle(c.equipment, e) })} />
            ))}
          </Row>
        </Card>
      </Section>

      <Section title={t('child.edit.interests')}>
        <Card>
          <Row wrap>
            {INTERESTS.map((i) => (
              <Chip key={i.tag} testID={`interest-${i.tag}`} icon={i.icon} label={t(`interest.${i.tag}`)} selected={c.interests.includes(i.tag)} onPress={() => set({ interests: toggle(c.interests, i.tag) })} />
            ))}
          </Row>
          <Field label={t('child.edit.goals')} value={goals} onChangeText={setGoals} placeholder={t('child.edit.goals.placeholder')} />
          <Field label={t('child.edit.strengths')} value={strengths} onChangeText={setStrengths} />
          <Field label={t('child.edit.growing')} value={growing} onChangeText={setGrowing} />
          <Txt variant="label">{t('child.edit.styles')}</Txt>
          <Row wrap>
            {STYLES.map((s) => (
              <Chip key={s} label={t(`style.${s}`)} selected={c.learningStyles.includes(s)} onPress={() => set({ learningStyles: toggle(c.learningStyles, s) })} />
            ))}
          </Row>
        </Card>
      </Section>

      <Section title={t('child.edit.health')}>
        <Card>
          <Notice text={t('child.edit.healthIntro')} />
          {HEALTH_MODULES.filter((m) => (m === 'growing-up-girl' ? c.sex !== 'boy' : m === 'growing-up-boy' ? c.sex !== 'girl' : true)).map((m) => (
            <View key={m} style={{ gap: 2 }}>
              <Chip testID={`health-${m}`} label={t(`health.${m}`)} selected={!!c.health.modules[m]} onPress={() => set({ health: { ...c.health, modules: { ...c.health.modules, [m]: !c.health.modules[m] } } })} />
              <Txt variant="small">{t(`health.${m}.desc`)}</Txt>
            </View>
          ))}
          <Txt variant="label">{t('child.edit.healthGuidance')}</Txt>
          <Choice<HealthGuidance>
            value={c.health.guidance}
            onChange={(guidance) => set({ health: { ...c.health, guidance } })}
            options={(['parent', 'tutor', 'private'] as const).map((v) => ({ value: v, label: t(`guidance.${v}`) }))}
          />
          <Txt variant="small">{t(`guidance.${c.health.guidance}.desc`)}</Txt>
          <Field label={t('child.edit.physicalNotes')} value={c.physicalNotes ?? ''} onChangeText={(physicalNotes) => set({ physicalNotes })} hint={t('child.edit.physicalNotesHint')} />
        </Card>
      </Section>

      <Section title={t('child.edit.curriculum')}>
        <Card>
          <Txt variant="label">{t('child.edit.areas')}</Txt>
          <Row wrap>
            {AREA_IDS.map((a) => (
              <Chip key={a} label={t(`area.${a}`)} selected={!c.areasOff.includes(a)} onPress={() => set({ areasOff: toggle(c.areasOff, a) })} />
            ))}
          </Row>
          <Txt variant="label">{t('child.edit.levels')}</Txt>
          <Txt variant="small">{t('child.edit.levelsHint')}</Txt>
          {subjects.map((s) => {
            const v = c.levelOverrides[s];
            return (
              <Row key={s} wrap>
                <Txt style={{ minWidth: 140 }}>{s}</Txt>
                <Button small variant="ghost" label="−" accessibilityLabel={t('child.edit.levelDown', { subject: s })} onPress={() => set({ levelOverrides: { ...c.levelOverrides, [s]: Math.max(1, (v ?? 1) - 1) } })} />
                <Txt variant="h3">{v ? t('common.level', { level: v }) : t('child.edit.levelAuto')}</Txt>
                <Button small variant="ghost" label="+" accessibilityLabel={t('child.edit.levelUp', { subject: s })} onPress={() => set({ levelOverrides: { ...c.levelOverrides, [s]: Math.min(10, (v ?? 0) + 1) } })} />
                {v ? (
                  <Button
                    small
                    variant="ghost"
                    label={t('child.edit.levelAuto')}
                    onPress={() => {
                      const o = { ...c.levelOverrides };
                      delete o[s];
                      set({ levelOverrides: o });
                    }}
                  />
                ) : null}
              </Row>
            );
          })}
          <Txt variant="label">{t('child.edit.screenTime')}</Txt>
          <Choice
            value={String(c.dailyMinutes)}
            onChange={(v) => set({ dailyMinutes: Number(v) })}
            options={SCREEN_MINUTES.map((m) => ({ value: String(m), label: m === 0 ? t('child.edit.noLimit') : t('common.minutes', { n: m }) }))}
          />
          <Chip label={t('child.edit.readAloud')} selected={c.readAloud} onPress={() => set({ readAloud: !c.readAloud })} />
        </Card>
      </Section>

      {error ? <Notice tone="danger" text={error} /> : null}
      <Button testID="save-child" label={t('common.save')} icon="💾" onPress={save} />
    </Screen>
  );
}
