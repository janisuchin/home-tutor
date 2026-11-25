import { Platform } from 'react-native';

/** Save JSON as a file (web). Native builds will use the share sheet in a later round. */
export function downloadJson(name: string, data: unknown) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
