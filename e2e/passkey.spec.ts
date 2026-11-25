import { expect, test } from '@playwright/test';
import { accountToken, deleteAccountByToken, enterPin, expectNoSeriousA11y, seed, signUp, testEmail, tid } from './helpers';

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
    await expectNoSeriousA11y(page);

    await page.getByRole('button', { name: 'Sign out' }).locator('visible=true').click();
    await tid(page, 'account-mode-login').click();
    await tid(page, 'passkey-login').click();
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    // A new session token was issued by the passkey sign-in. Signing out ended the first session,
    // so the account must be deleted with the new one (round 2 used the old token, got 401 and
    // left the account, its session, records and passkey behind on the live site).
    await expect.poll(() => accountToken(page)).not.toBe(token);
    token = await accountToken(page);
    expect(token).toBeTruthy();
    const gone = await page.request.delete('/api/account', { headers: { authorization: `Bearer ${token}` } });
    expect(gone.status()).toBe(200);
    token = null;
    // Nothing is left: the passkey session is gone and so is the account.
    const after = await page.request.post('/api/sync', { headers: { authorization: `Bearer ${await accountToken(page)}` }, data: { cursor: 0, changes: [] } });
    expect(after.status()).toBe(401);
  } finally {
    await deleteAccountByToken(page, token);
  }
});
