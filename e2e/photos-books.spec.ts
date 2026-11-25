import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterPin, expectNoSeriousA11y, seed, tid } from './helpers';

const root = join(__dirname, '..');
const photos: any[] = JSON.parse(readFileSync(join(root, 'content', 'photos.json'), 'utf8'));
const items = new Map<string, any>();
for (const f of ['core-academics', 'nature-animals', 'arts-creativity', 'languages', 'civics-social', 'environment', 'life-skills', 'careers', 'special-interests', 'projects', 'technology-ai', 'physical-education', 'financial-literacy'])
  for (const i of JSON.parse(readFileSync(join(root, 'content', 'areas', `${f}.json`), 'utf8')).items) items.set(i.id, i);
const books: any[] = JSON.parse(readFileSync(join(root, 'content', 'books.json'), 'utf8'));

test('a lesson shows its real photo, self-hosted and lazy, with the credit on tap; the Credits page lists every photo', async ({ page }) => {
  const photo = photos.find((p) => p.links.some((l: string) => items.get(l)?.ageBands.includes('6-8') && !items.get(l)?.healthModule));
  test.skip(!photo, 'no photo linked to a 6-8 item yet');
  const itemId = photo.links.find((l: string) => items.get(l)?.ageBands.includes('6-8'));
  const thirdParty: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (r.resourceType() === 'image' && u.host !== new URL(page.url() || 'http://localhost').host && !u.protocol.startsWith('data')) thirdParty.push(r.url());
  });
  await seed(page);
  await page.goto(`/learn/child-0/item/${itemId}`);
  const shown = page.locator('[data-testid^="photo-"] img').first();
  await expect(shown).toBeVisible();
  await expect(shown).toHaveAttribute('loading', 'lazy');
  expect(await shown.getAttribute('alt')).toBeTruthy();
  expect(await shown.getAttribute('src')).toMatch(/^\/photos\/[a-z0-9-]+\.webp$/);
  await page.locator('[data-testid^="photo-credit-"]').locator('visible=true').first().click();
  await expect(page.locator('[data-testid^="photo-credit-text-"]').locator('visible=true').first()).toContainText(/Photo: .+, by .+, (CC|Public domain)/);
  await expectNoSeriousA11y(page);
  expect(thirdParty).toEqual([]); // never hotlinked

  await page.goto('/credits');
  await expect(tid(page, 'credits')).toBeVisible();
  await expect(page.locator('[data-testid^="credit-"]')).toHaveCount(photos.length);
});

test('books: suggestions for the child, mark one read (it reaches the passport), parent hides a book', async ({ page }) => {
  test.skip(books.length === 0, 'no books yet');
  await seed(page, { children: [{ name: 'Asha', birth: '2018-03', interests: ['animals'] }] });
  await page.goto('/learn/child-0');
  await tid(page, 'open-books').click();
  await expect(tid(page, 'books-suggested')).toBeVisible();
  const first = page.locator('[data-testid^="suggested-"]').locator('visible=true').first();
  const id = ((await first.getAttribute('data-testid')) ?? '').replace('suggested-', '');
  const title = books.find((b) => b.id === id).title;
  await tid(page, `read-${id}`).click();
  await expect(page.locator(`[data-testid="suggested-${id}"]`).locator('visible=true')).toHaveCount(0);
  await expectNoSeriousA11y(page);
  await page.goto('/learn/child-0/passport');
  await expect(page.getByText(title, { exact: false }).locator('visible=true').first()).toBeVisible();

  await page.goto('/parent/books');
  await enterPin(page);
  const band = books.find((b) => b.band === '6-8');
  await tid(page, `hide-${band.id}`).click();
  await expect(tid(page, `hide-${band.id}`)).toHaveAttribute('aria-checked', 'true');
  await page.goto('/learn/child-0/books');
  await expect(page.locator(`[data-testid="book-${band.id}"]`)).toHaveCount(0);
});
