// A tiny remote control for a headless Edge showing the web build, for taking the store screens.
// The phone is 432 × 960 at 2.5×, so every capture is 1080 × 2400, the same as a Pixel-sized phone.
//
//   node store/make/cdp.mjs open                 start Edge (keeps running) on the web build
//   node store/make/cdp.mjs seed                 put the demo diary and settings in (see README.md)
//   node store/make/cdp.mjs go /title/movie:123  open a page of the app
//   node store/make/cdp.mjs click "Log it"       click the element whose text matches
//   node store/make/cdp.mjs hold "Log it"        press and hold it
//   node store/make/cdp.mjs scroll 600           scroll the page under the middle of the screen
//   node store/make/cdp.mjs eval "js"            run JavaScript in the page and print the result
//   node store/make/cdp.mjs shot diary          save store/make/screens/diary.png
//   node store/make/cdp.mjs shot x <path.webp>  save anywhere; a .webp path saves a webp
//   node store/make/cdp.mjs close
//
// Keys: `seed` reads EXPO_PUBLIC_TMDB_KEY and EXPO_PUBLIC_OMDB_KEY from the file named by WH_KEYS
// (an `eas env:pull --path` file in a scratch folder) into this browser's settings only. They are never
// printed or written anywhere else. Delete that file and the profile folder when done.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.WH_ORIGIN ?? 'http://localhost:8084';
const PORT = 9455;
const PROFILE = process.env.WH_PROFILE ?? join(tmpdir(), 'wh-store-profile');
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
// WH_SIZE=412x892x2 takes the website's phone screens (824 × 1784) instead.
const [W, H, DPR] = (process.env.WH_SIZE ?? '432x960x2.5').split('x').map(Number);

async function connect() {
  // Only ever the app's own tab: a browser profile can open others (an extension's welcome page).
  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && p.url.startsWith(ORIGIN));
  if (!page) throw new Error(`No tab on ${ORIGIN}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0;
  const waiting = new Map();
  const events = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    if (msg.method && events.has(msg.method)) { events.get(msg.method)(msg.params); events.delete(msg.method); }
  });
  const next = (method) => new Promise((r) => events.set(method, r));
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mine = ++id;
    waiting.set(mine, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
    ws.send(JSON.stringify({ id: mine, method, params }));
  });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable');
  return { send, evaluate, next, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Finds the smallest visible element whose own text matches, and returns its centre.
const findJs = (text, nth = 0) => `(() => {
  const want = ${JSON.stringify(text)};
  const all = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return false;
    const t = (el.innerText ?? '').trim();
    return t === want || el.getAttribute('aria-label') === want;
  });
  const smallest = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  const el = smallest[${nth}];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

async function press(c, at, holdMs = 0) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
  await sleep(holdMs || 60);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'open') {
  mkdirSync(PROFILE, { recursive: true });
  const p = spawn(EDGE, ['--headless=new', '--disable-extensions', '--disable-component-extensions-with-background-pages', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, `--window-size=${W},${H}`, ORIGIN], { stdio: 'ignore', detached: true });
  p.unref();
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json`); break; } catch { await sleep(250); }
  }
  const c = await connect();
  await c.send('Page.reload');
  console.log('open', ORIGIN);
  c.close();
} else {
  const c = await connect();
  try {
    if (cmd === 'seed') {
      const keys = Object.fromEntries(readFileSync(process.env.WH_KEYS, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
      const backup = JSON.parse(readFileSync(join(here, 'demo-backup.json'), 'utf8'));
      const extra = existsSync(join(here, 'demo-settings.json')) ? JSON.parse(readFileSync(join(here, 'demo-settings.json'), 'utf8')) : {};
      const settings = {
        themeMode: 'dark', accent: 'marquee', onboarded: true, askedAlarms: true, ...extra,
        tmdbKey: keys.EXPO_PUBLIC_TMDB_KEY ?? '', omdbKey: keys.EXPO_PUBLIC_OMDB_KEY ?? '',
      };
      await c.evaluate(`(() => {
        localStorage.clear();
        localStorage.setItem('watchheart/preview-diary', ${JSON.stringify(JSON.stringify(backup.entries))});
        localStorage.setItem('watchheart/preview-watchlist', ${JSON.stringify(JSON.stringify(backup.watchlist))});
        localStorage.setItem('watchheart/settings', ${JSON.stringify(JSON.stringify(settings))});
        return true;
      })()`);
      await c.send('Page.navigate', { url: ORIGIN });
      console.log(`seeded ${backup.entries.length} viewings, ${backup.watchlist.length} on the watchlist`);
    } else if (cmd === 'go') {
      await c.send('Page.navigate', { url: ORIGIN + args[0] });
      await sleep(Number(args[1] ?? 3000));
      console.log('at', await c.evaluate('location.pathname'));
    } else if (cmd === 'click' || cmd === 'hold') {
      const at = await c.evaluate(findJs(args[0], Number(args[1] ?? 0)));
      if (!at) throw new Error(`Nothing on screen says "${args[0]}"`);
      await press(c, at, cmd === 'hold' ? 900 : 0);
      await sleep(1200);
      console.log(cmd, args[0], Math.round(at.x), Math.round(at.y));
    } else if (cmd === 'upload') {
      // Click the button that opens the photo picker, and answer the picker with a file.
      await c.send('Page.setInterceptFileChooserDialog', { enabled: true });
      const at = await c.evaluate(findJs(args[0]));
      if (!at) throw new Error(`Nothing on screen says "${args[0]}"`);
      const chooser = c.next('Page.fileChooserOpened');
      await press(c, at);
      const { backendNodeId } = await chooser;
      await c.send('DOM.setFileInputFiles', { files: [args[1]], backendNodeId });
      await c.send('Page.setInterceptFileChooserDialog', { enabled: false });
      await sleep(2000);
      console.log('uploaded', args[1]);
    } else if (cmd === 'type') {
      // Type into the text field whose placeholder starts with args[0].
      const ok = await c.evaluate(`(() => { const el = [...document.querySelectorAll('input,textarea')].find(i => (i.placeholder ?? '').startsWith(${JSON.stringify(args[0])})); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return true; })()`);
      if (!ok) throw new Error(`No field starting "${args[0]}"`);
      await c.send('Input.insertText', { text: args[1] });
      await c.evaluate('document.activeElement.blur(), 1');
      await sleep(800);
      console.log('typed', args[1]);
    } else if (cmd === 'tap') {
      await press(c, { x: Number(args[0]), y: Number(args[1]) });
      await sleep(1200);
      console.log('tap', args[0], args[1]);
    } else if (cmd === 'scroll') {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: Number(args[1] ?? H / 2), deltaX: 0, deltaY: Number(args[0]) });
      await sleep(900);
      console.log('scrolled', args[0]);
    } else if (cmd === 'eval') {
      console.log(JSON.stringify(await c.evaluate(args[0]), null, 1));
    } else if (cmd === 'shot') {
      const out = args[1] ?? join(here, 'screens', `${args[0]}.png`);
      // A path ending in .webp saves a webp, the format the website uses.
      const webp = out.endsWith('.webp');
      const { data } = await c.send('Page.captureScreenshot', webp ? { format: 'webp', quality: 82 } : { format: 'png' });
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(data, 'base64'));
      console.log('saved', out);
    } else if (cmd === 'close') {
      await c.send('Browser.close').catch(() => {});
      console.log('closed');
    } else {
      console.log('commands: open seed go click hold tap scroll eval shot close');
    }
  } finally {
    c.close();
  }
}
