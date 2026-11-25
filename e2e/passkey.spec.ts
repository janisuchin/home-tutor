import { expect, test } from '@playwright/test';
import { accountToken, deleteAccountByToken, enterPin, seed, signUp, testEmail, tid } from './helpers';

test('add a passkey, sign out, then sign in with the passkey', async ({ page }) => {
  // Chromium's virtual authenticator stands in for a phone's fingerprint or screen lock.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  let token: string | null = null;
  try {
    await seed(page);
    await page.goto('/account');
    await enterPin(page);
    await signUp(page, testEmail('pk'));
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    token = await accountToken(page);
    await tid(page, 'passkey-label').fill('Test phone');
    await tid(page, 'add-passkey').click();
    await expect(page.getByText(/Passkey added/).locator('visible=true')).toBeVisible();
    await expect(tid(page, 'passkey-item')).toContainText('Test phone');

    await page.getByRole('button', { name: 'Sign out' }).locator('visible=true').click();
    await tid(page, 'account-mode-login').click();
    await tid(page, 'passkey-login').click();
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    // A new session token was issued by the passkey sign-in.
    await expect.poll(() => accountToken(page)).not.toBe(token);
    const old = token;
    token = await accountToken(page);
    expect(token).toBeTruthy();
    await deleteAccountByToken(page, old); // also ends the first session (whole account goes)
    token = null;
  } finally {
    await deleteAccountByToken(page, token);
  }
});
