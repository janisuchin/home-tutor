/**
 * Sprout: the original Home Tutor mascot, drawn in code (no AI images). A round seed-friend with a
 * two-leaf sprout, because every child grows at their own pace.
 */
import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { mascotColors } from './theme';

export type MascotMood = 'happy' | 'wave' | 'think' | 'cheer' | 'sleep';

export function Mascot({
  size = 96,
  color = 'sun',
  mood = 'happy',
  label = 'Sprout, the Home Tutor helper',
}: {
  size?: number;
  color?: string;
  mood?: MascotMood;
  label?: string;
}) {
  const body = mascotColors[color] ?? color;
  const eyesClosed = mood === 'sleep';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image" accessibilityLabel={label}>
      {/* sprout */}
      <Path d="M60 30 C60 22 60 16 60 12" stroke="#15803D" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M60 16 C50 4 34 8 34 14 C40 22 54 22 60 16 Z" fill="#22C55E" />
      <Path d="M60 14 C70 0 88 4 88 10 C82 20 66 20 60 14 Z" fill="#4ADE80" />
      {/* body */}
      <Ellipse cx={60} cy={72} rx={42} ry={40} fill={body} />
      <Ellipse cx={60} cy={84} rx={28} ry={22} fill="#FFFFFF" opacity={0.35} />
      {/* arms */}
      {mood === 'wave' || mood === 'cheer' ? (
        <G>
          <Path d="M20 66 C8 56 8 44 14 40" stroke={body} strokeWidth={10} strokeLinecap="round" fill="none" />
          {mood === 'cheer' ? (
            <Path d="M100 66 C112 56 112 44 106 40" stroke={body} strokeWidth={10} strokeLinecap="round" fill="none" />
          ) : (
            <Path d="M100 76 C108 82 110 88 106 92" stroke={body} strokeWidth={10} strokeLinecap="round" fill="none" />
          )}
        </G>
      ) : (
        <G>
          <Path d="M20 76 C12 82 10 88 14 92" stroke={body} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Path d="M100 76 C108 82 110 88 106 92" stroke={body} strokeWidth={10} strokeLinecap="round" fill="none" />
        </G>
      )}
      {/* eyes */}
      {eyesClosed ? (
        <G>
          <Path d="M40 64 Q46 68 52 64" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M68 64 Q74 68 80 64" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Circle cx={46} cy={62} r={9} fill="#FFFFFF" />
          <Circle cx={74} cy={62} r={9} fill="#FFFFFF" />
          <Circle cx={mood === 'think' ? 49 : 47} cy={mood === 'think' ? 59 : 63} r={5} fill="#1E1B18" />
          <Circle cx={mood === 'think' ? 77 : 75} cy={mood === 'think' ? 59 : 63} r={5} fill="#1E1B18" />
          <Circle cx={49} cy={60} r={1.6} fill="#FFFFFF" />
          <Circle cx={77} cy={60} r={1.6} fill="#FFFFFF" />
        </G>
      )}
      {/* cheeks */}
      <Circle cx={34} cy={76} r={6} fill="#FB7185" opacity={0.55} />
      <Circle cx={86} cy={76} r={6} fill="#FB7185" opacity={0.55} />
      {/* mouth */}
      {mood === 'think' ? (
        <Path d="M54 82 Q60 80 66 82" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
      ) : mood === 'cheer' ? (
        <Path d="M48 78 Q60 96 72 78 Z" fill="#7C2D12" />
      ) : (
        <Path d="M50 80 Q60 90 70 80" stroke="#1E1B18" strokeWidth={3} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  );
}
