import { expect, test } from '@playwright/test';
import { enterPin, expectNoSeriousA11y, seed, tid } from './helpers';

// Live classroom (D-059): students vote and ask from their own devices with a join code.
// No sign-up, no names; the test ends the room so nothing is left behind.
test('@projector live class: students join with a code, vote and ask; the teacher sees it live', async ({ page, browser }) => {
  await seed(page, { mode: 'G', children: [{ name: 'Ana', birth: '2016-01' }, { name: 'Ben', birth: '2016-07' }] });
  await page.goto('/classroom');
  await enterPin(page);
  await tid(page, 'group-name').fill('Class 5');
  await tid(page, 'member-Ana').click();
  await tid(page, 'member-Ben').click();
  await tid(page, 'create-group').click();
  await tid(page, 'present').click();
  await tid(page, 'panel-live').click();
  await tid(page, 'live-start').click();
  const code = ((await tid(page, 'live-code').textContent()) ?? '').trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const student = await ctx.newPage();
  try {
    await student.goto('/join');
    await tid(student, 'join-code').fill(code.toLowerCase());
    await tid(student, 'join-submit').click();
    await expect(tid(student, 'live-no-poll')).toBeVisible();
    await expectNoSeriousA11y(student);

    await tid(page, 'live-poll-question').fill('Which planet is the biggest?');
    await tid(page, 'live-poll-options').fill('Mars, Jupiter, Earth');
    await tid(page, 'live-start-poll').click();

    await tid(student, 'live-vote-1').click();
    await expect(tid(student, 'live-voted')).toBeVisible();
    await expect(tid(page, 'live-voted-count')).toHaveText('1 votes', { timeout: 10_000 });
    await expect(tid(page, 'live-participants')).toContainText('1 devices');

    await tid(student, 'live-question').fill('Why does Jupiter have stripes?');
    await tid(student, 'live-send-question').click();
    await expect(tid(student, 'live-question-sent')).toBeVisible();
    await expect(page.getByTestId('live-host-question').locator('visible=true')).toContainText('Why does Jupiter have stripes?', { timeout: 10_000 });

    await tid(page, 'live-close-poll').click();
    await expect(student.getByText('Jupiter: 1').locator('visible=true')).toBeVisible({ timeout: 10_000 });
  } finally {
    await tid(page, 'live-end').click().catch(() => {});
    await ctx.close();
  }
  await expect(tid(page, 'live-start')).toBeVisible();
});
