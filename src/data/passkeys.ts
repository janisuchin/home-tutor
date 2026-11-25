/**
 * Passkeys on the device (web only for now; native needs associated domains, see DECISIONS).
 * The WebAuthn helper library is loaded only when someone uses a passkey.
 */
import { Platform } from 'react-native';
import { api } from './api';

export function passkeysSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).PublicKeyCredential === 'function';
}

export async function addPasskey(token: string, label: string) {
  const { startRegistration } = await import('@simplewebauthn/browser');
  const { challengeId, options } = await api.passkeyRegisterOptions(token);
  const response = await startRegistration({ optionsJSON: options });
  return api.passkeyRegisterVerify(token, challengeId, response, label);
}

export async function signInWithPasskey() {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const { challengeId, options } = await api.passkeyLoginOptions();
  const response = await startAuthentication({ optionsJSON: options });
  return api.passkeyLoginVerify(challengeId, response);
}
