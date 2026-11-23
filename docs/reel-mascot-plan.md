# Reel in the Android app: plan

Draft, 2026-11-23. Reel is live on the website (watchheart.in): on sign in and registration, and in every empty
or missing page. This plan brings him to the app.

## Who Reel is

Reel is the app icon come alive, not a separate cartoon:

- the gold reel from the logo, with its six holes and the pink heart in the middle;
- the two upper holes are his eyes, with a small cream glint;
- the bottom hole is his mouth: a smile, or a small round "oh";
- no arms, legs, outline, blush or clothes (the first web version had them and looked generic);
- a strip of film can unspool from him along the floor, on big moments only.

His moods, the same as the website's:

| Mood | Looks like | When |
|---|---|---|
| idle | smiling, blinks every few seconds, heart beats now and then | default |
| look | leans toward the field, glints follow the text | typing an email, a search |
| shy | turns away, eyes shut into curves | typing a password |
| oops | mouth becomes a small "oh", a little shake | an error, something missing |

The website's drawing is `Watch Heart Web/src/ui/Mascot.tsx` (SVG). Its proportions come from the app icon:
holes 16.7 and 47.8 from the middle on an 80 radius reel, which is 77/368 and 220/368 of the icon.

## How to draw him in the app

The app has no SVG library. `src/components/SplashOverlay.tsx` already draws the reel from plain Views (disc,
holes, heart from two circles and a diamond), measured from the 1024 px icon. Reel should be built the same way:

- **New file `src/components/Reel.tsx`**: props `size`, `mood`, `look` (0 to 1), `film` (on or off).
  Reuse the splash's measurements, ideally by moving them into a shared `src/lib/reelShape.ts` used by both.
- **Eyes**: two of the holes as Views; "shut" is a thin curved border View swapped in with a quick fade.
- **Mouth**: the bottom hole clipped to its lower half (smile), or a small circle ("oh").
- **Film**: the app's own `Sprockets` from `src/components/Film.tsx` on a dark strip, ending in a fade.
- **Motion**: React Native `Animated` with the native driver, as `Motion.tsx` and the splash already do:
  rotate for leaning, scaleY for a blink, scale for the heart beat, translateX plus rotate for rolling in.
  With Reduce motion on (`AccessibilityInfo.isReduceMotionEnabled`), no rolling, blinking or beating; mood changes
  still show, instantly.
- **TalkBack**: decorative, so hidden (`importantForAccessibility="no-hide-descendants"`); the words beside him
  carry the meaning.

Because this needs no new native module, it ships as an over-the-air update (`eas update` to the five
runtimes), with no new APK or Play release. Adding `react-native-svg` to reuse the web drawing as is would
need a new build, so drawing with Views is the better route.

## Where he goes

### Step 1: the same places as the website

1. **Welcome** (`src/app/welcome.tsx`, the `Intro` step): Reel rolls in on his film strip beside the first
   words, with "Grab a seat!" on a paper ticket.
2. **Account sign in** (`account.tsx`): look, shy and oops moods tied to the email and password fields and to
   errors, with the website's lines ("Welcome back!", "Check your inbox!" and so on). The phone keeps you signed
   in anyway, so no "Keep me signed in" choice is needed there.
3. **Empty pages** (`src/components/EmptyScene.tsx`, used by Diary, Lists, Recap and Watchlist): Reel holds up
   a small paper ticket with the scene's word, beside or instead of the blank ticket and empty strip. Decide on
   a phone which reads better.
4. **Diary didn't load** (`DiaryLoadFailed.tsx`): Reel in his oops mood.
5. **Home greeting** (added 2026-11-23, live on the website): a small Reel beside "Good morning", without his
   film, holding a ticket that says MORNING SHOW, MATINEE, EVENING SHOW or LATE SHOW by the hour; a tap spins
   him once. Home is opened often, so he only pops in quietly here, with no rolling or talking. See
   `docs/web-features-for-app.md`, item 3.

### Step 2: rare, happy moments (once Step 1 feels right)

- **Year and month recaps**: Reel at the end of a recap, film strip out, "That's a wrap!".
- **Milestones**: 100th viewing, a year goal reached, a long streak: a short Reel moment with a light haptic
  (`expo-haptics`, already in the app).
- **Story images**: an optional small Reel on shared recap stories, as a signature.

### Where he should not go

Places used many times a day: the tab bar, the Log button, every logged stamp, pull to refresh. A character
there turns from a welcome into a delay. No talking tutorials either; Reel says a few words at most.

## Checking it

- Dark and light themes, on a small phone and a large one.
- Reduce motion on: still, but moods still change.
- TalkBack: Reel is skipped, the text is read.
- The welcome flow from a fresh install, signing in with a wrong password (oops), and each empty page.
- After the OTA update, every runtime picks it up (HANDOFF's release steps).

## For Inigo to decide

- Keep the name **Reel**?
- Should Reel also go on the Play Store screenshots and feature graphic, and on the info site at
  heartapps.github.io/watch-heart?
- Step 1 only for now, or Step 2 as well?
