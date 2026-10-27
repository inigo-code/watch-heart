# Watch Heart

**Your film, series and anime diary.** Log what you watched and when, rate it in half stars, write the review,
and turn every month into an Instagram story.

## What it does

- **Diary.** Every month is a reel of film; every viewing is a ticket stub with the date, poster, stars,
  like and review. Switch to a poster wall. Filter by films, series, anime, liked, reviewed or rewatches,
  and search the diary.
- **Find.** Search films and series (TMDB), anime (AniList) and, without a TMDB key, series (TVmaze).
  See what's trending this week. Can't find it? Add it by hand.
- **Log it.** Watched today, yesterday or any date. Half-star rating by sliding across the stars, like,
  rewatch, what you watched ("Season 2 · Ep 1–8"), review with a spoiler flag, and tags.
- **Recap.** Pick a month or a whole year ("2026 wrapped"). Choose one of three layouts (Film strip,
  Tickets, Spotlight), one of six palettes, and whether to show ratings, stats or a ranking. Then share
  a 1080×1920 story to Instagram (or anywhere) or save it to Photos. Also: screen time, average rating,
  top genre, the mix of films, series and anime, and a rating histogram.
- **Story card.** Share a single review as a "just watched" ticket.
- **Watchlist.** Bookmark titles from Find or a shared link, then let “Pick for me” choose tonight’s feature. Logging a title takes it off the list.
- **From Letterboxd.** Import your Letterboxd export (.zip) with ratings, reviews, likes and watchlist.
- **Account and sync (optional).** Email sign-in with codes, sync across devices, sign out, delete account.
- **Yours.** Projector (dark) or Paper (light) look, five accents, app lock with fingerprint or screen lock,
  30-day Trash with undo, JSON backup and restore, CSV export, and a Letterboxd-ready CSV for films.

Everything lives on the phone. Optionally, sign in to back up the diary and watchlist and keep them in sync across devices (free Supabase project; see [supabase/SETUP.md](supabase/SETUP.md)).

## Free data sources

| Kind | Source | Key |
| --- | --- | --- |
| Anime | [AniList](https://anilist.co) GraphQL | None |
| Series | [TVmaze](https://www.tvmaze.com) | None (fallback without TMDB) |
| Films and series | [TMDB](https://www.themoviedb.org) | Free personal key |

Film search needs a TMDB key. Either paste one into **Settings → Film search** in the app, or bake one into
builds with `EXPO_PUBLIC_TMDB_KEY` (see `.env.example`). TMDB's terms ask for the attribution that's on the
About screen.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on Android. Everything works in Expo Go except the App lock privacy screen
(a small native module in `modules/app-privacy`, as in Prompt Heart), which needs a development build:

```bash
npx eas-cli@latest build --profile development --platform android
```

`npx expo start --web` opens a design preview in the browser. It keeps the diary in localStorage
(`src/store/db.web.ts`) and can't save stories to Photos.

## Build and release

The EAS profiles match Prompt Heart's: `preview` builds an installable APK, and `production` builds an AAB
for Google Play. Run `npx eas-cli@latest init` once to link the project to your Expo account. That also
fills in `updates.url` for over-the-air updates.

## Code map

- `src/app`: screens (Expo Router). `(tabs)` holds Diary, Find and Recap.
- `src/api`: TMDB, AniList and TVmaze clients.
- `src/store`: the diary and watchlist (SQLite on the phone) and their types.
- `src/sync`, `supabase/`: accounts and cloud sync (Supabase), and the server schema.
- `src/story`: the Instagram story canvas, review card, palettes and share/save.
- `src/components`: film-styled UI (posters, stars, ticket stubs, reel headers, hero).
- `src/lock`, `modules/app-privacy`: App lock, from Prompt Heart.
- `scripts/make-icons.mjs`: renders the app icons.
