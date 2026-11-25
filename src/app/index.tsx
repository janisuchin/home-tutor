import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Grid, Row, Screen, Tile, Txt, say } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { colors, space, mascotColors, useTheme } from '../ui/theme';
import { useT } from '../i18n';
import { useAppState, setActiveChild } from '../data/store';
import { useChildren } from '../data/hooks';
import { ageFromBirth } from '../core/model';

export default function Home() {
  const t = useT();
  const family = useAppState((s) => s.family);
  const children = useChildren();
  const th = useTheme();

  if (!family) {
    return (
      <Screen back={false} testID="welcome">
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
          <Mascot size={th.layout === 'phone' ? 140 : 180} mood="wave" />
          <Txt variant="display" center>
            {t('app.name')}
          </Txt>
          <Txt center style={{ maxWidth: 560 }}>
            {t('welcome.tagline')}
          </Txt>
        </View>
        <View style={{ gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <Button testID="start-setup" label={t('welcome.start')} icon="🌱" onPress={() => router.push('/setup')} />
          <Button label={t('welcome.signIn')} variant="ghost" icon="☁️" onPress={() => router.push('/account')} />
          <Button label={t('welcome.openKey')} variant="ghost" icon="🔑" onPress={() => router.push('/passport/open')} />
        </View>
        <Grid columns={th.layout === 'phone' ? 1 : 3}>
          <Card tint={colors.primarySoft}>
            <Txt variant="h3">🆓 {t('welcome.free.title')}</Txt>
            <Txt>{t('welcome.free.body')}</Txt>
          </Card>
          <Card tint={colors.tealSoft}>
            <Txt variant="h3">📴 {t('welcome.offline.title')}</Txt>
            <Txt>{t('welcome.offline.body')}</Txt>
          </Card>
          <Card tint={colors.skySoft}>
            <Txt variant="h3">🔒 {t('welcome.private.title')}</Txt>
            <Txt>{t('welcome.private.body')}</Txt>
          </Card>
        </Grid>
        <Row wrap style={{ justifyContent: 'center' }}>
          <Button small variant="ghost" label={t('nav.privacy')} onPress={() => router.push('/privacy')} />
          <Button small variant="ghost" label={t('nav.about')} onPress={() => router.push('/about')} />
          <Button small variant="ghost" label={t('nav.emergency')} icon="🚑" onPress={() => router.push('/emergency')} />
        </Row>
      </Screen>
    );
  }

  const classroomish = ['F', 'G', 'H'].includes(family.mode);
  return (
    <Screen back={false} testID="picker">
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <Row>
          <Mascot size={64} mood="happy" />
          <View style={{ flexShrink: 1 }}>
            <Txt variant="title">{t('picker.title')}</Txt>
            <Txt variant="small">{family.name}</Txt>
          </View>
        </Row>
      </Row>
      {children.length === 0 ? (
        <Card>
          <Txt>{t('picker.empty')}</Txt>
          <Button label={t('picker.addChild')} icon="➕" onPress={() => router.push('/parent/child-edit')} testID="add-first-child" />
        </Card>
      ) : (
        <Grid columns={th.layout === 'phone' ? 2 : th.layout === 'tablet' ? 3 : 4}>
          {children.map((c) => (
            <Tile
              key={c.id}
              testID={`child-${c.name}`}
              emoji={c.avatar}
              title={c.name}
              subtitle={t('picker.age', { age: ageFromBirth(c.birth) })}
              tint={mascotColors[c.color] + '33'}
              onPress={() => {
                setActiveChild(c.id);
                say(t('picker.hello', { name: c.name }));
                router.push(`/learn/${c.id}`);
              }}
            />
          ))}
        </Grid>
      )}
      <Grid columns={th.layout === 'phone' ? 1 : classroomish ? 3 : 2}>
        <Button testID="parent-area" variant="secondary" icon="👪" label={t('nav.parent')} onPress={() => router.push('/parent')} />
        <Button variant="ghost" icon="🧑‍🏫" label={t('nav.tutor')} onPress={() => router.push('/tutor')} />
        {classroomish || family.mode === 'E' || family.mode === 'D' ? (
          <Button testID="classroom" variant="ghost" icon="🏫" label={t('nav.classroom')} onPress={() => router.push('/classroom')} />
        ) : null}
      </Grid>
      <Row wrap style={{ justifyContent: 'center' }}>
        <Button small variant="ghost" label={t('nav.emergency')} icon="🚑" onPress={() => router.push('/emergency')} />
        <Button small variant="ghost" label={t('nav.privacy')} onPress={() => router.push('/privacy')} />
        <Button small variant="ghost" label={t('nav.about')} onPress={() => router.push('/about')} />
      </Row>
    </Screen>
  );
}
