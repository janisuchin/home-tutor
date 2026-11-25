import { expect, test } from '@playwright/test';
import { accountToken, deleteAccountByToken, enterPin, seed, signUp, testEmail, tid } from './helpers';

test('a parent invites a tutor, who sees only the shared child, logs a session, and is removed', async ({ page, browser }) => {
  let parentToken: string | null = null;
  let tutorToken: string | null = null;
  const ctx = await browser.newContext();
  const tutor = await ctx.newPage();
  try {
    await seed(page, { children: [{ name: 'Asha', birth: '2018-03' }, { name: 'Kabir', birth: '2015-06' }] });
    await page.goto('/account');
    await enterPin(page);
    await signUp(page, testEmail('tparent'));
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    parentToken = await accountToken(page);

    await page.goto('/parent/tutors');
    await enterPin(page).catch(() => {});
    await tid(page, 'tutor-label').fill('Maths tutor');
    await tid(page, 'share-Asha').click();
    await tid(page, 'create-invite').click();
    const code = (await tid(page, 'invite-code').textContent())!;
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // The tutor uses their own account on their own device.
    await tutor.goto('/');
    await tid(tutor, 'open-tutoring').click();
    await tid(tutor, 'tutoring-sign-in').click();
    await signUp(tutor, testEmail('tutor'));
    await expect(tid(tutor, 'recovery-key')).toBeVisible();
    tutorToken = await accountToken(tutor);
    await tid(tutor, 'account-tutoring').click();
    await tid(tutor, 'invite-input').fill(code);
    await tid(tutor, 'accept-invite').click();
    await expect(tid(tutor, 'tutored-Asha')).toBeVisible();
    await expect(tutor.getByTestId('tutored-Kabir')).toHaveCount(0);
    await tid(tutor, 'log-Asha-30').click();

    // The tutor's session reaches the parent's account, recorded as by the tutor.
    await expect
      .poll(async () => {
        const r = await page.request.post('/api/sync', { headers: { authorization: `Bearer ${parentToken}` }, data: { cursor: 0, changes: [] } });
        const body = await r.json();
        return body.changes.some((c: any) => c.kind === 'event' && c.data.by === 'tutor' && c.data.minutes === 30);
      })
      .toBe(true);

    await page.reload();
    await enterPin(page).catch(() => {});
    await expect(tid(page, 'tutor-status-Maths tutor')).toContainText('Joined');
    page.once('dialog', (d) => d.accept());
    await tid(page, 'remove-tutor-Maths tutor').click();
    await expect(page.getByTestId('tutor-link-Maths tutor')).toHaveCount(0);

    await tid(tutor, 'tutoring-sync').click();
    await expect(tutor.getByTestId('tutored-Asha')).toHaveCount(0);
    await expect(tutor.getByText('No families yet.').locator('visible=true')).toBeVisible();
  } finally {
    await deleteAccountByToken(page, parentToken);
    await deleteAccountByToken(tutor, tutorToken);
    await ctx.close();
  }
});
