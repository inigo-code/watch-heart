// Makes the Google Play graphics in store/graphics from the real app screens in store/make/screens.
// Each picture is an HTML page drawn by headless Edge (or Chrome), saved as a 24-bit PNG with no alpha.
//
//   node store/make/compose.mjs            all of them
//   node store/make/compose.mjs 03 feature only these
//
// Screens are 1080 × 2400 emulator captures (see README.md in this folder for how to take them).

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const out = join(app, 'store', 'graphics');
const fontDir = join(app, 'node_modules', '@expo-google-fonts');
const url = (p) => pathToFileURL(p).href;

const FONTS = {
  bebas: url(join(fontDir, 'bebas-neue', '400Regular', 'BebasNeue_400Regular.ttf')),
  mono: url(join(fontDir, 'courier-prime', '400Regular', 'CourierPrime_400Regular.ttf')),
  monoBold: url(join(fontDir, 'courier-prime', '700Bold', 'CourierPrime_700Bold.ttf')),
};
const ICON = url(join(app, 'assets', 'icon.png'));
const screen = (name) => url(join(here, 'screens', `${name}.png`));

// The phone screenshots, in store order: the screen (or two, side by side) and the caption.
export const SHOTS = [
  { file: '01', screens: ['diary'], title: ['Every viewing,', 'a ticket'], line: 'Films, series and anime with half stars, hearts, reviews and rewatches.' },
  { file: '02', screens: ['home'], title: ['Your week', 'at a glance'], line: 'This week day by day, what to carry on with, and picks from what you loved.' },
  { file: '03', screens: ['title', 'title-more'], title: ['Everything', 'about a title'], line: 'IMDb, Rotten Tomatoes and Metacritic scores, cast, and where to stream it.' },
  { file: '04', screens: ['episodes', 'episodes-list'], title: ['Episode by', 'episode'], line: 'Tick them off on any day: today, yesterday, or one you don’t remember.' },
  { file: '05', screens: ['story'], title: ['Your month', 'as a story'], line: 'Three layouts and six palettes. Share it to Instagram or anywhere.' },
  { file: '06', screens: ['memory'], title: ['Keep the', 'memory'], line: 'Your photo from the night in a film frame, with filters and words.' },
  { file: '07', screens: ['discover'], title: ['Find your', 'next favourite'], line: 'Award winners, curated lists, and what’s on your streaming services.' },
  { file: '08', screens: ['pick'], title: ['Can’t decide?', 'Pick for me'], line: 'Spin your watchlist and let Watch Heart choose tonight’s watch.' },
];

const base = `
@font-face { font-family: Bebas; src: url('${FONTS.bebas}'); }
@font-face { font-family: Mono; src: url('${FONTS.mono}'); }
@font-face { font-family: Mono; font-weight: 700; src: url('${FONTS.monoBold}'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg: #0B0A0D; --ink: #F4EFE6; --muted: #B3ABBC; --gold: #F2B84B; }
html, body { background: var(--bg); overflow: hidden; }
body { position: relative; color: var(--ink); font-family: Mono, monospace; -webkit-font-smoothing: antialiased; }
.glow { position: absolute; inset: 0; background:
  radial-gradient(ellipse 70% 38% at 50% 0%, rgba(242,184,75,0.30), rgba(242,184,75,0) 70%),
  radial-gradient(ellipse 60% 40% at 50% 100%, rgba(242,184,75,0.10), rgba(242,184,75,0) 70%); }
/* Film-strip edges with sprocket holes. */
.strip { position: absolute; top: 0; bottom: 0; width: 46px; background: #141117; }
.strip::before { content: ''; position: absolute; left: 13px; right: 13px; top: 20px; bottom: 0;
  background: repeating-linear-gradient(to bottom, var(--bg) 0 30px, transparent 30px 64px); }
.strip.l { left: 0; border-right: 2px solid #221E27; } .strip.r { right: 0; border-left: 2px solid #221E27; }
/* A ticket stub with a dashed edge. */
.stub { display: inline-flex; align-items: center; gap: 14px; height: 64px; padding: 0 24px 0 12px; border: 2px dashed rgba(242,184,75,0.55);
  border-radius: 14px; background: rgba(242,184,75,0.08); position: relative; }
.stub img { width: 44px; height: 44px; border-radius: 10px; }
.stub b { font-family: Bebas; font-weight: 400; font-size: 40px; letter-spacing: 2px; line-height: 1; padding-top: 4px; }
.stub b i { font-style: normal; color: var(--gold); }
h1 { font-family: Bebas; font-weight: 400; text-transform: uppercase; line-height: 0.9; letter-spacing: 1px; }
h1 .a { color: var(--ink); } h1 .b { color: var(--gold); display: block; }
.phone { position: absolute; background: #050407; border: 3px solid #34303C; box-shadow: 0 0 0 10px #17151B, 0 40px 120px rgba(0,0,0,0.7), 0 0 90px rgba(242,184,75,0.10); overflow: hidden; }
.phone .scr { position: absolute; overflow: hidden; background: var(--bg); }
.phone .scr img { display: block; width: 100%; }
`;

function shotPage(s) {
  const pair = s.screens.length === 2;
  const phones = pair
    ? `<div class="phone a"><div class="scr"><img src="${screen(s.screens[0])}"></div></div>
<div class="phone b"><div class="scr"><img src="${screen(s.screens[1])}"></div></div>`
    : `<div class="phone one"><div class="scr"><img src="${screen(s.screens[0])}"></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body { width: 1080px; height: 1920px; }
.head { position: absolute; left: 70px; right: 70px; top: 86px; text-align: center; }
h1 { font-size: 150px; margin-top: 46px; }
p { margin: 34px auto 0; max-width: 860px; font-size: 37px; line-height: 1.32; color: var(--muted); }
.phone.one { left: 140px; width: 800px; top: 690px; height: 1800px; border-radius: 76px; }
.phone.one .scr { inset: 14px; border-radius: 62px; }
.phone.a, .phone.b { width: 520px; height: 1160px; border-radius: 52px; }
.phone.a .scr, .phone.b .scr { inset: 10px; border-radius: 42px; }
.phone.a { left: 64px; top: 690px; } .phone.b { left: 496px; top: 790px; }
</style></head><body>
<div class="glow"></div><div class="strip l"></div><div class="strip r"></div>
<div class="head">
  <div class="stub"><img src="${ICON}"><b>WATCH <i>HEART</i></b></div>
  <h1><span class="a">${s.title[0]}</span><span class="b">${s.title[1]}</span></h1>
  <p>${s.line}</p>
</div>
${phones}
</body></html>`;
}

function featurePage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body { width: 1024px; height: 500px; }
.glow { background: radial-gradient(ellipse 55% 80% at 78% 30%, rgba(242,184,75,0.26), rgba(242,184,75,0) 70%), radial-gradient(ellipse 50% 60% at 10% 100%, rgba(242,184,75,0.08), rgba(242,184,75,0) 70%); }
.left { position: absolute; left: 60px; top: 0; bottom: 0; width: 480px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 18px; }
.brand img { width: 74px; height: 74px; border-radius: 17px; }
.brand b { white-space: nowrap; font-family: Bebas; font-weight: 400; font-size: 76px; letter-spacing: 3px; line-height: 1; padding-top: 8px; }
.brand b i { font-style: normal; color: var(--gold); }
h1 { font-size: 46px; color: var(--gold); margin-top: 22px; letter-spacing: 2px; }
p { margin-top: 14px; font-size: 21px; line-height: 1.4; color: var(--muted); }
.phone { width: 236px; height: 524px; border-radius: 30px; box-shadow: 0 0 0 6px #17151B, 0 24px 60px rgba(0,0,0,0.7); }
.phone .scr { inset: 7px; border-radius: 24px; }
.p1 { left: 560px; top: 70px; } .p2 { left: 770px; top: 26px; }
</style></head><body>
<div class="glow"></div>
<div class="left">
  <div class="brand"><img src="${ICON}"><b>WATCH <i>HEART</i></b></div>
  <h1>EVERY VIEWING, A TICKET.</h1>
  <p>A diary for films, series and anime. Rate, review, track episodes and share your month as a story.</p>
</div>
<div class="phone p1"><div class="scr"><img src="${screen('diary')}"></div></div>
<div class="phone p2"><div class="scr"><img src="${screen('home')}"></div></div>
</body></html>`;
}

// ---- Headless browser over the DevTools protocol (Node's own WebSocket, no packages) ----------------

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

async function browser() {
  const exe = BROWSERS.find(existsSync);
  if (!exe) throw new Error('Needs Edge or Chrome');
  const profile = mkdtempSync(join(tmpdir(), 'wh-store-'));
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mine = ++id;
      waiting.set(mine, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id: mine, method, params }));
    });
  await send('Page.enable');
  return {
    send,
    close() {
      ws.close();
      proc.kill();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500);
    },
  };
}

async function render(b, html, width, height, file) {
  const page = join(tmpdir(), `wh-store-${process.pid}.html`);
  writeFileSync(page, html);
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: url(page) });
  // Wait for the fonts and every picture.
  const ready = `Promise.all([document.fonts.ready, ...[...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))])
    .then(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src))`;
  let broken = [];
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      broken = (await b.send('Runtime.evaluate', { expression: ready, awaitPromise: true, returnByValue: true })).result.value;
      if (Array.isArray(broken)) break;
    } catch {}
  }
  if (broken?.length) throw new Error(`Missing pictures: ${broken.join(', ')}`);
  const { data } = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  // Play wants 24-bit PNG with no alpha: drop the alpha channel.
  const png = PNG.sync.read(Buffer.from(data, 'base64'));
  writeFileSync(file, PNG.sync.write(png, { colorType: 2, inputHasAlpha: true }));
  rmSync(page, { force: true });
  console.log(`${file.slice(app.length + 1)}  ${png.width}×${png.height}`);
}

const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);
const b = await browser();
try {
  for (const s of SHOTS) {
    if (want(s.file)) await render(b, shotPage(s), 1080, 1920, join(out, 'screenshots', `${s.file}.png`));
  }
  if (want('feature')) await render(b, featurePage(), 1024, 500, join(out, 'feature-graphic.png'));
  if (only.includes('icon')) {
    // The 512 icon is the app icon, scaled down. Only on request (`node compose.mjs icon`): it changes only with the logo.
    await render(b, `<!doctype html><style>*{margin:0}body{background:#0B0A0D}img{display:block;width:512px;height:512px}</style><img src="${ICON}">`, 512, 512, join(out, 'icon-512.png'));
  }
} finally {
  b.close();
}
