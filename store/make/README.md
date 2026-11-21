# Store graphics

How the Google Play pictures in `store/graphics` are made: real screens of the app with a made-up demo diary, put into frames with captions. Made 2026-11-21 from What's new 1.7.0.

| File | What it shows | Screens |
|---|---|---|
| `screenshots/01.png` | Every viewing, a ticket: the Diary as ticket stubs | `diary` |
| `screenshots/02.png` | Your week at a glance: Home with This week (weekday names), Continue watching, Up next | `home` |
| `screenshots/03.png` | Everything about a title: Dune: Part Two, scores, where to watch, cast | `title`, `title-more` |
| `screenshots/04.png` | Episode by episode: ticks on an unknown day, yesterday and today | `episodes`, `episodes-list` |
| `screenshots/05.png` | Your month as a story: the Recap, Spotlight layout | `story` |
| `screenshots/06.png` | Keep the memory: a memory story with a photo, Warm filter and a line of text | `memory` |
| `screenshots/07.png` | Find your next favourite: Discover's lists and award winners | `discover` |
| `screenshots/08.png` | Can't decide? Pick for me, on the Watchlist | `pick` |
| `feature-graphic.png` | Logo, "Every viewing, a ticket.", the Diary and Home | `diary`, `home` |
| `icon-512.png` | The app icon (only redrawn with `node store/make/compose.mjs icon`) | `assets/icon.png` |

All are 24-bit PNGs with no alpha: screenshots 1080 × 1920 (9:16), feature graphic 1024 × 500.

## Remake the pictures from the saved screens

```bash
node store/make/compose.mjs
```

Captions and layouts are in `SHOTS` at the top of `compose.mjs`.

The Play Store launch post (`store/social`: a 1080 × 1350 feed post, a 1080 × 1920 story, and the captions in `post.md`) comes from the same screens: `node store/make/social.mjs`. It needs Edge or Chrome, plus `pngjs`, which is already in `node_modules`.

## Take new screens

The screens come from the web build (`watch-heart-web` in `..\.claude\launch.json`, port 8084), driven by `cdp.mjs` in a headless Edge with its own profile. The phone is 432 × 960 at 2.5×, so each screen is 1080 × 2400. The Play APK can't be used on the x86_64 emulator, because it is ARM-only.

1. Write the demo data: `node store/make/demo.mjs 2026-11-21` (the day you take the screens).
2. Get the keys into a scratch file, never into the repo, and never print them: `npx eas-cli@latest env:pull --environment production --non-interactive --path <scratch>\keys.env`.
3. Start the web build, then (in Git Bash, set `MSYS_NO_PATHCONV=1` so routes like `/search` aren't turned into paths):
   ```bash
   export WH_PROFILE=<scratch>/edge-profile WH_KEYS=<scratch>/keys.env
   node store/make/cdp.mjs open
   node store/make/cdp.mjs seed     # demo diary, watchlist, demo-settings.json, keys in this browser only
   ```
   Wait about 30 s while the app finds the posters on TMDB.
4. Frieren's entries come from ticking episodes. Open `/title/tv:209867`, then click Episodes. Choose Don’t remember and tick 1–3, Yesterday and tick 4–6, Today and tick 7–8. Then, in the diary, delete the Ep 4–6 entry and give the Ep 7–8 one 5 stars and a heart. Shot `episodes` is the top of the page; `episodes-list` is scrolled 330.
5. The other shots, each with `node store/make/cdp.mjs shot <name>`. `click` takes the exact text on screen (sentence case, curly apostrophes) or an accessibility label; `tap x y` works when it can't find it:
   - `diary`: `/diary`.
   - `home`: `/`.
   - `title`: `/title/movie:693134`; `title-more` is the same page scrolled 610.
   - `story`: `/recap`, Nov, Spotlight.
   - `memory`: `/card/demo-entry-12?style=memory`. Run `upload "Choose a photo" <full path>\photos\dusk-5.jpg`, type into the "A line of your own" field, then pick Warm. If the preview draws small in a corner, press Review and then Memory.
   - `discover`: `/search`, Discover, scrolled 100.
   - `pick`: `/watchlist`, then `tap 216 186` (Can’t decide? Pick for me).
6. `node store/make/cdp.mjs close`, delete the profile folder and `keys.env`, then run `compose.mjs`.

**The website's phone screens** (`Sites\Watch Heartssets\screens\diary.webp`, `entry.webp`, `pick.webp`, 824 × 1784) come from the same session with `WH_SIZE=412x892x2` set and a `.webp` path: `shot x <path>\diary.webp` on `/diary`, `entry.webp` on `/entry/demo-entry-04` (Past Lives), `pick.webp` on `/watchlist` after `tap 206 171`. Update the `alt` text in the site's `index.html` to what the new screens show.

`photos/dusk-5.jpg` is a generated landscape (`..\Tools\scene.py`, seed 5), so no real photo is used. TMDB data and posters need TMDB's attribution, which the listing text carries. The web build has two quirks to avoid: long month names in the Film strip story get cut ("NOVEMB…") because `adjustsFontSizeToFit` doesn't work on the web, and flags show as letters.
