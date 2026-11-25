import { expect, test } from '@playwright/test';
import { accountToken, deleteAccountByToken, enterPin, seed, signUp, testEmail, tid } from './helpers';

// Every test that signs up deletes its account at the end (also when it fails), so a run against
// the live URL leaves nothing behind.

test('sign up, sync, share a Progress Key, revoke it, then delete the account', async ({ page, browser }) => {
  let token: string | null = null;
  try {
    await seed(page);
    await page.goto('/account');
    await enterPin(page);
    await signUp(page, testEmail('parent'));
    await expect(tid(page, 'recovery-key')).toBeVisible();
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    token = await accountToken(page);

    await page.goto('/parent/keys/child-0');
    await enterPin(page).catch(() => {});
    await tid(page, 'create-key').click();
    const codeText = (await tid(page, 'key-code').textContent())!;
    expect(codeText).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Someone else (a new tutor) opens the read-only passport.
    const other = await browser.newContext();
    const tutor = await other.newPage();
    await tutor.goto('/passport/open');
    await tid(tutor, 'key-input').fill(codeText);
    await tid(tutor, 'open-key-submit').click();
    await expect(tid(tutor, 'passport-view')).toBeVisible();
    await expect(tutor.getByText('Learning Passport: Asha').locator('visible=true')).toBeVisible();

    await tid(page, 'revoke-key').click();
    await expect(page.getByText('Revoked').locator('visible=true')).toBeVisible();
    await tutor.reload();
    await expect(tutor.getByText('This key does not work').locator('visible=true')).toBeVisible();
    await other.close();

    // Delete my account from the account screen (the real button and confirm dialog).
    await page.goto('/account');
    await enterPin(page).catch(() => {});
    page.once('dialog', (d) => d.accept());
    await tid(page, 'delete-account').click();
    await expect(tid(page, 'welcome')).toBeVisible();
    const res = await page.request.post('/api/sync', { headers: { authorization: `Bearer ${token}` }, data: { cursor: 0, changes: [] } });
    expect(res.status()).toBe(401);
    token = null;
  } finally {
    await deleteAccountByToken(page, token);
  }
});

test('a second device signs in and receives the family', async ({ page, browser }) => {
  const email = testEmail('two');
  let token: string | null = null;
  try {
    await seed(page, { children: [{ name: 'Kabir', birth: '2016-06' }] });
    await page.goto('/account');
    await enterPin(page);
    await signUp(page, email);
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    token = await accountToken(page);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto('/account');
    await tid(p2, 'account-mode-login').click();
    await tid(p2, 'email').fill(email);
    await tid(p2, 'password').fill('our family learns together');
    await tid(p2, 'account-submit').click();
    await expect(p2.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    await p2.goto('/');
    await expect(tid(p2, 'child-Kabir')).toBeVisible();
    await ctx.close();
  } finally {
    await deleteAccountByToken(page, token);
  }
});
