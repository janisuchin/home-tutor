/** Renders the mascot icon (public/icon.svg, drawn in code) to PNG app icons. Run once: npx tsx scripts/make-icons.ts */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const svg = readFileSync(join(root, 'public', 'icon.svg'), 'utf8');
const targets: [string, number, boolean][] = [
  ['public/icon-192.png', 192, false],
  ['public/icon-512.png', 512, false],
  ['public/icon-maskable-512.png', 512, true],
  ['assets/icon.png', 1024, false],
  ['assets/favicon.png', 48, false],
  ['assets/splash-icon.png', 512, false],
  ['assets/android-icon-foreground.png', 512, true],
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, padded] of targets) {
    await page.setViewportSize({ width: size, height: size });
    const pad = padded ? size * 0.12 : 0;
    await page.setContent(
      `<html><body style="margin:0;background:${padded ? '#FFF1DE' : 'transparent'}"><div style="padding:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body></html>`,
    );
    await page.screenshot({ path: join(root, file), omitBackground: !padded });
    console.log('wrote', file);
  }
  await browser.close();
})();
