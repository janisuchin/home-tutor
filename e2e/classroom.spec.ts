import { expect, test } from '@playwright/test';
import { accountToken, deleteAccountByToken, enterPin, expectNoSeriousA11y, seed, signUp, testEmail, tid } from './helpers';

test('@projector classroom: group, attendance, shared lesson, presentation, poll and questions', async ({ page }) => {
  await seed(page, {
    mode: 'G',
    children: [
      { name: 'Ana', birth: '2016-01', interests: ['animals'] },
      { name: 'Ben', birth: '2016-07', interests: ['animals', 'space'] },
      { name: 'Chen', birth: '2015-09', interests: ['space'] },
    ],
  });
  await page.goto('/classroom');
  await enterPin(page);
  await tid(page, 'group-name').fill('Class 4');
  await tid(page, 'member-Ana').click();
  await tid(page, 'member-Ben').click();
  await tid(page, 'member-Chen').click();
  await tid(page, 'create-group').click();
  await tid(page, 'present-Ana').click();
  await tid(page, 'present-Ben').click();
  await expect(page.getByText('2 of 3 present').locator('visible=true')).toBeVisible();
  await page.locator('[data-testid^="assign-"]').locator('visible=true').first().click();

  await tid(page, 'present').click();
  await expect(tid(page, 'present-lesson')).toBeVisible();
  const before = await tid(page, 'present-step').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(tid(page, 'present-step')).not.toHaveText(before!);
  await tid(page, 'mark-done').click();
  await expect(page.getByText('Saved for everyone present').locator('visible=true')).toBeVisible();

  await tid(page, 'panel-poll').click();
  await tid(page, 'poll-question').fill('Which animal sleeps standing up?');
  await tid(page, 'poll-options').fill('Horse, Cat, Fish');
  await tid(page, 'start-poll').click();
  await tid(page, 'vote-0').click();
  await tid(page, 'vote-0').click();
  await expect(page.getByText('2 votes').locator('visible=true')).toBeVisible();

  await tid(page, 'panel-questions').click();
  await tid(page, 'class-question').fill('Why is the sky blue?');
  await tid(page, 'add-question').click();
  await expect(page.getByText('Why is the sky blue?').locator('visible=true')).toBeVisible();

  // Printable class report: attendance and the shared lesson marked done for those present.
  await page.goto('/classroom');
  await enterPin(page).catch(() => {});
  await tid(page, 'class-report').click();
  await expect(tid(page, 'class-report')).toBeVisible();
  await expect(tid(page, 'report-sessions')).toHaveText('Sessions with attendance: 1');
  await expect(tid(page, 'report-row-Ana')).toContainText('1/1');
  await expect(tid(page, 'report-row-Chen')).toContainText('0/1');
  await expect(tid(page, 'print-report')).toBeVisible();
  await expectNoSeriousA11y(page);
});

test('attendance syncs to the cloud as records', async ({ page }) => {
  let token: string | null = null;
  try {
    await seed(page, { mode: 'G', children: [{ name: 'Ana', birth: '2016-01' }, { name: 'Ben', birth: '2016-07' }] });
    await page.goto('/classroom');
    await enterPin(page);
    await tid(page, 'group-name').fill('Class 5');
    await tid(page, 'member-Ana').click();
    await tid(page, 'member-Ben').click();
    await tid(page, 'create-group').click();
    await tid(page, 'present-Ben').click();
    await page.goto('/account');
    await enterPin(page).catch(() => {});
    await signUp(page, testEmail('class'));
    await expect(page.getByText('All saved in the cloud.').locator('visible=true')).toBeVisible();
    token = await accountToken(page);
    const r = await page.request.post('/api/sync', { headers: { authorization: `Bearer ${token}` }, data: { cursor: 0, changes: [] } });
    const att = (await r.json()).changes.filter((c: any) => c.kind === 'attendance');
    expect(att).toHaveLength(1);
    expect(att[0].data.childIds).toEqual(['child-1']);
  } finally {
    await deleteAccountByToken(page, token);
  }
});

test('tutor dashboard shows recommendations and group compatibility', async ({ page }) => {
  await seed(page, { children: [{ name: 'Lila', birth: '2017-02', interests: ['cooking'] }, { name: 'Omar', birth: '2016-11', interests: ['cooking'] }] });
  await page.goto('/tutor');
  await enterPin(page);
  await expect(tid(page, 'tutor')).toBeVisible();
  await expect(page.getByText(/Group compatibility/).locator('visible=true')).toBeVisible();
  await expect(page.getByText(/shows strong interest in cooking/).locator('visible=true').first()).toBeVisible();
});
