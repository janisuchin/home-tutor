import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { noHorizontalScroll, seed, tid } from './helpers';

const PAGES = [
  { path: '/', id: 'picker' },
  { path: '/learn/child-0', id: 'child-home' },
  { path: '/learn/child-0/explore', id: 'explore-screen' },
  { path: '/learn/child-0/item/life-fix-puncture', id: 'item' },
  { path: '/learn/child-0/skills', id: 'skills-screen' },
  { path: '/privacy', id: 'privacy' },
];

test.describe('@layout responsive layout and accessibility', () => {
  for (const p of PAGES) {
    test(`${p.path} fits the screen and has no serious accessibility violations`, async ({ page }, info) => {
      await seed(page, { children: [{ name: 'Asha', birth: '2016-03', interests: ['horses', 'bicycles'] }] });
      await page.goto(p.path);
      await expect(tid(page, p.id)).toBeVisible();
      await page.waitForTimeout(400);
      expect(await noHorizontalScroll(page)).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        // RN Web renders scroll containers without a focusable wrapper; content inside is reachable.
        .disableRules(['scrollable-region-focusable'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`)).toEqual([]);
      await page.screenshot({ path: `test-results/screens/${info.project.name}${p.path.replace(/\//g, '_') || '_home'}.png` });
    });
  }

  test('welcome screen works without a mouse (keyboard only)', async ({ page }) => {
    await page.goto('/');
    await expect(tid(page, 'welcome')).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent);
      if (label?.includes('Start as a family')) break;
    }
    await page.keyboard.press('Enter');
    await expect(tid(page, 'setup')).toBeVisible();
  });
});

test('@layout the app is installable and works offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium');
  await seed(page);
  await page.goto('/');
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.name).toBe('Home Tutor');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => setTimeout(r, 1000));
    return !!reg.active;
  });
  await tid(page, 'child-Asha').click();
  await expect(tid(page, 'child-home')).toBeVisible();
  await context.setOffline(true);
  await page.goto('/');
  await expect(tid(page, 'picker')).toBeVisible();
  await tid(page, 'child-Asha').click();
  await expect(tid(page, 'today')).toBeVisible();
  await context.setOffline(false);
});
