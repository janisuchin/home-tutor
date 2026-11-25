import { expect, test } from '@playwright/test';
import { enterPin, seed, tid } from './helpers';

test('sign up, sync, share a Progress Key, then revoke it', async ({ page, browser }) => {
  await seed(page);
  await page.goto('/account');
  await enterPin(page);
  await tid(page, 'account-mode-signup').click();
  await tid(page, 'email').fill(`parent-${Date.now()}-${Math.random().toString(36).slice(2)}@example.org`);
  await tid(page, 'password').fill('our family learns together');
  await tid(page, 'account-consent').click();
  await tid(page, 'account-submit').click();
  await expect(tid(page, 'recovery-key')).toBeVisible();
  await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();

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
});

test('a second device signs in and receives the family', async ({ page, browser }) => {
  const email = `two-${Date.now()}-${Math.random().toString(36).slice(2)}@example.org`;
  await seed(page, { children: [{ name: 'Kabir', birth: '2016-06' }] });
  await page.goto('/account');
  await enterPin(page);
  await tid(page, 'account-mode-signup').click();
  await tid(page, 'email').fill(email);
  await tid(page, 'password').fill('our family learns together');
  await tid(page, 'account-consent').click();
  await tid(page, 'account-submit').click();
  await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();

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
});
