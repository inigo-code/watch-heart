// Renders Watch Heart's icons (a film reel with a heart at the hub) to PNG with headless Chrome.
// Usage (needs puppeteer-core and Chrome): node scripts/make-icons.mjs assets
import puppeteer from 'puppeteer-core';

const out = process.argv[2];
const GOLD = '#F2B84B';
const BG = '#0B0A0D';
const HEART = '#FF4D6D';

/** The reel, drawn in a 1024 box at `scale` (1 = fills the box): a solid disc with six holes and a hub cut out, the heart in the hub. */
let n = 0;
function reel(scale, color, heart) {
  const id = `cut${n++}`;
  const r = 400 * scale;
  const c = 512;
  const holes = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    return `<circle cx="${c + Math.cos(a) * r * 0.6}" cy="${c + Math.sin(a) * r * 0.6}" r="${r * 0.21}" fill="black"/>`;
  }).join("");
  const h = r * 0.3;
  const heartPath = `M ${c} ${c + h * 0.8}
    C ${c - h * 1.3} ${c - h * 0.05}, ${c - h * 0.78} ${c - h * 1.0}, ${c} ${c - h * 0.42}
    C ${c + h * 0.78} ${c - h * 1.0}, ${c + h * 1.3} ${c - h * 0.05}, ${c} ${c + h * 0.8} Z`;
  return `
    <defs><mask id="${id}"><rect width="1024" height="1024" fill="white"/>${holes}<circle cx="${c}" cy="${c}" r="${r * 0.3}" fill="black"/></mask></defs>
    <circle cx="${c}" cy="${c}" r="${r}" fill="${color}" mask="url(#${id})"/>
    <path d="${heartPath}" fill="${heart}"/>`;
}

const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`;

const files = {
  'icon.png': svg(reel(0.92, GOLD, HEART), BG),
  // Adaptive icons: the launcher crops to a circle or squircle, so keep the reel inside the middle 66%.
  'android-icon-foreground.png': svg(reel(0.58, GOLD, HEART)),
  'android-icon-background.png': svg('', BG),
  'android-icon-monochrome.png': svg(reel(0.58, '#FFFFFF', '#FFFFFF')),
  'splash-icon.png': svg(reel(0.9, GOLD, HEART)),
  'favicon.png': svg(reel(1.05, GOLD, HEART), BG),
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
for (const [name, markup] of Object.entries(files)) {
  const size = name === 'favicon.png' ? 48 : 1024;
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: `${out}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', name);
}
await browser.close();
