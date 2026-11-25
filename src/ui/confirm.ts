import { Alert, Platform } from 'react-native';

/** Cross-platform yes/no confirmation (browser confirm on web, native Alert on phones). */
export function confirmAsync(message: string, okLabel = 'OK', cancelLabel = 'Cancel'): Promise<boolean> {
  if (Platform.OS === 'web') {
    const w = typeof window !== 'undefined' ? (window as any) : undefined;
    return Promise.resolve(w?.confirm ? !!w.confirm(message) : true);
  }
  return new Promise((resolve) =>
    Alert.alert('Home Tutor', message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
