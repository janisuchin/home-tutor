/**
 * Printable class report: attendance and progress for one group over 7, 30 or 90 days.
 * On the web "Print / Save as PDF" uses the browser's print dialog. Works offline.
 */
import React, { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Choice, Row, Screen, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { colors, space } from '../../ui/theme';
import { useT } from '../../i18n';
import { useAppState } from '../../data/store';
import { useCatalog, useChildren } from '../../data/hooks';
import { buildClassReport } from '../../core/engine/class-report';

export default function ClassReportScreen() {
  const t = useT();
  return (
    <ParentGate title={t('report.title')}>
      <Report />
    </ParentGate>
  );
}

function Cell({ children, w = 90, bold }: { children: React.ReactNode; w?: number; bold?: boolean }) {
  return (
    <View style={{ width: w, paddingVertical: 6, paddingHorizontal: 4 }}>
      <Txt variant="small" bold={bold}>
        {children}
      </Txt>
    </View>
  );
}

function Report() {
  const t = useT();
  const { group: groupId } = useLocalSearchParams<{ group: string }>();
  const group = useAppState((s) => (groupId ? s.groups[groupId] : undefined));
  const attendance = useAppState((s) => (groupId ? s.attendance[groupId] : undefined));
  const events = useAppState((s) => s.events);
  const family = useAppState((s) => s.family);
  const children = useChildren();
  const catalog = useCatalog();
  const [days, setDays] = useState('30');
  const report = useMemo(() => (group ? buildClassReport(group, children, attendance, events, catalog, { days: Number(days) }) : undefined), [group, children, attendance, events, catalog, days]);
  if (!group || !report) return <Screen title={t('report.title')}>{<Txt>{t('report.noGroup')}</Txt>}</Screen>;
  const pct = (n?: number) => (n === undefined ? '—' : `${n}%`);
  return (
    <Screen title={t('report.title')} bg={colors.white} testID="class-report" back="/classroom">
      {Platform.OS === 'web' ? (
        <View style={{ gap: 8 }} {...({ dataSet: { noprint: '1' } } as object)}>
          <Choice testID="report-days" value={days} onChange={setDays} options={['7', '30', '90'].map((d) => ({ value: d, label: t('report.lastDays', { n: d }) }))} />
          <Button icon="🖨️" label={t('print.button')} onPress={() => window.print()} testID="print-report" />
        </View>
      ) : null}
      <Card>
        <Txt variant="h2">
          🏫 {report.groupName}
          {family?.name ? ` · ${family.name}` : ''}
        </Txt>
        <Txt testID="report-period">{t('report.period', { from: report.from, to: report.to })}</Txt>
        <Row wrap>
          <Txt bold testID="report-sessions">{t('report.sessions', { n: report.sessions })}</Txt>
          <Txt bold>{t('report.avgAttendance', { pct: pct(report.averageAttendancePct) })}</Txt>
        </Row>
      </Card>
      <Card>
        <Txt variant="h3">✅ {t('report.attendanceTitle')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: colors.border }}>
          <Cell w={140} bold>{t('report.col.name')}</Cell>
          <Cell bold>{t('report.col.present')}</Cell>
          <Cell bold>{t('report.col.attendance')}</Cell>
          <Cell bold>{t('report.col.done')}</Cell>
          <Cell bold>{t('report.col.group')}</Cell>
          <Cell bold>{t('report.col.minutes')}</Cell>
          <Cell bold>{t('report.col.score')}</Cell>
          <Cell bold>{t('report.col.confirmed')}</Cell>
        </View>
        {report.rows.map((r) => (
          <View key={r.childId} testID={`report-row-${r.name}`} style={{ flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: colors.border }}>
            <Cell w={140} bold>
              {r.avatar} {r.name}
            </Cell>
            <Cell>{`${r.present}/${r.sessions}`}</Cell>
            <Cell>{pct(r.attendancePct)}</Cell>
            <Cell>{r.completed}</Cell>
            <Cell>{r.groupLessons}</Cell>
            <Cell>{r.minutes}</Cell>
            <Cell>{pct(r.avgScore)}</Cell>
            <Cell>{r.confirmedStages}</Cell>
          </View>
        ))}
      </Card>
      <Card>
        <Txt variant="h3">📅 {t('report.daysTitle')}</Txt>
        {report.days.length === 0 ? <Txt variant="small">{t('report.noDays')}</Txt> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {report.days.map((d) => (
            <Txt key={d.day} variant="small">
              {d.day}: {d.present}/{report.rows.length}
            </Txt>
          ))}
        </View>
      </Card>
      <Card>
        <Txt variant="h3">📚 {t('report.areasTitle')}</Txt>
        {report.rows.map((r) => (
          <Txt key={r.childId} variant="small">
            {r.name}: {r.areas.length ? r.areas.map((a) => t(`area.${a}`)).join(', ') : '—'}
          </Txt>
        ))}
      </Card>
      <Txt variant="small">{t('report.footer')}</Txt>
    </Screen>
  );
}
