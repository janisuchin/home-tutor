import { expect, test } from '@playwright/test';
import { enterPin, seed, tid } from './helpers';

test.describe('a device set to Hindi (India)', () => {
  test.use({ locale: 'hi-IN' });

  test('set-up follows the device locale: Hindi UI and India preselected', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('परिवार के रूप में शुरू करें').locator('visible=true')).toBeVisible();
    await tid(page, 'start-setup').click();
    await expect(tid(page, 'setup-language-hi')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('checkbox', { name: '🇮🇳 India' }).locator('visible=true')).toHaveAttribute('aria-checked', 'true');
    // The family can switch to English during set-up.
    await tid(page, 'setup-language-en').click();
    await expect(page.getByText('Set up your family').locator('visible=true')).toBeVisible();
  });
});

test.describe('a device set to English (UK)', () => {
  test.use({ locale: 'en-GB' });
  test('the Hindi UI can be chosen in Family settings, and the country changed', async ({ page }) => {
    await seed(page);
    await page.goto('/parent/settings');
    await enterPin(page);
    await tid(page, 'ui-language-hi').click();
    await expect(page.getByText('परिवार की सेटिंग').locator('visible=true').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await tid(page, 'country-GB').click();
    await expect(tid(page, 'country-GB')).toHaveAttribute('aria-checked', 'true');
    await tid(page, 'ui-language-en').click();
    await expect(page.getByText('Family settings').locator('visible=true').first()).toBeVisible();
  });
});

test.describe('a device set to Gujarati (India)', () => {
  test.use({ locale: 'gu-IN' });
  test('set-up follows the device locale: Gujarati UI (lazy chunk), and it can be chosen in settings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('પરિવાર તરીકે શરૂ કરો').locator('visible=true')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'gu');
    await tid(page, 'start-setup').click();
    await expect(tid(page, 'setup-language-gu')).toHaveAttribute('aria-checked', 'true');
  });
  test('Gujarati in Family settings', async ({ page }) => {
    await seed(page);
    await page.goto('/parent/settings');
    await enterPin(page);
    await tid(page, 'ui-language-gu').click();
    await expect(page.getByText('પરિવારનાં સેટિંગ').locator('visible=true').first()).toBeVisible();
    await tid(page, 'ui-language-en').click();
    await expect(page.getByText('Family settings').locator('visible=true').first()).toBeVisible();
  });
});
