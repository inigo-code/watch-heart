// Draws the widget picker's preview (assets/widget-preview/up-next.png) from up-next.html with headless Edge.
//   node store/make/widget/draw.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', '..', 'assets', 'widget-preview', 'up-next.png');
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
if (!EDGE) throw new Error('Needs Edge or Chrome');
const profile = mkdtempSync(join(tmpdir(), 'wh-widget-'));
try {
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, '--default-background-color=00000000', '--allow-file-access-from-files', '--virtual-time-budget=3000', '--window-size=640,416', `--screenshot=${out}`, pathToFileURL(join(here, 'up-next.html')).href], { stdio: 'ignore' });
  console.log('drew', out);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
