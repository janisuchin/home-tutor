/** Career families (brief section 31): exposure, never an early choice. */
import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Card, Grid, Pill, Row, Screen, Section, Txt } from '../../../ui/kit';
import { colors, useTheme } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { useChild } from '../../../data/hooks';
import { loadCareers } from '../../../content/loader';
import type { Career } from '../../../core/content-types';
import { ageBandFor, ageFromBirth } from '../../../core/model';

export default function Careers() {
  const t = useT();
  const th = useTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const [careers, setCareers] = useState<Career[]>([]);
  useEffect(() => {
    loadCareers().then(setCareers).catch(() => {});
  }, []);
  const band = ageBandFor(ageFromBirth(child.birth));
  const families = useMemo(() => {
    const list = careers.filter((c) => c.ageBands.includes(band));
    const fams = [...new Set(list.map((c) => c.family))];
    const score = (c: Career) => c.interests.filter((i) => child.interests.includes(i)).length;
    return fams.map((f) => ({ family: f, careers: list.filter((c) => c.family === f).sort((a, b) => score(b) - score(a)) }));
  }, [careers, band, child.interests]);
  return (
    <Screen title={t('careers.title')} testID="careers">
      <Txt>{t('careers.intro')}</Txt>
      {families.map((f) => (
        <Section key={f.family} title={f.family}>
          <Grid columns={th.layout === 'phone' ? 1 : 2}>
            {f.careers.map((c) => (
              <Card key={c.id} tint={c.interests.some((i) => child.interests.includes(i)) ? colors.amberSoft : undefined}>
                <Txt variant="h3">
                  {c.emoji} {c.title}
                </Txt>
                <Txt variant="small">{c.description}</Txt>
                {c.tryAtHome.length ? <Txt>🏠 {t('careers.try', { list: c.tryAtHome.slice(0, 2).join('; ') })}</Txt> : null}
                <Row wrap>
                  {c.subjects.slice(0, 4).map((s) => (
                    <Pill key={s} text={s} />
                  ))}
                </Row>
              </Card>
            ))}
          </Grid>
        </Section>
      ))}
    </Screen>
  );
}
