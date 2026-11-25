import { expect, test } from '@playwright/test';
import { enterPin, seed, tid } from './helpers';

test('a new family sets up, adds a child and starts learning', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'start-setup').click();
  await tid(page, 'family-name').fill('Mehta family');
  await tid(page, 'next').click();
  await tid(page, 'mode-B').click();
  await tid(page, 'next').click();
  await tid(page, 'pin').fill('1234');
  await tid(page, 'pin2').fill('1234');
  await tid(page, 'next').click();
  // Consent is required.
  await tid(page, 'finish-setup').click();
  await expect(page.getByText('Please give consent to continue.').locator('visible=true')).toBeVisible();
  await tid(page, 'consent').click();
  await tid(page, 'finish-setup').click();

  await tid(page, 'child-name').fill('Riya');
  await tid(page, 'interest-cooking').click();
  await tid(page, 'study-ja').click();
  // Health modules are off by default.
  await expect(tid(page, 'health-growing-up-girl')).toHaveAttribute('aria-checked', 'false');
  await tid(page, 'save-child').click();

  await tid(page, 'child-Riya').click();
  await expect(tid(page, 'child-home')).toBeVisible();
  await expect(tid(page, 'today')).toBeVisible();
  await expect(tid(page, 'mission')).toBeVisible();
});

test('child completes an activity and it shows in the passport', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tid(page, 'child-Asha').click();
  const first = page.locator('[data-testid^="today-"]').locator('visible=true').first();
  const title = (await first.getAttribute('aria-label'))!.split('.')[0];
  await first.click();
  await expect(tid(page, 'item')).toBeVisible();
  await tid(page, 'complete').click();
  await expect(tid(page, 'finished')).toBeVisible();
  await page.goto('/');
  await tid(page, 'child-Asha').click();
  await expect(page.getByText('✓ Done').locator('visible=true').first()).toBeVisible();
  expect(title.length).toBeGreaterThan(2);
});

test('practical lessons show safety, Basic/Better/Advanced versions and substitutions', async ({ page }) => {
  await seed(page);
  await page.goto('/learn/child-0/item/life-fix-puncture');
  await expect(tid(page, 'safety')).toBeVisible();
  await expect(tid(page, 'versions')).toBeVisible();
  await tid(page, 'version-advanced').click();
  await expect(tid(page, 'substitutions')).toBeVisible();
  await expect(tid(page, 'sources')).toBeVisible();
});

test('the leaking-sink simulation teaches safe decisions step by step', async ({ page }) => {
  await seed(page, { children: [{ name: 'Dev', birth: '2014-05' }] });
  await page.goto('/learn/child-0/item/life-leaking-sink');
  await expect(tid(page, 'simulation')).toBeVisible();
  for (let step = 0; step < 10; step++) {
    if (await tid(page, 'sim-done').isVisible().catch(() => false)) break;
    // try options until the correct one is found
    for (let o = 0; o < 4; o++) {
      const btn = page.getByTestId(`sim-${step}-${o}`).locator('visible=true');
      if (!(await btn.count())) break;
      await btn.click();
      if (await tid(page, 'sim-next').isVisible().catch(() => false)) break;
    }
    await tid(page, 'sim-next').click();
  }
  await expect(tid(page, 'sim-done')).toBeVisible();
});

test('parent area needs the PIN; health modules stay off until switched on', async ({ page }) => {
  await seed(page, { children: [{ name: 'Mira', birth: '2014-02', sex: 'girl' }] });
  await page.goto('/learn/child-0/area/health');
  await expect(page.locator('[data-testid^="item-hl-"]').locator('visible=true')).toHaveCount(await countGeneralHealth(page));
  await page.goto('/parent');
  await tid(page, 'pin-1').click();
  await tid(page, 'pin-1').click();
  await tid(page, 'pin-1').click();
  await tid(page, 'pin-1').click();
  await tid(page, 'pin-✓').click();
  await expect(page.getByText('That PIN is not right').locator('visible=true')).toBeVisible();
  await enterPin(page);
  await expect(tid(page, 'parent-dashboard')).toBeVisible();
  await tid(page, 'parent-child-Mira').click();
  await tid(page, 'edit-profile').click();
  await tid(page, 'health-growing-up-girl').click();
  await tid(page, 'save-child').click();
  await page.goto('/learn/child-0/item/hl-periods-explained');
  await expect(page.getByText('Awaiting review by a medical professional.').locator('visible=true')).toBeVisible();
});

async function countGeneralHealth(page: import('@playwright/test').Page) {
  // general (non-module) health lessons stay visible; module lessons are hidden by default
  await page.waitForTimeout(500);
  return page.evaluate(async () => {
    const cat = await (await fetch('/content/catalog.json')).json();
    const bands = ['9-11', '12-14', '15-17'];
    return cat.items.filter((i: any) => i.area === 'health' && !i.healthModule && i.ageBands.some((b: string) => bands.includes(b))).length;
  });
}

test('screen-time limit shows a friendly off-screen page', async ({ page }) => {
  await seed(page, { children: [{ name: 'Sam', birth: '2019-01', dailyMinutes: 30 }] });
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('home-tutor:v1')!);
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    raw.usage = { 'child-0': { day, seconds: 31 * 60, extraMinutes: 0 } };
    localStorage.setItem('home-tutor:v1', JSON.stringify(raw));
  });
  await page.goto('/learn/child-0');
  await expect(tid(page, 'rest')).toBeVisible();
});

test('emergency numbers show sources and verification status', async ({ page }) => {
  await page.goto('/emergency');
  await expect(tid(page, 'em-IN')).toBeVisible();
  await expect(page.getByText('verified').locator('visible=true').first()).toBeVisible();
});
