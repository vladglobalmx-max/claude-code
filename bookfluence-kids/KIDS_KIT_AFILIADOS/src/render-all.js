const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const OUT = path.resolve('..');
const pieces = [
  { file: 'post01-emocional.html', out: 'KIDS_POST_01_EMOCIONAL.png', w: 1080, h: 1080 },
  { file: 'post02-practico.html', out: 'KIDS_POST_02_PRACTICO.png', w: 1080, h: 1080 },
  { file: 'post03-precio.html', out: 'KIDS_POST_03_PRECIO.png', w: 1080, h: 1080 },
  { file: 'story01-problema.html', out: 'KIDS_STORY_01_PROBLEMA.png', w: 1080, h: 1920 },
  { file: 'story02-solucion.html', out: 'KIDS_STORY_02_SOLUCION.png', w: 1080, h: 1920 },
  { file: 'story03-conversion.html', out: 'KIDS_STORY_03_CONVERSION.png', w: 1080, h: 1920 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const p of pieces) {
    const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2 });
    await page.goto('file://' + path.resolve('./' + p.file));
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, 'RAW_' + p.out) });
    await page.close();
    console.log('rendered', p.out);
  }
  await browser.close();
})();
