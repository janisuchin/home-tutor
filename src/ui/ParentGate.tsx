/**
 * Parent PIN gate for parent and tutor areas. On-screen number pad: works by touch, mouse or keyboard.
 */
import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Notice, Screen, Txt } from './kit';
import { Mascot } from './Mascot';
import { colors, radius, space, useTheme } from './theme';
import { useT } from '../i18n';
import { getState, unlockParent, useAppState, useParentUnlocked } from '../data/store';
import { hashPin } from '../core/crypto';

export function ParentGate({ children, title }: { children: ReactNode; title?: string }) {
  const unlocked = useParentUnlocked();
  const family = useAppState((s) => s.family);
  if (!family) {
    return (
      <Screen title={title}>
        <Button label="Set up" onPress={() => router.replace('/setup')} />
      </Screen>
    );
  }
  if (unlocked || !family.pinHash) return <>{children}</>;
  return <PinPad title={title} />;
}

function PinPad({ title }: { title?: string }) {
  const t = useT();
  const th = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const press = (d: string) => {
    if (Date.now() < lockedUntil) return;
    setError(false);
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };
  const check = () => {
    const f = getState().family;
    if (!f?.pinHash || !f.pinSalt) return;
    if (hashPin(pin, f.pinSalt) === f.pinHash) {
      unlockParent();
    } else {
      const n = tries + 1;
      setTries(n);
      setError(true);
      setPin('');
      if (n >= 5) setLockedUntil(Date.now() + 60_000);
    }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
  return (
    <Screen title={title ?? t('gate.title')} testID="pin-gate">
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Mascot size={80} mood="think" />
        <Txt center>{t('gate.body')}</Txt>
        <View accessible accessibilityLabel={t('gate.entered', { n: pin.length })} style={{ flexDirection: 'row', gap: space.sm }}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: i < pin.length ? colors.primary : colors.border }} />
          ))}
        </View>
        {error ? <Notice tone="danger" text={tries >= 5 ? t('gate.locked') : t('gate.wrong')} /> : null}
        <View style={{ width: 280, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
          {keys.map((k) => (
            <Pressable
              key={k}
              testID={`pin-${k}`}
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? t('gate.delete') : k === '✓' ? t('gate.enter') : k}
              onPress={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : k === '✓' ? check() : press(k))}
              style={({ pressed }) => ({
                width: 84,
                height: th.touch + 8,
                borderRadius: radius.md,
                backgroundColor: k === '✓' ? colors.primary : colors.surface,
                borderWidth: 2,
                borderColor: k === '✓' ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 26, fontWeight: '700', color: k === '✓' ? colors.white : colors.text }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Txt variant="small" center>
          {t('gate.forgot')}
        </Txt>
      </View>
    </Screen>
  );
}
