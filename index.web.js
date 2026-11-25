// Web: a small router shim (src/nav/expo-router.web.tsx) instead of Expo Router's runtime, for a
// much smaller first download. metro.config.js maps `expo-router` to the shim on web.
import { registerRootComponent } from 'expo';
import { WebRoot } from './src/nav/expo-router.web';

registerRootComponent(WebRoot);
