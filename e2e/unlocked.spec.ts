import { expect, test } from '@playwright/test';
import { expectNoSeriousA11y, tid } from './helpers';

// Review edition (D-051), run against dist-unlocked or E2E_UNLOCKED_URL. No sign-ups here.

test('review edition: banner, no parent PIN, noindex and robots.txt', async ({ page, request }) => {
  await page.goto('/');
  await expect(tid(page, 'review-banner')).toContainText('Review edition - everything unlocked');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toMatch(/User-agent: \*\s+Disallow: \//);
  const health = await (await request.get('/api/health')).json();
  expect(health.edition).toBe('unlocked');
  // A ready-made review family; the parent area opens with no PIN.
  await expect(tid(page, 'child-Reviewer 4')).toBeVisible();
  await tid(page, 'parent-area').click();
  await expect(page.getByTestId('pin-gate')).toHaveCount(0);
  await expect(tid(page, 'review-banner')).toBeVisible();
});

test('review edition: browse everything with filters', async ({ page }) => {
  await page.goto('/review');
  await expect(tid(page, 'review-screen')).toBeVisible();
  const count = async () => Number(((await tid(page, 'browse-count').textContent()) ?? '0').split(' ')[0]);
  await expect.poll(count).toBeGreaterThan(400);
  const all = await count();
  await tid(page, 'browse-type-skill-tree').click();
  await expect.poll(count).toBeLessThan(all);
  await expect(page.getByTestId(/^entry-skill-tree-/).first()).toBeVisible();
  await tid(page, 'browse-type-all').click();
  await tid(page, 'browse-area-health').click();
  await tid(page, 'browse-rating-all').click();
  // Health and puberty pathways are visible for review.
  await expect(page.getByText(/health: growing-up-/).first()).toBeVisible();
  await tid(page, 'browse-area-all').click();
  await tid(page, 'browse-rating-red').click();
  await expect.poll(count).toBeGreaterThan(0);
  await tid(page, 'browse-band-3-5').click();
  const n = await count();
  expect(n).toBeLessThan(all);
  await expectNoSeriousA11y(page);
});

test('review edition: View as switches between ages and groups', async ({ page }) => {
  await page.goto('/review');
  await tid(page, 'viewas-age-4').click();
  await tid(page, 'viewas-group-girl').click();
  const summary = tid(page, 'viewas-summary');
  await expect(summary).toContainText('Girl, age 4');
  const items = async () => Number(((await summary.textContent()) ?? '').match(/: (\d+) items/)?.[1] ?? 0);
  const young = await items();
  await tid(page, 'viewas-age-16').click();
  await expect(summary).toContainText('Girl, age 16');
  expect(await items()).not.toBe(young);
  await expect(summary).toContainText('0 health items');
  await tid(page, 'viewas-health-on').click();
  await expect(summary).not.toContainText(' 0 health items');
  await tid(page, 'viewas-group-mixed').click();
  await expect(summary).toContainText('Mixed group, age 16');
  await expect(summary).toContainText('0 health items'); // never shared in a group
  await tid(page, 'viewas-group-boy').click();
  await tid(page, 'viewas-open').click();
  await expect(page).toHaveURL(/\/learn\/viewas-16-boy/);
});
