/**
 * Classroom and groups (modes E-H): groups, attendance, group assignments, compatibility and
 * shared lessons for siblings with individual progression.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, Choice, Field, Grid, Notice, Pill, Row, Screen, Section, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { colors, useTheme } from '../../ui/theme';
import { useT } from '../../i18n';
import { saveAssignment, saveGroup, setAttendance, useAppState } from '../../data/store';
import { useCatalog, useChildren } from '../../data/hooks';
import { groupCompatibility } from '../../core/engine/insights';
import { randomId } from '../../core/crypto';
import { dayKey } from '../../core/screen-time';
import type { Group } from '../../core/model';

export default function ClassroomScreen() {
  const t = useT();
  return (
    <ParentGate title={t('classroom.title')}>
      <Classroom />
    </ParentGate>
  );
}

function Classroom() {
  const t = useT();
  const th = useTheme();
  const family = useAppState((s) => s.family);
  const groupsMap = useAppState((s) => s.groups);
  const assignmentsMap = useAppState((s) => s.assignments);
  const attendance = useAppState((s) => s.attendance);
  const children = useChildren();
  const catalog = useCatalog();
  const groups = useMemo(() => Object.values(groupsMap).filter((g) => !g.deleted), [groupsMap]);
  const [selected, setSelected] = useState<string | undefined>(groups[0]?.id);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Group['kind']>(family?.mode === 'E' ? 'siblings' : family?.mode === 'F' ? 'small-group' : 'classroom');
  const [members, setMembers] = useState<string[]>([]);
  const group = groups.find((g) => g.id === selected);
  const groupChildren = children.filter((c) => group?.childIds.includes(c.id));
  const compat = useMemo(() => (catalog && groupChildren.length ? groupCompatibility(groupChildren, family, catalog) : undefined), [catalog, groupChildren, family]);
  const today = dayKey();
  const present = group ? attendance[group.id]?.[today] ?? [] : [];
  const assignments = Object.values(assignmentsMap).filter((a) => a.groupId === group?.id && !a.deleted);

  return (
    <Screen title={t('classroom.title')} testID="classroom-screen">
      <Txt>{t('classroom.intro')}</Txt>
      <Section title={t('classroom.groups')}>
        <Row wrap>
          {groups.map((g) => (
            <Chip key={g.id} label={`${g.name} (${g.childIds.length})`} selected={g.id === selected} onPress={() => setSelected(g.id)} />
          ))}
        </Row>
        <Card>
          <Txt variant="label">{t('classroom.newGroup')}</Txt>
          <Field testID="group-name" label={t('classroom.groupName')} value={name} onChangeText={setName} />
          <Choice value={kind} onChange={setKind} options={(['siblings', 'small-group', 'classroom'] as const).map((k) => ({ value: k, label: t(`groupKind.${k}`) }))} />
          <Row wrap>
            {children.map((c) => (
              <Chip key={c.id} testID={`member-${c.name}`} label={`${c.avatar} ${c.name}`} selected={members.includes(c.id)} onPress={() => setMembers(members.includes(c.id) ? members.filter((m) => m !== c.id) : [...members, c.id])} />
            ))}
          </Row>
          <Button
            testID="create-group"
            small
            label={t('classroom.create')}
            disabled={!name.trim() || members.length === 0}
            onPress={() => {
              const g: Group = { id: randomId(), name: name.trim(), kind, childIds: members, updatedAt: Date.now() };
              saveGroup(g);
              setSelected(g.id);
              setName('');
              setMembers([]);
            }}
          />
          {children.length === 0 ? <Notice text={t('classroom.noChildren')} /> : null}
        </Card>
      </Section>

      {group ? (
        <>
          <Grid columns={th.layout === 'phone' ? 1 : 2}>
            <Section title={`✅ ${t('classroom.attendance', { date: today })}`} testID="attendance">
              <Card>
                {groupChildren.map((c) => (
                  <Chip
                    key={c.id}
                    testID={`present-${c.name}`}
                    label={`${c.avatar} ${c.name}`}
                    selected={present.includes(c.id)}
                    onPress={() => setAttendance(group.id, today, present.includes(c.id) ? present.filter((x) => x !== c.id) : [...present, c.id])}
                  />
                ))}
                <Txt variant="small">{t('classroom.presentCount', { a: present.length, b: groupChildren.length })}</Txt>
              </Card>
            </Section>
            {compat ? (
              <Section title={`🤝 ${t('classroom.compat')}`}>
                <Card tint={colors.tealSoft}>
                  <Txt variant="h2">{compat.score}/100</Txt>
                  <Txt variant="small">{t('tutor.compatBody', { spread: compat.bandSpread, shared: compat.sharedInterests.map((i) => t(`interest.${i}`)).join(', ') || '—' })}</Txt>
                </Card>
              </Section>
            ) : null}
          </Grid>

          <Section title={`📋 ${t('classroom.assignments')}`}>
            {assignments.map((a) => {
              const it = catalog?.items.find((i) => i.id === a.itemId);
              return (
                <Card key={a.id}>
                  <Txt bold>
                    {it?.emoji} {it?.title}
                  </Txt>
                  <Button small variant="ghost" label={t('classroom.remove')} onPress={() => saveAssignment({ ...a, deleted: true })} />
                </Card>
              );
            })}
            <Txt variant="label">{t('classroom.shared')}</Txt>
            <Txt variant="small">{t('classroom.sharedHint')}</Txt>
            <Grid columns={th.layout === 'phone' ? 1 : 2}>
              {(compat?.sharedItems ?? []).slice(0, 8).map((i) => (
                <Card key={i.id}>
                  <Txt bold>
                    {i.emoji} {i.title}
                  </Txt>
                  <Row wrap>
                    <Pill text={t(`area.${i.area}`)} />
                    <Button
                      small
                      testID={`assign-${i.id}`}
                      label={t('classroom.assign')}
                      onPress={() => saveAssignment({ id: randomId(), groupId: group.id, itemId: i.id, childIds: [], createdAt: Date.now(), updatedAt: Date.now() })}
                    />
                  </Row>
                </Card>
              ))}
            </Grid>
          </Section>

          <Button testID="present" icon="📽️" variant="secondary" label={t('classroom.present')} onPress={() => router.push(`/classroom/present?group=${group.id}`)} />
        </>
      ) : null}
      <View style={{ height: 24 }} />
    </Screen>
  );
}
