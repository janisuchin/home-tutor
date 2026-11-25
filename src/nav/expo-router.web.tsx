/**
 * A small web-only stand-in for the parts of Expo Router this app uses: router.push / replace /
 * back / canGoBack, useLocalSearchParams, useRouter, usePathname, Stack, Slot and Link.
 *
 * Why: on the web Expo Router's runtime (React Navigation, tabs, toolbars, head manager) was about
 * 430 KB of the 1.1 MB entry bundle. Metro maps `expo-router` to this file for web builds only
 * (metro.config.js); Android and iOS keep the real Expo Router. Every screen is a lazy chunk.
 * URLs and the browser back button work as before (History API).
 */
import React, { Suspense, createContext, lazy, useContext, useMemo, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { hrefToPath, matchPath, parseQuery, sortPatterns } from './match';
import { LAYOUTS, ROUTES } from './routes.web';
import RootLayout from '../app/_layout';

type Href = string | { pathname: string; params?: Record<string, string | number | undefined> };

interface Loc {
  path: string;
  search: string;
  idx: number;
  key: number;
}

let seq = 0;
function readLoc(): Loc {
  const w = typeof window !== 'undefined' ? window : undefined;
  const idx = typeof w?.history.state?.htIdx === 'number' ? w.history.state.htIdx : 0;
  return { path: w?.location.pathname ?? '/', search: w?.location.search ?? '', idx, key: ++seq };
}
let loc: Loc = readLoc();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  if (typeof window.history.state?.htIdx !== 'number') window.history.replaceState({ ...(window.history.state ?? {}), htIdx: 0 }, '');
  window.addEventListener('popstate', () => {
    loc = readLoc();
    emit();
  });
}

function go(href: Href, replace: boolean) {
  const target = hrefToPath(href);
  const url = new URL(target, window.location.origin);
  const idx = replace ? loc.idx : loc.idx + 1;
  window.history[replace ? 'replaceState' : 'pushState']({ htIdx: idx }, '', url.pathname + url.search + url.hash);
  loc = { path: url.pathname, search: url.search, idx, key: ++seq };
  emit();
}

export const router = {
  push: (href: Href) => go(href, false),
  navigate: (href: Href) => go(href, false),
  replace: (href: Href) => go(href, true),
  back: () => window.history.back(),
  canGoBack: () => loc.idx > 0,
  setParams: (params: Record<string, string>) => {
    const q = new URLSearchParams(loc.search);
    for (const [k, v] of Object.entries(params)) q.set(k, v);
    go(`${loc.path}?${q.toString()}`, true);
  },
};

function useLoc(): Loc {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => loc,
    () => loc,
  );
}

export function useRouter() {
  return router;
}
export function usePathname() {
  return useLoc().path;
}

const PATTERNS = sortPatterns(ROUTES.map((r) => r.path));
const lazyPages = new Map<string, ComponentType<any>>();
const lazyLayouts = new Map<string, ComponentType<any>>();
function pageFor(path: string) {
  let c = lazyPages.get(path);
  if (!c) {
    c = lazy(ROUTES.find((r) => r.path === path)!.load);
    lazyPages.set(path, c);
  }
  return c;
}
function layoutFor(name: keyof typeof LAYOUTS) {
  let c = lazyLayouts.get(name);
  if (!c) {
    c = lazy(LAYOUTS[name]);
    lazyLayouts.set(name, c);
  }
  return c;
}

const ParamsContext = createContext<Record<string, string>>({});
const OutletContext = createContext<ReactNode>(null);

export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}
export const useGlobalSearchParams = useLocalSearchParams;

/** Renders the matched child route (used by layouts). */
export function Slot() {
  return <>{useContext(OutletContext)}</>;
}

/** The root Stack: renders the current screen; only `contentStyle` of screenOptions is used. */
export function Stack({ screenOptions }: { screenOptions?: { contentStyle?: object } } & Record<string, unknown>) {
  return <View style={[{ flex: 1 }, screenOptions?.contentStyle]}>{useContext(OutletContext)}</View>;
}
Stack.Screen = function StackScreen(_: Record<string, unknown>) {
  return null;
};

export function Link({ href, children, replace }: { href: Href; children: ReactNode; replace?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => go(href, !!replace)}>
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </Pressable>
  );
}

export function Redirect({ href }: { href: Href }) {
  React.useEffect(() => go(href, true), []);
  return null;
}

function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }} testID="not-found">
      <Text style={{ fontSize: 22, fontWeight: '700' }}>404</Text>
      <Pressable accessibilityRole="link" onPress={() => go('/', true)} style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, textDecorationLine: 'underline' }}>Home</Text>
      </Pressable>
    </View>
  );
}

/** The web app root: matches the URL, then renders root layout → (child layout) → lazy page. */
export function WebRoot() {
  const l = useLoc();
  const match = useMemo(() => matchPath(PATTERNS, l.path), [l.path]);
  const params = useMemo(() => ({ ...parseQuery(l.search), ...(match?.params ?? {}) }), [l.search, match]);
  let content: ReactNode = <NotFound />;
  if (match) {
    const route = ROUTES.find((r) => r.path === match.pattern)!;
    const Page = pageFor(route.path);
    content = <Page key={l.key} />;
    if (route.layout) {
      const Layout = layoutFor(route.layout);
      content = (
        <OutletContext.Provider value={content}>
          <Layout />
        </OutletContext.Provider>
      );
    }
  }
  return (
    <ParamsContext.Provider value={params}>
      <OutletContext.Provider value={<Suspense fallback={null}>{content}</Suspense>}>
        <RootLayout />
      </OutletContext.Provider>
    </ParamsContext.Provider>
  );
}
