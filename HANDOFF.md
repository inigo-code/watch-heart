# Watch Heart: development handoff

Read this first when picking the project up in a new session or from another account. It sums up the work so far, where things stand, and the rules to keep. Last written 2026-11-13, at master `9e14c92` (What's new 1.5.7) with 1.5.8 uncommitted on top.

**App:** Watch Heart, a diary for films, series and anime. Free Android app, one of the Heart Apps by Inigo. Expo SDK 58, React Native 0.88, Expo Router, SQLite on the phone, Supabase for accounts, sync and friends, and TMDB, TVmaze and OMDb for data.

**Package:** `com.inigocode.watchheart`. **EAS owner:** `inigojo`, project ID `126ffff7-e3d5-4f58-b12f-0f92abb919a1` (in `app.json`). Builds, updates and env variables need to be logged in to that Expo account.

---

## Where things live

| What | Where |
| --- | --- |
| App source | this folder, GitHub `inigo-code/watch-heart` |
| Website | `..\Sites\Watch Heart`, `inigo-code/watch-heart-site`, https://inigo-code.github.io/watch-heart-site/ |
| F-Droid repo and signing key | `..\Watch Heart F-Droid` (its `publish.sh` also publishes the site; the keystore is not on GitHub) |
| Play Store text, Console answers, graphics | `store/listing.md`, `store/play-console.md`, `store/graphics/` |
| Supabase setup and SQL | `supabase/SETUP.md`, `supabase/*.sql` |
| Shared screenshot, site and release scripts | `..\Tools` (see its README) |
| Rules shared with Prompt Heart | `C:\Users\Inigo\.claude\heart-apps.md` |
| Claude's dated release log | `C:\Users\Inigo\.claude\projects\C--Users-Inigo-Desktop-Projects-Heart-Apps-Watch-Heart\memory\` |

The README has the feature list, the code map and the build commands.

---

## Rules to keep

- **Commits** as `Inigo <270059847+inigo-code@users.noreply.github.com>`. No Claude co-author trailer and no "Generated with Claude Code" line.
- **Never print API keys** (TMDB, OMDb). For a test, `eas env:pull` into a scratch file, use it, delete it. Setting secrets is Inigo's step.
- **Ask before outward actions**: pushing, releases, OTA publishes, site uploads, Play uploads.
- **Every update gets a What's new entry** with a new id, OTAs included. An update without one shows nothing.
- **Every OTA goes to both channels**, `preview` (APK phones) and `production` (Play phones).
- **Older runtimes**: since 2026-11-08 every phone is on 1.5.0 or later, so OTAs go from master only. The `ota-1.4`/`ota-1.3` branches are history.
- **JS changes go over the air; native changes need a build.** A new native module or plugin changes the runtime, so publish pending JS OTAs first.
- **EAS builds are scarce**: free plan, 15 Android builds a month, shared with Prompt Heart. November is used up; it resets 1 December. Build the APK first, test it on a phone, then build the AAB once. Check with `npx eas-cli@latest account:usage inigojo`.
- **Releases**: the GitHub release must carry `watch-heart.apk` under that exact name, or the site's download buttons break.
- **Widget files keep `"use no memo"`**: the React Compiler breaks react-native-android-widget.
- **`patches/`** holds a patch-package fix for react-native-android-widget (resize and taps), pinned to LF line endings. Keep it applying cleanly after any package update.
- **Preview server**: port 8082 belongs to Prompt Heart. Use Watch Heart's own entry in `.claude/launch.json`.
- Lint, typecheck and tests (`npx expo lint`, `npx tsc --noEmit`, `node --import ./tests/hooks.mjs --test "tests/*.test.mts"`) before calling anything done. The tests run the plain logic files in `src/lib` with Node's own runner, no packages. There's no `npm test` script on purpose: the runtime version is a fingerprint, and `package.json` scripts count towards it.

---

## Release state (2026-11-13)

- **What's new 1.5.8, not published, uncommitted pending review** (JavaScript only, runtime `96488ef6`): a failed diary load shows "Couldn't open your diary" with Try again, and nothing saves or syncs over it; lists and settings likewise (retried, then a quiet note, and failed settings mean locked); the lock screen shows only with App lock on; untick times on tracked shows (`Track.changed`), so an untick survives a merge with another phone; Watchlist sort Shortest first; Diary search reads reviews without their formatting marks, and the year; Home's offline line. First tests in `tests/`.
- 1.5.4 to 1.5.7 are published to both channels (see History).

- **Native build 1.5.0** (from `520653d`, runtime `96488ef6`): APK versionCode 12 on GitHub release v1.5.0 and F-Droid; AAB versionCode 13 built. Confirmed working on Inigo's phone.
- **Google Play**: closed test (a personal account needs 12 testers for 14 days before production). The 1.3.3 bundle is in the closed test; uploading the 1.5.0 AAB was left for Inigo, so check the Play Console.
- **OTAs**: everything is published to both `preview` and `production` (checked 2026-11-08 with `update:list`). Latest: 1.5.3 on runtime `96488ef6` (master), 1.4.9 on `688c28f0` (`ota-1.4`), 1.3.15 on `5e1fd486` (`ota-1.3`).
- **1.5.4 published (2026-11-08)** to preview and production on runtime `96488ef6` (master `e60ab41`): memory stories, people you might know, rule-safe streaming links, phone fixes. Everyone is on 1.5.0 (GitHub/F-Droid APK and the Play bundle), so older runtimes need no more copies; the 1.4.10 and 1.3.16 copies on `ota-1.4`/`ota-1.3` were not published. Inigo runs `supabase/suggestions.sql` (suggestions stay hidden until then) and uploads the site (privacy update `c069724`).
- **Git**: the `ota-*` branches are local only.
- **What's new** is now a list of notes per update in `src/lib/app.ts` (`NOTES`); add a new note at the top for each update. A phone shows only notes newer than the last one it saw.
- **Line endings**: the repo is LF. Python on Windows writes CRLF unless told `newline=''`/`'\n'`; check with `git ls-files --eol` before committing.
- **Site**: privacy update and `invite.html` are live.

---

## History

### 1.0 (27–28 Oct): the diary
Diary of films, series and anime with half stars, reviews, hearts and rewatches; monthly Instagram stories; watchlist; share-in links from IMDb, Letterboxd, TMDB, MyAnimeList; imports from ten apps with automatic posters; accounts and cloud sync on Supabase; meeting TMDB's and AniList's terms (AniList off without permission); F-Droid install; IMDb, Rotten Tomatoes and Metacritic scores; profile with photo sync; episode tracking; where to watch; Watched with.

### 1.1.0 (28–29 Oct)
Profile photo on the home screen, native photo picking, your own lists (ranked, shareable, synced), title pages and Discover, cast and details on entries.

### 1.2.0 (29 Oct – 1 Nov)
Friends by invite code; Up next home-screen widget; Home tab (top title, picks, trending, in cinemas, regional rows); movie night reminders; region and language settings; Indian cinema tickets as the Diary's look; custom posters; marquee header; tab bar on every page; Google Play listing and Console answers; advertising ID blocked. First Play AAB (versionCode 5). OTAs 1.2.1 and 1.2.2 added onboarding, the Watchlist rework and real service links.

### 1.3.x (5 Nov)
Reminders with the app closed; no dark strip at launch; one page background, pull to refresh; Home as a diary first; a fix for a profile data-loss bug on a new phone's first sign-in (built into 1.3.3); friends' activity names the episode; Home's week strip; notifications for new episodes, picks and the monthly recap; one highlight colour.

### 1.4.x (5 Nov)
Where to watch opens the installed streaming app first (`modules/app-launcher`, `plugins/withStreamingQueries`); widget drawing fixed; This week stack; delete a viewing, unsaved-text prompt, favourite removal, trash undoes episode ticks; alerts follow the season you're on, in your time zone, and watchlist releases (with a Settings switch); refreshes can't overwrite newer edits.

### 1.5.x (5–7 Nov)
Widget resize and taps patched; a 12-hourly background air-date check (expo-background-task); two-phone merge of shows; App lock hides widget titles (with a switch). 1.5.1: Friends rebuilt with a row of faces, previews, blocking, a final unfriend, 30-day decline, request badge and alerts (needs `supabase/friends-safety.sql`, already run). 1.5.2: A Heart App chip centred. 1.5.3: Find suggests from your own watchlist. 1.5.4: memory stories, people you might know, rule-safe streaming links. 1.5.5: memory stories take your own words and a movable poster. 1.5.6: text size, photo filters, more Discover lists. 1.5.7: award winners in Discover (from Wikidata, `scripts/make-awards.mjs`).

### 1.5.8 (13 Nov, not published)
From a review of the store, sync and load paths: a failed diary load is caught instead of showing an empty diary (sync could have sent deletes); the lock screen no longer flashes with App lock off; untick times so the newer of a tick and an untick wins across phones; Watchlist Shortest first; Diary search in reviews and years; Home's offline line.
Second round: lists and settings get the same guard (a failed read is retried, then nothing saves or syncs until a read works; `src/lib/retry.ts`), and failed settings keep App lock on and hold back the welcome and What's new; Home leaves out rows that can't load instead of grey shapes; the episode sheet reads its episode from the live list.

The full list is `git log`; every user-facing commit names its What's new version.

---

## Open work

**Check on a real phone** (the web preview can't show these): the widget after resizing, notifications with the app closed, opening streaming apps, the This week stack, the friend page, the unsaved prompt, friend paging on the real database, large phone fonts, onboarding's poster wall.

**Known bugs**
1. ~~An untick on one phone can come back if another phone ticked the same show offline.~~ Fixed in 1.5.8 for phones on 1.5.8 or later: each tick and untick is timed (`changed` on the track, newest 200, 60 days), and a merge keeps whichever came last. A phone still on an older version can bring an untick back, as before. Tests: `tests/tracking.test.mts`.
2. ~~The episode list on a show's page still shows TMDB's dates.~~ Checked 13 Nov: already fixed in 1.5.0 (`05bdc5c`). The Episodes page takes each day from the track's `upcoming`, the same list the alerts use, in the phone's time zone. Episodes already aired, and seasons after the airing one, show TMDB's (or TVmaze's) day; no alert uses those.
3. The Netflix title link depends on Google's first result. No fix without a paid API.

**For the next native build** (after 1 December)
- Copy Prompt Heart's `android:windowBackground` change (its `plugins/withSplashSystemBars.js`) to clear the black strip on Android 15, once confirmed there.

**Left as they are, by choice**: Home stays lit on pages opened from Home; the log form covers the tab bar.

**Before going public**: redo the store screenshots in `store/graphics/`, which predate most of this work. (The README's version badge now says 1.5.0, the installed app's version; raise it with the next native build.)

---

## Switching accounts

- **Terminal**: Windows PowerShell blocks `npx` (`npx.ps1 cannot be loaded`). Use `npx.cmd eas-cli@latest …` there, or run it from Claude.
- **Claude account**: everything above, the memory notes and `heart-apps.md` are local files, so any account on this PC sees them. Chats from another account don't carry over; this file does.
- **Expo account**: builds, updates and env variables belong to `inigojo`. Check with `npx eas-cli@latest whoami`; switch with `npx eas-cli@latest login`.
- **GitHub**: `gh auth status`. Pushes go to `inigo-code`.
- Keep master committed and pushed before switching, and update this file when the release state changes.
