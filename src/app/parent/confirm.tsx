/**
 * A grown-up confirms a real-world demonstration. Competency stages above "understands"
 * (can demonstrate, can apply, can teach) and real-world evidence only count when an adult confirms.
 */
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Notice, ProgressBar, Row, Screen, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { useT } from '../../i18n';
import { addEvent } from '../../data/store';
import { useCatalog, useChild, useProgress } from '../../data/hooks';
import { STAGES, type Stage } from '../../core/model';
import { stageIndex } from '../../core/engine/progress';

export default function ConfirmScreen() {
  const t = useT();
  return (
    <ParentGate title={t('confirm.title')}>
      <Confirm />
    </ParentGate>
  );
}

function Confirm() {
  const t = useT();
  const { child: childId, item: itemId } = useLocalSearchParams<{ child: string; item: string }>();
  const child = useChild(childId);
  const catalog = useCatalog();
  const progress = useProgress(child);
  const [msg, setMsg] = useState('');
  const item = catalog?.items.find((i) => i.id === itemId);
  if (!child || !catalog || !item || !progress) return <Screen title={t('common.loading')}>{null}</Screen>;
  const comps = item.competencies.map((id) => catalog.competencies.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  return (
    <Screen title={t('confirm.title')} testID="confirm">
      <Txt>{t('confirm.intro', { name: child.name, item: item.title })}</Txt>
      {comps.map((c) => {
        const stage = progress.stages.get(c.id);
        const ev = progress.evidence.get(c.id) ?? 0;
        return (
          <Card key={c.id}>
            <Txt variant="h3">
              {c.emoji} {c.title}
            </Txt>
            <Txt variant="small">{t('confirm.current', { stage: stage ? t(`stage.${stage}`) : t('confirm.notYet') })}</Txt>
            <Row wrap>
              {(STAGES.slice(2) as Stage[]).map((s) => (
                <Button
                  key={s}
                  small
                  testID={`stage-${c.id}-${s}`}
                  variant={stageIndex(stage) >= stageIndex(s) ? 'secondary' : 'ghost'}
                  label={t(`stage.${s}`)}
                  onPress={() => {
                    addEvent({ childId: child.id, type: 'stage', competencyId: c.id, stage: s, itemId: item.id, by: 'parent' });
                    setMsg(t('confirm.saved'));
                  }}
                />
              ))}
            </Row>
            {(c.target ?? 1) > 1 ? (
              <>
                <ProgressBar value={ev / (c.target ?? 1)} label={`${ev}/${c.target}`} />
                <Button
                  small
                  variant="soft"
                  label={t('confirm.addEvidence', { a: ev, b: c.target ?? 1 })}
                  onPress={() => {
                    addEvent({ childId: child.id, type: 'evidence', competencyId: c.id, itemId: item.id, by: 'parent' });
                    setMsg(t('confirm.saved'));
                  }}
                />
              </>
            ) : null}
            {c.needsCertification ? <Notice text={t('passport.needsCert')} icon="🎓" /> : null}
          </Card>
        );
      })}
      {msg ? <Notice tone="ok" text={msg} /> : null}
      <Button label={t('common.done')} onPress={() => router.back()} />
    </Screen>
  );
}
