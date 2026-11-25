/** Emergency numbers by country, each with its source; unverified numbers are clearly marked. */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { Button, Card, Field, Grid, Notice, Pill, Row, Screen, Txt } from '../ui/kit';
import { colors, useTheme } from '../ui/theme';
import { useT } from '../i18n';
import { useAppState } from '../data/store';
import { loadEmergencyNumbers } from '../content/loader';
import type { EmergencyNumber } from '../core/content-types';

export default function Emergency() {
  const t = useT();
  const th = useTheme();
  const country = useAppState((s) => s.family?.country);
  const [list, setList] = useState<EmergencyNumber[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    loadEmergencyNumbers().then(setList).catch(() => {});
  }, []);
  const shown = useMemo(() => {
    const f = list.filter((e) => !q || e.country.toLowerCase().includes(q.toLowerCase()) || e.countryCode.toLowerCase() === q.toLowerCase());
    return f.sort((a, b) => (a.countryCode === country ? -1 : b.countryCode === country ? 1 : a.country.localeCompare(b.country)));
  }, [list, q, country]);
  return (
    <Screen title={t('emergency.title')} testID="emergency">
      <Notice tone="danger" text={t('emergency.first')} />
      <Txt>{t('emergency.intro')}</Txt>
      <Field label={t('emergency.search')} value={q} onChangeText={setQ} />
      <Grid columns={th.layout === 'phone' ? 1 : 2}>
        {shown.map((e) => (
          <Card key={e.countryCode} tint={e.countryCode === country ? colors.redSoft : undefined} testID={`em-${e.countryCode}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="h3">{e.country}</Txt>
              {e.verified ? <Pill text={`✓ ${t('emergency.verified')}`} fg={colors.green} bg={colors.greenSoft} /> : <Pill text={`⚠ ${t('emergency.unverified')}`} fg={colors.amber} bg={colors.amberSoft} />}
            </Row>
            <Row wrap>
              {e.general ? <Pill text={`🆘 ${e.general}`} fg={colors.white} bg={colors.red} /> : null}
              {e.ambulance ? <Pill text={`🚑 ${e.ambulance}`} /> : null}
              {e.fire ? <Pill text={`🚒 ${e.fire}`} /> : null}
              {e.police ? <Pill text={`🚓 ${e.police}`} /> : null}
            </Row>
            {e.note ? <Txt variant="small">{e.note}</Txt> : null}
            <Button small variant="ghost" label={`📎 ${e.source.publisher}`} onPress={() => Linking.openURL(e.source.url)} />
          </Card>
        ))}
      </Grid>
    </Screen>
  );
}
