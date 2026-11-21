// Draws the app's own icons (assets/icons/src/*.svg) as PNGs the app can tint: the native build has no SVG
// support, and pictures ship over the air where a new icon library wouldn't.
//
//   node store/make/icons.mjs        writes assets/icons/<name>.png, 96 × 96 (a 24dp icon at 4×)
//
// Each SVG is black on a 24-unit grid with 1.75 strokes; the app colours it with tintColor.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'icons');
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
if (!EDGE) throw new Error('Needs Edge or Chrome');

const profile = mkdtempSync(join(tmpdir(), 'wh-icons-'));
try {
  for (const file of readdirSync(join(root, 'src')).filter((f) => f.endsWith('.svg'))) {
    const out = join(root, file.replace(/\.svg$/, '.png'));
    execFileSync(EDGE, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      '--default-background-color=00000000',
      '--window-size=96,96',
      `--screenshot=${out}`,
      pathToFileURL(join(root, 'src', file)).href,
    ], { stdio: 'ignore' });
    console.log('drew', file);
  }
} finally {
  rmSync(profile, { recursive: true, force: true });
}
