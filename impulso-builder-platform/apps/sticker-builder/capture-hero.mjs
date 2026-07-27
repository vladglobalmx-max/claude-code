import { chromium } from '@playwright/test';

const DIR = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/hero/sources';
const OUT = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/hero/final';

const jobs = [
  ['hero-desktop-light', 1920, 1080],
  ['hero-desktop-dark', 1920, 1080],
  ['hero-cover-no-buttons', 1920, 1080],
  ['hero-gumroad', 1280, 720],
  ['hero-vertical-social', 1080, 1350],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });

for (const [name, w, h] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(`file://${DIR}/${name}.html`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  console.log('captured', name);
}

await browser.close();
