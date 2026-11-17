// Makes the social posts in store/social (the Play Store launch) from the real app screens in store/make/screens,
// in the same look as the store graphics (compose.mjs). Run: node store/make/social.mjs
// Each picture is an HTML page drawn by headless Edge (or Chrome), saved as a 24-bit PNG with no alpha.
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
const out = join(app, 'store', 'social');
const fontDir = join(app, 'node_modules', '@expo-google-fonts');
const url = (p) => pathToFileURL(p).href;

const FONTS = {
  bebas: url(join(fontDir, 'bebas-neue', '400Regular', 'BebasNeue_400Regular.ttf')),
  mono: url(join(fontDir, 'courier-prime', '400Regular', 'CourierPrime_400Regular.ttf')),
  monoBold: url(join(fontDir, 'courier-prime', '700Bold', 'CourierPrime_700Bold.ttf')),
};
const ICON = url(join(app, 'assets', 'icon.png'));
const screen = (name) => url(join(here, 'screens', `${name}.png`));

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


const HOOK = ['My first app', 'is on the', 'Play Store'];
const LINE = 'Watch Heart: a diary for films, series and anime. Free, with no ads and no tracking.';

const extra = `
.fade { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, rgba(11,10,13,0), rgba(11,10,13,0.94) 55%, #0B0A0D); }
.cta { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
.cta span { display: inline-flex; align-items: center; gap: 16px; height: 84px; padding: 0 40px; border-radius: 42px; background: var(--gold); color: #1A1406;
  font-family: Mono; font-weight: 700; font-size: 32px; letter-spacing: 3px; text-transform: uppercase; box-shadow: 0 18px 50px rgba(0,0,0,0.6); }
.cta svg { width: 34px; height: 34px; }
.small { position: absolute; left: 0; right: 0; text-align: center; font-size: 27px; color: var(--muted); letter-spacing: 1px; }
`;
// A plain play triangle, not Google's logo or badge.
const PLAY = `<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="#1A1406"/></svg>`;

function postPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}${extra}
body { width: 1080px; height: 1350px; }
.head { position: absolute; left: 80px; right: 80px; top: 70px; text-align: center; }
h1 { font-size: 132px; margin-top: 34px; }
h1 .a { display: block; }
p { margin: 26px auto 0; max-width: 820px; font-size: 31px; line-height: 1.32; color: var(--muted); }
.phone { width: 430px; height: 956px; border-radius: 46px; }
.phone .scr { inset: 9px; border-radius: 38px; }
.p1 { left: 92px; top: 760px; transform: rotate(-4deg); } .p2 { left: 556px; top: 720px; transform: rotate(4deg); }
.fade { top: 1050px; }
.cta { top: 1168px; }
</style></head><body>
<div class="glow"></div><div class="strip l"></div><div class="strip r"></div>
<div class="phone p1"><div class="scr"><img src="${screen('diary')}"></div></div>
<div class="phone p2"><div class="scr"><img src="${screen('home')}"></div></div>
<div class="fade"></div>
<div class="head">
  <div class="stub"><img src="${ICON}"><b>WATCH <i>HEART</i></b></div>
  <h1><span class="a">${HOOK[0]}</span><span class="a">${HOOK[1]}</span><span class="b">${HOOK[2]}</span></h1>
  <p>${LINE}</p>
</div>
<div class="cta"><span>${PLAY}Free on Google Play</span></div>
</body></html>`;
}

function storyPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}${extra}
body { width: 1080px; height: 1920px; }
.head { position: absolute; left: 80px; right: 80px; top: 150px; text-align: center; }
h1 { font-size: 164px; margin-top: 42px; }
h1 .a { display: block; }
p { margin: 30px auto 0; max-width: 860px; font-size: 35px; line-height: 1.3; color: var(--muted); }
/* Small enough that the first ticket shows above the button; the bottom stays clear of Instagram's reply bar. */
.phone { width: 620px; height: 1378px; border-radius: 62px; left: 230px; top: 930px; }
.phone .scr { inset: 12px; border-radius: 52px; }
.fade { top: 1570px; }
.cta { top: 1650px; }
.small { top: 1762px; }
</style></head><body>
<div class="glow"></div><div class="strip l"></div><div class="strip r"></div>
<div class="phone"><div class="scr"><img src="${screen('diary')}"></div></div>
<div class="fade"></div>
<div class="head">
  <div class="stub"><img src="${ICON}"><b>WATCH <i>HEART</i></b></div>
  <h1><span class="a">${HOOK[0]}</span><span class="a">${HOOK[1]}</span><span class="b">${HOOK[2]}</span></h1>
  <p>${LINE}</p>
</div>
<div class="cta"><span>${PLAY}Free on Google Play</span></div>
<div class="small">Search “Watch Heart” on Google Play</div>
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
  const profile = mkdtempSync(join(tmpdir(), 'wh-social-'));
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
  const page = join(tmpdir(), `wh-social-${process.pid}.html`);
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

const b = await browser();
try {
  await render(b, postPage(), 1080, 1350, join(out, 'post-1080x1350.png'));
  await render(b, storyPage(), 1080, 1920, join(out, 'story-1080x1920.png'));
} finally {
  b.close();
}
