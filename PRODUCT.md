# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Film, series and anime fans, mostly in India (the Play listing is en-IN). They watch across cinemas, OTT services (Netflix, Prime Video, JioHotstar and the like) and TV, in several Indian languages as well as world cinema and anime. They use Watch Heart on their phone, often on patchy networks, to remember what they watched, rate and review it, keep a watchlist, follow series episode by episode, and share their month as an Instagram story. Some connect with friends to see what they watch.

## Product Purpose

Watch Heart is a diary for everything you watch: log a viewing with half stars, a heart and a review, keep a watchlist, track series and anime episode by episode, and turn each month or year into a shareable story. Success is a diary people keep up because logging is quick and looking back is a pleasure.

## Positioning

A diary first, not a social network or a catalogue: every viewing is kept like a ticket stub and every month like a reel of film. Free, no ads, no tracking, nothing to buy, works offline with the diary on the phone. Made for Indian viewers: new releases and favourites in your language, what's in cinemas in your country, and where to watch on Indian services.

## Operating Context

- Logging happens right after watching: in the cinema lobby, on the sofa, late at night after an episode.
- Discovery happens before watching: Home, Find, Discover, the watchlist and Pick for me.
- Looking back: the Diary (film-strip months, ticket stubs or a poster wall), Recap stories, profile stats.
- Links shared in from IMDb, Letterboxd, TMDB, MyAnimeList or Chrome open ready to log.
- Imports from Letterboxd, IMDb, Trakt, MyAnimeList, AniList, Netflix, TV Time and others.
- A home-screen widget shows Up next.

## Capabilities and Constraints

- Expo SDK 58, React Native 0.88, Expo Router; SQLite on the phone; Supabase for optional accounts, sync and friends; TMDB, TVmaze and OMDb for data (api.tmdb.org, since api.themoviedb.org is blocked on some Indian networks).
- JavaScript changes ship over the air; native changes need a new build, and EAS builds are scarce.
- Two looks: Projector (dark, default) and Paper (light), plus a choice of accent colours and a text size setting.
- Users never see technical error text; errors go through `shownError` (`src/lib/errors.ts`).
- TMDB's attribution notice must stay in the app.

## Brand Commitments

- Name: Watch Heart, one of the Heart Apps by Inigo (About screen chip and Heart Apps card stay as described in the shared Heart Apps notes).
- The cinema identity stays: tickets, the film-strip Diary, stories, gold accent, the logo.
- Faces: Instrument Sans for the interface, Bebas Neue for the wordmark, tab titles and big numbers, Courier Prime only on printed artefacts (tickets, stamp, stories, cards).
- Voice: plain, warm, short; cinema touches are welcome where they help, never in the way.
- Contact: inigo@tosstheworld.org.

## Evidence on Hand

- Real features and copy in the app, the README and `store/listing.md`; store screenshots in `store/graphics/`.
- No user counts, ratings, testimonials or press. Never invent any.

## Product Principles

1. Logging is the heartbeat: anything that makes a viewing quicker to log comes first.
2. A diary, not a feed: the person's own history leads, discovery supports it.
3. Works without the internet: the diary, watchlist and settings never depend on a connection.
4. Respect the viewer: no ads, no dark patterns, no technical noise, nothing to buy.
5. Made for India, open to the world: Indian languages, cinemas and services are first-class, not an add-on.

## Accessibility & Inclusion

- Follows the phone's font size up to a cap, plus the app's own text size setting; layouts must hold at Larger.
- Touch targets of 48dp; text contrast of at least 4.5:1 in both looks and every accent.
- Respects reduced motion.
