import { expect, test } from '@playwright/test';
import { seed, tid } from './helpers';

test('web router: links, the back button, browser back/forward, deep links and 404', async ({ page }) => {
  await page.goto('/');
  await expect(tid(page, 'welcome')).toBeVisible();
  await page.getByRole('button', { name: 'Privacy' }).locator('visible=true').first().click();
  await expect(tid(page, 'privacy')).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goBack();
  await expect(tid(page, 'welcome')).toBeVisible();
  await page.goForward();
  await expect(tid(page, 'privacy')).toBeVisible();
  // The in-app back arrow goes back in history.
  await page.getByRole('button', { name: 'Back' }).locator('visible=true').first().click();
  await expect(tid(page, 'welcome')).toBeVisible();
  // Deep link with dynamic segments and a query string.
  await seed(page);
  await page.goto('/learn/child-0/item/life-fix-puncture?from=test');
  await expect(tid(page, 'item')).toBeVisible();
  // This screen's back arrow goes to the child's home.
  await page.getByRole('button', { name: 'Back' }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/learn\/child-0$/);
  await page.goto('/no/such/page');
  await expect(tid(page, 'not-found')).toBeVisible();
});
