<p align="center">
  <img src="docs/hero.jpg" alt="Watch Heart: your film, series and anime diary" width="100%" />
</p>

<p align="center">
  <a href="../../releases/latest/download/watch-heart.apk"><img alt="Download APK" src="https://img.shields.io/badge/Download-Android%20APK-F2B84B?style=for-the-badge&logo=android&logoColor=white&labelColor=0B0A0D"></a>
  <a href="https://inigo-code.github.io/watch-heart-site/"><img alt="Website" src="https://img.shields.io/badge/Website-Watch%20Heart-FF4D6D?style=for-the-badge&logo=githubpages&logoColor=white&labelColor=0B0A0D"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-F2B84B?style=for-the-badge&labelColor=0B0A0D">
  <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK%2058-000020?style=for-the-badge&logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.88-61DAFB?style=for-the-badge&logo=react&logoColor=black">
  <img alt="Supabase" src="https://img.shields.io/badge/Sync-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img alt="Data from TMDB" src="https://img.shields.io/badge/Data-TMDB-01B4E4?style=for-the-badge&logo=themoviedatabase&logoColor=white&labelColor=0B0A0D">
</p>

<h3 align="center">Every viewing, a ticket. Every month, a story.</h3>

<p align="center">
<b>Watch Heart</b> is a diary for everything you watch: the film on Friday, the series you finish on Sunday,<br/>
the anime you swear is the last episode at 1 am. Log it with half stars and a review,<br/>
keep a watchlist, and turn each month into an <b>Instagram story</b>. Free, with no ads.
</p>

<br/>

## 🎬 Highlights

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>🎟️ A diary on film</h4>
      Every month is a reel of film and every viewing a ticket stub with the date, poster, stars, heart and review. Or switch to a poster wall.
    </td>
    <td width="33%" valign="top">
      <h4>🔎 Find anything</h4>
      Films, series and anime in one search, with what's trending this week before you type. Anime is recognised and tagged automatically.
    </td>
    <td width="33%" valign="top">
      <h4>⭐ Half stars, real reviews</h4>
      Slide across the stars to rate, heart the ones you love, mark rewatches, note <i>Season 2 · Ep 1–8</i>, and hide spoilers behind a tap.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h4>📸 Month in a story</h4>
      Any month, or <i>2026 wrapped</i>, as a 1080 × 1920 story: three layouts, six palettes, ratings, stats or a ranking. Share to Instagram or save to Photos.
    </td>
    <td valign="top">
      <h4>🍿 Can't decide?</h4>
      Bookmark what you want to watch. When nobody can choose, <b>Pick for me</b> shows tonight's feature. Logging it takes it off the list.
    </td>
    <td valign="top">
      <h4>🔗 Share it in</h4>
      Share a link from IMDb, Letterboxd, TMDB, MyAnimeList or Chrome and Watch Heart opens it, ready to log.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h4>📥 Bring your history</h4>
      Import from Letterboxd, IMDb, Trakt, Moviebase, MyAnimeList, AniList, Netflix, Refract, Serializd and TV Time. Posters are found on their own.
    </td>
    <td valign="top">
      <h4>☁️ Sync &amp; backup</h4>
      Optional account to keep your diary on every device. Works offline. JSON backup, CSV export and a Letterboxd-ready file.
    </td>
    <td valign="top">
      <h4>🌗 Projector or Paper</h4>
      A dark projector look or a light paper one, five accents, fingerprint App lock, and a 30-day Trash with undo.
    </td>
  </tr>
</table>

<br/>

<p align="center">
  <img src="docs/gallery.jpg" alt="Screens on a film strip: the diary, Find, a logged review, Pick for me, the Recap and Import" width="100%" />
</p>

<p align="center">
  <img src="docs/stories.jpg" alt="October as six Instagram stories: Marquee, Velvet, Neon, Sakura, Noir and Paper palettes in the Film strip, Tickets and Spotlight layouts" width="100%" />
</p>

## ⬇️ Install

1. On your Android phone, tap **[Download APK](../../releases/latest/download/watch-heart.apk)** (or open the [latest release](../../releases/latest)).
2. Open the file. If Android asks, allow your browser to install apps. If Play Protect warns, choose **Install anyway**.
3. That's it. Updates arrive by themselves, and new versions install over the old one and keep your diary.

> Watch Heart asks for very little: **Internet**, for search, posters, sync and updates; **Biometric**, only if you turn on App lock; and permission to **save** stories to Photos. It can't read your gallery.

## 🔒 Your data

- **On your phone first.** Your diary, watchlist and settings live on the phone and work without an account.
- **Private sync.** With an account, your diary and watchlist sync through Supabase. Row Level Security means every account can read only its own rows.
- **Leave any time.** Export a backup, a spreadsheet or a Letterboxd file, or [delete your account](https://inigo-code.github.io/watch-heart-site/delete-account.html) in the app.
- **No ads, no analytics, no tracking.** See the [privacy policy](https://inigo-code.github.io/watch-heart-site/privacy.html).

## 📥 Importing from other apps

Settings → **Import from other apps**, then pick the file your old app exported, as it comes (a .zip, CSV, JSON or XML). You can pick several at once, and importing again never makes doubles. Titles without a poster are matched against TMDB in the background, and those it can't place are tried again after two weeks. The app's Import screen has step-by-step export guides.

| App | What comes across |
| --- | --- |
| Letterboxd | Diary, ratings, reviews, likes, watched films, watchlist |
| IMDb | Ratings (dated when you rated) and watchlist |
| Trakt (and Moviebase, through Trakt) | History, ratings, watchlist, with exact matches |
| MyAnimeList / AniList | Completed, watching, on hold and dropped, with episodes; plan to watch goes to the watchlist |
| Netflix | Viewing activity, with series grouped per day |
| Refract, Serializd, TV Time | Any CSV or JSON export: titles, dates, ratings, reviews |

Entries without a watch date go to an **Archive** at the end of the diary instead of a made-up date.

## 🎞️ Free data sources

| Kind | Source | Key |
| --- | --- | --- |
| Films, series and anime | [TMDB](https://www.themoviedb.org) | Free personal key |
| Series and trending | [TVmaze](https://www.tvmaze.com) | None |
| Anime | [AniList](https://anilist.co) | Off until AniList gives permission |

Film and anime search need a TMDB key. Builds bake one in with `EXPO_PUBLIC_TMDB_KEY` (see `.env.example`), or paste your own into **Settings → Film and anime search** in the app. The app talks to `api.tmdb.org`, which also works on networks that block `api.themoviedb.org`.

Keeping to the terms:

- **TMDB** (free for non-commercial use): the About screen shows TMDB's logo and its required notice, and TMDB details are refreshed after about 5 months and never kept longer than 6 (`src/lib/tmdbFreshness.ts`). Ads or paid features would need a commercial agreement with TMDB first.
- **AniList** bars "anime and manga list or tracker services" from its API, so it stays off (`ANILIST_ALLOWED` in `src/lib/app.ts`) unless AniList gives written permission.
- **TVmaze** (CC BY-SA) only asks for a link back, which is on the About screen.

<sub>Watch Heart uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</sub>

## 🛠️ Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on Android. Everything works in Expo Go except share-in and the App lock privacy screen (a small native module in `modules/app-privacy`, as in Prompt Heart), which need a development build:

```bash
npx eas-cli@latest build --profile development --platform android
```

`npx expo start --web` opens a design preview in the browser. It keeps the diary in localStorage (`src/store/db.web.ts`) and can't save stories to Photos.

### Build and release

The EAS profiles match Prompt Heart's: `preview` builds an installable APK and `production` builds an AAB for Google Play. JavaScript changes ship over the air:

```bash
npx eas-cli@latest update --channel preview --platform android --environment preview --message "What changed"
```

New native code needs a new build. Attach the APK to a GitHub release as `watch-heart.apk`, so the website's download buttons always fetch the newest one.

Accounts and sync need a free Supabase project; see [supabase/SETUP.md](supabase/SETUP.md).

### Code map

- `src/app`: screens (Expo Router). `(tabs)` holds Diary, Find, Watchlist and Recap.
- `src/api`: TMDB, TVmaze and AniList clients, and link resolving for share-in.
- `src/store`: the diary and watchlist (SQLite on the phone) and their types.
- `src/lib/import`: the importers, one per app, and file detection.
- `src/lib/tmdbFreshness.ts`: background poster matching and TMDB upkeep.
- `src/sync`, `supabase/`: accounts and cloud sync, and the server schema.
- `src/story`: the Instagram story canvas, review card, palettes and share/save.
- `src/components`: film-styled UI (posters, stars, ticket stubs, reel headers).
- `src/lock`, `modules/app-privacy`: App lock, from Prompt Heart.
- `scripts/make-icons.mjs`: renders the app icons.

<p align="center"><sub>Made by Inigo, who also makes <a href="https://github.com/inigo-code/prompt-heart">Prompt Heart</a>.</sub></p>
