# Website features to bring to the app

Draft, 2026-11-23. The website (watchheart.in, `Watch Heart Web`) now has a few touches the app doesn't. This
file lists the ones that suit a phone, where each would go in the app, and how big a job it is. Reel, the
mascot, has his own plan in [reel-mascot-plan.md](reel-mascot-plan.md); his part is summed up below.

Everything here except where marked can be drawn with plain Views, Animated and the icons the app already has,
so it ships as an over-the-air update (`eas update` to every runtime), with no new APK or Play release.

## 1. Loved stamp on diary tickets

**On the website:** a loved title gets a rubber stamp on the right edge of its ticket: a pink heart inside a
double ring, tilted about -14°, slightly faded like ink on paper (`Watch Heart Web/src/ui/DiaryTicket.tsx`,
`.loved-stamp` in `src/styles.css`).

**In the app today:** a small 13px heart sits next to the stars (`src/components/Diary.tsx`, `TicketStub`), and
reads as one more icon in the row.

**What to do:**

- In `TicketStub`, take the heart out of the stars row and draw a stamp at the ticket's right edge, vertically
  centred: a 34 × 34 circle, 2 px `theme.like` border, a second ring inside it (a 1 px border on an inset
  View, 2.5 px of the ticket's paper colour between them), `Ionicons heart` 15 px in the middle,
  `transform: [{ rotate: '-14deg' }]`, opacity 0.88.
- The ticket's body already ends at the right edge; give it `paddingRight` so long titles never run under the
  stamp.
- Keep `accessibilityLabel="Loved"` on the stamp.
- Grid view (`PosterTile`, the "poster on the wall"): keep the small heart there, since a stamp doesn't fit
  under a poster.
- **Nice extra:** when you tick Loved while logging, the stamp lands with a quick press (scale 1.25 → 1,
  160 ms, with a light `expo-haptics` tap). The "Logged" stamp (`LoggedStamp.tsx`) already has this feel.

**Size:** small. One component, both themes to check.

## 2. A line of the review on the ticket

**On the website:** a ticket shows the first line of your review under the title, unless the review has
spoilers. The diary reads like a diary, not just a list.

**In the app today:** a `reader-outline` icon says a review exists, but not what it says.

**What to do:** in `TicketStub`, when `entry.review` has text and `entry.spoilers` is off, add one line of
`plainText(entry.review)` (from `@/lib/richText`) in `theme.textMuted`, `numberOfLines={1}`, under the stars
row. Drop the review icon when the line shows. Keep the icon for spoiler reviews.

**Size:** small. Check that a month still fits in a screen or two; if tickets grow too tall, show the line
only in the list layout's wide mode, or behind a Settings switch.

## 3. "Show time" on Home, with Reel

**On the website:** Reel sits beside "Good morning, Maya" holding a small paper ticket with the time of day:
MORNING SHOW (5 am to noon), MATINEE (to 5 pm), EVENING SHOW (to 10 pm), LATE SHOW (after). He spins once
when tapped (`HomeReel` in `Watch Heart Web/src/pages/Home.tsx`).

**What to do:** see Reel below. The ticket alone (no Reel) is also a nice small touch under the greeting, if
Reel waits.

**Size:** small once `Reel.tsx` exists.

## 4. Full cast and crew

**On the website:** the Title page's "Cast" row ends in "All cast and crew", a sheet with everyone, grouped
by department (directing, writing, camera, music and so on).

**In the app today:** the title page shows the top of the cast and "By the same director", but no full list.

**What to do:** a `BottomSheet` (the app's own `src/components/BottomSheet.tsx`) from the title page, using the
same TMDB credits call the cast row uses, with sections by department and the same person rows. Tapping a
person opens their page, as the cast row does.

**Size:** medium.

## 5. People you might know on Home

**On the website:** while you have fewer than five friends, Home shows "People you might know" (up to six)
under Friends lately, with an Add button on each.

**In the app today:** suggestions only appear inside people search (`components/friends/PeopleSearch.tsx`,
`suggestPeople()`), so most people never see them.

**What to do:** a short horizontal row on Home, after `FriendsRow`, shown only under five friends and only
when `suggestPeople()` returns someone. Reuse the person card from `PeopleSearch`. Hide it for good once you
have five friends.

**Size:** small to medium.

## 6. Plan a watch: calendar reminder

**On the website:** "Plan a watch" on a title page adds it to the watchlist with "Planned for …" and offers
Google Calendar and an .ics file.

**In the app today:** `MovieNight.tsx` plans a movie night on the phone.

**What to do:** add "Add to calendar" to a planned movie night. Sharing an .ics file through the share sheet
works with what's already in the app. A direct calendar entry needs `expo-calendar`, a native module, so
**that part needs a new APK and Play build**, not an OTA update.

**Size:** small with .ics; medium with `expo-calendar` plus a release.

## 7. Search order by popularity

**On the website:** the top bar search and Find rank results by how well the name matches, then by TMDB
popularity, so the well-known title with a name comes first, not an obscure one with the same name
(`Watch Heart Web/src/data/searchAll.ts`; it makes one extra `search/multi` call, because the app's `Title`
type drops popularity).

**What to do:** move that ranking into the app's own `src/lib` (it's plain TypeScript), use it in the app's
search, and have the website import it from there through its `@/` alias, so both stay the same.

**Size:** small. Note: changes to the app's `lib` change the website too; run `npm run typecheck` in Watch
Heart Web afterwards and republish it.

## Reel, the mascot

Full plan: [reel-mascot-plan.md](reel-mascot-plan.md). In short:

- **Who:** the app icon's gold reel come alive. Two holes are his eyes, the bottom hole is his mouth, and the
  heart sits in the middle. No arms, legs or outline.
- **Moods:** idle (blinks, heart beats), look (leans toward what you type), shy (eyes shut while you type a
  password), oops (a small "oh" and a shake on errors).
- **How:** a new `src/components/Reel.tsx` built from Views like `SplashOverlay.tsx`, with no SVG library,
  so it ships OTA.
- **Where, first:** welcome, account sign in, empty pages (`EmptyScene.tsx`), Diary didn't load
  (`DiaryLoadFailed.tsx`), and now the Home greeting with his show-time ticket (item 3 above).
- **Where, later:** the end of a recap ("That's a wrap!"), milestones, and maybe as a signature on story
  images.
- **Not:** the tab bar, the Log button, every logged stamp, pull to refresh.

## Already in the app (nothing to bring over)

The website copied these from the app: ticket paper tinted by kind, the gliding gold line on the current tab,
filled tab icons with their cut-outs, "By the same director", the poster picker, the episode sheet, friends
who watched a title, the story studio and the import logos.

Website-only, and not needed on a phone: the Back button (Android has its own), "Keep me signed in", the
corner doodles, keyboard shortcuts and the table layout of the diary.

## Suggested order

1. Loved stamp (1) and the review line (2): small, seen every day, no Reel needed.
2. `Reel.tsx`, then his Step 1 places, including the Home show-time ticket (3).
3. People you might know on Home (5) and search order (7).
4. Full cast and crew (4).
5. Calendar reminder (6), with the next APK and Play release.

## For Inigo to decide

- The loved stamp: ink pink as on the website, or the kind's own colour (gold, teal, pink)?
- The review line on tickets: always, or a Settings switch?
- Reel on Home every day, or only on the first visit of the day?
- Which of these go in the next OTA update?
