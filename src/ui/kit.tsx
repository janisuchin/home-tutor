/**
 * UI kit. Every interactive element has an accessibility role and label, a large touch target
 * and works by touch, mouse, keyboard or switch access alike.
 */
import React, { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { colors, radius, space, useTheme } from './theme';
import { t } from '../i18n';
import type { SafetyRating } from '../core/content-types';

type TxtVariant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'small' | 'label';
const SIZES: Record<TxtVariant, number> = { display: 34, title: 28, h2: 22, h3: 18, body: 17, small: 14, label: 15 };

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  center,
  bold,
  numberOfLines,
  role,
  testID,
}: {
  testID?: string;
  children: ReactNode;
  variant?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  bold?: boolean;
  numberOfLines?: number;
  role?: 'header' | 'text' | 'alert';
}) {
  const th = useTheme();
  const size = th.fs(SIZES[variant]);
  const heavy = bold || variant === 'display' || variant === 'title' || variant === 'h2' || variant === 'h3' || variant === 'label';
  return (
    <Text
      testID={testID}
      accessibilityRole={role ?? (variant === 'title' || variant === 'display' || variant === 'h2' ? 'header' : undefined)}
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * th.lineHeight),
          color: color ?? (variant === 'small' ? colors.muted : colors.text),
          fontWeight: heavy ? (variant === 'label' ? '600' : '800') : '400',
          fontFamily: heavy ? th.fontBold : th.fontFamily,
          letterSpacing: th.letterSpacing,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  title,
  back = true,
  right,
  scroll = true,
  bg = colors.bg,
  testID,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean | string;
  right?: ReactNode;
  scroll?: boolean;
  bg?: string;
  testID?: string;
}) {
  const th = useTheme();
  const pad = th.layout === 'phone' ? space.lg : space.xl;
  const goBack = () => {
    if (typeof back === 'string') router.replace(back as any);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const header =
    title || back ? (
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        {back ? (
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={({ pressed }) => [styles.backBtn, { minWidth: th.touch, minHeight: th.touch }, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: th.fs(24), color: colors.text }}>←</Text>
          </Pressable>
        ) : null}
        {title ? (
          <Txt variant="title" style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </Txt>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {right}
      </View>
    ) : null;
  const body = (
    <View style={{ width: '100%', maxWidth: th.maxWidth, alignSelf: 'center', paddingHorizontal: pad, paddingBottom: 48, gap: space.lg }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} testID={testID}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingTop: space.sm }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: space.sm }}>{body}</View>
      )}
    </SafeAreaView>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  accessibilityLabel,
  testID,
  small,
  speak,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  small?: boolean;
  speak?: boolean;
}) {
  const th = useTheme();
  const v = {
    primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
    secondary: { bg: colors.teal, fg: colors.white, border: colors.teal },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: colors.red, fg: colors.white, border: colors.red },
    soft: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft },
  }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (speak) say(label);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: th.highContrast ? colors.text : v.border,
          minHeight: small ? 44 : th.touch,
          paddingHorizontal: small ? space.md : space.xl,
          opacity: disabled ? 0.5 : 1,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Text style={{ fontSize: th.fs(small ? 18 : 22) }}>{icon}</Text> : null}
      <Text
        style={{
          color: v.fg,
          fontSize: th.fs(small ? 15 : 18),
          fontWeight: '700',
          fontFamily: th.fontBold,
          letterSpacing: th.letterSpacing,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  style,
  tint,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const th = useTheme();
  const base = [
    styles.card,
    { backgroundColor: tint ?? colors.surface, borderColor: th.highContrast ? colors.text : colors.border },
    style,
  ];
  if (!onPress)
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** A big picture tile: emoji first, a few words, read aloud on long-press. */
export function Tile({
  emoji,
  title,
  subtitle,
  onPress,
  tint,
  testID,
  badge,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tint?: string;
  testID?: string;
  badge?: ReactNode;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={() => say(title + (subtitle ? '. ' + subtitle : ''))}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tint ?? colors.surface, borderColor: th.highContrast ? colors.text : colors.border, minHeight: th.look === 'picture' ? 150 : 120 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ fontSize: th.fs(th.look === 'picture' ? 52 : 36) }} accessibilityElementsHidden importantForAccessibility="no">
        {emoji}
      </Text>
      <Txt variant="h3" center numberOfLines={3}>
        {title}
      </Txt>
      {subtitle && th.look !== 'picture' ? (
        <Txt variant="small" center numberOfLines={2}>
          {subtitle}
        </Txt>
      ) : null}
      {badge}
    </Pressable>
  );
}

export function Grid({ children, columns, gap = space.md }: { children: ReactNode; columns?: number; gap?: number }) {
  const th = useTheme();
  const cols = columns ?? th.columns;
  const items = React.Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {r.map((c, j) => (
            <View key={j} style={{ flex: 1 }}>
              {c}
            </View>
          ))}
          {r.length < cols ? Array.from({ length: cols - r.length }).map((_, k) => <View key={`e${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

export function Row({ children, gap = space.sm, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  testID?: string;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.teal : colors.surface,
          borderColor: selected ? colors.teal : th.highContrast ? colors.text : colors.border,
          minHeight: 44,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: selected ? colors.white : colors.text, fontSize: th.fs(15), fontWeight: '600', fontFamily: th.fontBold }}>
        {selected ? '✓ ' : ''}
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} testID={testID}>
      {options.map((o) => (
        <RadioChip key={o.value} label={o.label} icon={o.icon} selected={o.value === value} onPress={() => onChange(o.value)} testID={testID ? `${testID}-${o.value}` : undefined} />
      ))}
    </View>
  );
}

function RadioChip({ label, selected, onPress, icon, testID }: { label: string; selected: boolean; onPress: () => void; icon?: string; testID?: string }) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : th.highContrast ? colors.text : colors.border, minHeight: 44 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: selected ? colors.white : colors.text, fontSize: th.fs(15), fontWeight: '600', fontFamily: th.fontBold }}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  testID,
  multiline,
  hint,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  testID?: string;
  multiline?: boolean;
  hint?: string;
  autoComplete?: any;
}) {
  const th = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' || secure ? 'none' : 'sentences'}
        autoComplete={autoComplete}
        accessibilityLabel={label}
        accessibilityHint={hint}
        multiline={multiline}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          minHeight: multiline ? 88 : 52,
          borderWidth: 2,
          borderColor: focus ? colors.focus : th.highContrast ? colors.text : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          fontSize: th.fs(17),
          backgroundColor: colors.surface,
          color: colors.text,
          fontFamily: th.fontFamily,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

export function ProgressBar({ value, color = colors.teal, label }: { value: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
}

const SAFETY_STYLE: Record<SafetyRating, { fg: string; bg: string; icon: string }> = {
  green: { fg: colors.green, bg: colors.greenSoft, icon: '🟢' },
  amber: { fg: colors.amber, bg: colors.amberSoft, icon: '🟠' },
  red: { fg: colors.red, bg: colors.redSoft, icon: '🔴' },
};

export function SafetyBadge({ rating, long }: { rating: SafetyRating; long?: boolean }) {
  const s = SAFETY_STYLE[rating];
  const th = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${t(`safety.${rating}`)}. ${t(`safety.${rating}.long`)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: s.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: s.fg }}
    >
      <Text style={{ fontSize: th.fs(12) }}>{s.icon}</Text>
      <Text style={{ color: s.fg, fontWeight: '700', fontSize: th.fs(14), fontFamily: th.fontBold }}>
        {t(`safety.${rating}`)}
        {long ? ` · ${t(`safety.${rating}.long`)}` : ''}
      </Text>
    </View>
  );
}

export function Pill({ text, fg = colors.text, bg = colors.surfaceAlt }: { text: string; fg?: string; bg?: string }) {
  const th = useTheme();
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: th.fs(13), fontFamily: th.fontBold }}>{text}</Text>
    </View>
  );
}

let speakingLang = 'en';
export function setSpeechLanguage(lang: string) {
  speakingLang = lang;
}

/** Read aloud with the device text-to-speech (free, offline on most devices). */
export function say(text: string, language?: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: language ?? speakingLang, rate: 0.9 });
  } catch {
    // no TTS on this device: silently ignore
  }
}

export function SpeakButton({ text, language, label }: { text: string; language?: string; label?: string }) {
  const th = useTheme();
  return (
    <Pressable
      onPress={() => say(text, language)}
      accessibilityRole="button"
      accessibilityLabel={label ?? t('common.readAloud')}
      style={({ pressed }) => [styles.speak, { minWidth: th.touch, minHeight: th.touch }, pressed && styles.pressed]}
    >
      <Text style={{ fontSize: th.fs(24) }}>🔊</Text>
    </Pressable>
  );
}

export function Section({ title, children, right, testID }: { title: string; children: ReactNode; right?: ReactNode; testID?: string }) {
  return (
    <View style={{ gap: space.md }} testID={testID}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="h2" style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {right}
      </Row>
      {children}
    </View>
  );
}

export function Notice({ text, tone = 'info', icon }: { text: string; tone?: 'info' | 'warn' | 'danger' | 'ok'; icon?: string }) {
  const c = {
    info: { fg: colors.sky, bg: colors.skySoft, i: 'ℹ️' },
    warn: { fg: colors.amber, bg: colors.amberSoft, i: '⚠️' },
    danger: { fg: colors.red, bg: colors.redSoft, i: '⛔' },
    ok: { fg: colors.green, bg: colors.greenSoft, i: '✅' },
  }[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: space.sm, backgroundColor: c.bg, borderRadius: radius.md, padding: space.md, borderLeftWidth: 5, borderLeftColor: c.fg }}>
      <Text style={{ fontSize: 18 }}>{icon ?? c.i}</Text>
      <Txt style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />;
}

export const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingBottom: space.sm },
  backBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.pill, borderWidth: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  tile: { borderRadius: radius.lg, borderWidth: 2, padding: space.md, gap: space.xs, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: radius.pill, borderWidth: 2, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'center' },
  speak: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.skySoft },
});
