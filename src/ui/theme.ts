/**
 * Design system: warm, bright, rounded, high contrast. All text colours meet WCAG AA (4.5:1) on
 * their backgrounds; badges always carry a word and an icon, never colour alone.
 */
import { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAppState } from '../data/store';
import type { AgeLook } from '../core/model';

export const colors = {
  bg: '#FFF9F0',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF1DE',
  text: '#1E1B18',
  muted: '#574E46',
  border: '#E8D9C4',
  primary: '#C2410C', // white text 5.2:1
  primaryDark: '#9A3412',
  primarySoft: '#FFEDD5',
  teal: '#0F766E',
  tealSoft: '#CCFBF1',
  sky: '#0369A1',
  skySoft: '#E0F2FE',
  purple: '#6D28D9',
  purpleSoft: '#EDE9FE',
  pink: '#BE185D',
  pinkSoft: '#FCE7F3',
  green: '#15803D',
  greenSoft: '#DCFCE7',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#B91C1C',
  redSoft: '#FEE2E2',
  white: '#FFFFFF',
  focus: '#2563EB',
};

export const areaColors: Record<string, { fg: string; bg: string }> = {
  'core-academics': { fg: colors.sky, bg: colors.skySoft },
  'life-skills': { fg: colors.primary, bg: colors.primarySoft },
  'physical-education': { fg: colors.green, bg: colors.greenSoft },
  health: { fg: colors.pink, bg: colors.pinkSoft },
  'first-aid': { fg: colors.red, bg: colors.redSoft },
  'nature-animals': { fg: colors.green, bg: colors.greenSoft },
  'civics-social': { fg: colors.purple, bg: colors.purpleSoft },
  'financial-literacy': { fg: colors.amber, bg: colors.amberSoft },
  'technology-ai': { fg: colors.sky, bg: colors.skySoft },
  languages: { fg: colors.teal, bg: colors.tealSoft },
  'arts-creativity': { fg: colors.pink, bg: colors.pinkSoft },
  'philosophy-worldviews': { fg: colors.purple, bg: colors.purpleSoft },
  environment: { fg: colors.teal, bg: colors.tealSoft },
  careers: { fg: colors.amber, bg: colors.amberSoft },
  'special-interests': { fg: colors.primary, bg: colors.primarySoft },
  projects: { fg: colors.primary, bg: colors.primarySoft },
  'independent-learning': { fg: colors.sky, bg: colors.skySoft },
};

export const mascotColors: Record<string, string> = {
  sun: '#F59E0B',
  leaf: '#22C55E',
  sky: '#38BDF8',
  berry: '#EC4899',
  plum: '#A78BFA',
  coral: '#FB7185',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export type LayoutKind = 'phone' | 'tablet' | 'desktop' | 'projector';

/** Projector/TV mode is switched on by the presentation screen (teacher-controlled). */
export const ProjectorContext = createContext(false);

export interface Theme {
  layout: LayoutKind;
  width: number;
  columns: number;
  scale: number;
  fontFamily?: string;
  fontBold?: string;
  letterSpacing: number;
  lineHeight: number;
  look: AgeLook;
  highContrast: boolean;
  touch: number; // minimum touch target
  maxWidth: number;
  fs: (size: number) => number;
}

export const AgeLookContext = createContext<AgeLook>('full');

export function useTheme(): Theme {
  const { width } = useWindowDimensions();
  const projector = useContext(ProjectorContext);
  const look = useContext(AgeLookContext);
  const settings = useAppState((s) => s.family?.settings);
  return useMemo(() => {
    const layout: LayoutKind = projector ? 'projector' : width < 600 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
    const dys = !!settings?.dyslexiaFont;
    let scale = 1;
    if (settings?.largeText) scale *= 1.2;
    if (look === 'picture') scale *= 1.15;
    if (layout === 'projector') scale *= 1.6;
    const columns = layout === 'phone' ? (look === 'picture' ? 2 : 1) : layout === 'tablet' ? 2 : 3;
    return {
      layout,
      width,
      columns,
      scale,
      fontFamily: dys ? 'AtkinsonHyperlegible_400Regular' : undefined,
      fontBold: dys ? 'AtkinsonHyperlegible_700Bold' : undefined,
      letterSpacing: dys ? 0.6 : 0,
      lineHeight: dys ? 1.6 : 1.4,
      look,
      highContrast: !!settings?.highContrast,
      touch: look === 'picture' ? 64 : 52,
      maxWidth: layout === 'projector' ? 1600 : 1100,
      fs: (size: number) => Math.round(size * scale),
    };
  }, [width, projector, look, settings?.dyslexiaFont, settings?.largeText, settings?.highContrast]);
}
