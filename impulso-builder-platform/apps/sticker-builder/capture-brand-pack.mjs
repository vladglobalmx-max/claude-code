import { chromium } from '@playwright/test';

const DIR = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/brand-pack/exports';

const jobs = [
  ['logo-lockup-light', 1600, 480, 2],
  ['logo-lockup-dark', 1600, 480, 2],
  ['logo-lockup-transparent', 1600, 480, 2],
  ['logo-symbol-only', 900, 900, 2],
  ['logo-wordmark-only', 1400, 320, 2],
  ['logo-versions-permitted', 1600, 900, 2],
  ['logo-clearspace', 1400, 700, 2],
  ['color-palette', 1500, 780, 2],
  ['typography-specimen', 1500, 1000, 2],
  ['iconography', 1500, 620, 2],
  ['favicon-16', 16, 16, 8],
  ['favicon-32', 32, 32, 8],
  ['favicon-64', 64, 64, 4],
  ['favicon-128', 128, 128, 4],
  ['favicon-sheet', 900, 360, 2],
  ['background-light', 1600, 900, 1.5],
  ['background-dark', 1600, 900, 1.5],
  ['hero-background', 1920, 1080, 1.5],
  ['components-buttons', 1400, 620, 2],
  ['components-cards-fields-dialogs', 1500, 700, 2],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });

for (const [name, w, h, scale] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.goto(`file://${DIR}/${name}.html`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${DIR}/${name}.png`, omitBackground: true });
  await page.close();
  console.log('captured', name);
}

await browser.close();
