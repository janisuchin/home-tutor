import { expect, test } from '@playwright/test';
import { enterPin, seed, tid } from './helpers';

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
});

test('tutor dashboard shows recommendations and group compatibility', async ({ page }) => {
  await seed(page, { children: [{ name: 'Lila', birth: '2017-02', interests: ['cooking'] }, { name: 'Omar', birth: '2016-11', interests: ['cooking'] }] });
  await page.goto('/tutor');
  await enterPin(page);
  await expect(tid(page, 'tutor')).toBeVisible();
  await expect(page.getByText(/Group compatibility/).locator('visible=true')).toBeVisible();
  await expect(page.getByText(/shows strong interest in cooking/).locator('visible=true').first()).toBeVisible();
});
