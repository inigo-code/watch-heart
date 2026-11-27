# Watch Heart's mascot: a character, not a thing

Inigo's call (2026-11-27): Reel, the reel come alive, read as a "drishti bommai" to a tester. The mascot became
an anime-style girl, in the spirit of Crunchyroll's Hime but entirely our own: not her face, hair, outfit or pose.
She replaced Reel everywhere Reel appeared, in the app and on watchheart.in. Inigo picked the chibi design
over a taller anime one, then asked for the logo's colours on her.

## Who she is

- **Name:** not chosen yet. Ideas: Tara (star), Chitra (picture), Mira, Nila. The code calls her `Mascot`.
- **Feel:** a cheerful film fan who logs everything she watches. Warm, a little dramatic, never mean.
- **Look (chibi):**
  - Warm brown skin, big dark-brown eyes.
  - Long black hair in a high ponytail, a pink scrunchie, and a gold clip shaped like a ticket stub.
  - A gold cardigan (`#F2B84B`) with black cuffs and hem. On it, a round pin of the logo: a gold reel with a
    pink heart in the middle.
  - Black tee with a small pink heart, black pleated skirt, black tights, black sneakers with pink laces.
  - A popcorn bucket in gold and black stripes with a pink heart.
- **Colours:** the logo's. Gold `#F2B84B`, heart pink `#FF4D6D`, ink `#120F08`, cream `#F4EFE6`.

## Poses

All six are in `assets/mascot/*.webp` (640 px on the longer side, 42 to 55 KB each, cream sticker edge).

| Pose | App | watchheart.in |
|---|---|---|
| `hello`: winking and waving, popcorn bucket | Welcome, Account sign in | Sign up and "Check your inbox", most empty pages |
| `welcome`: holding up a blank ticket | (not used yet) | Sign in |
| `diary`: sitting with an open blank diary | Empty Diary and lists (`EmptyScene` ticket) | Empty Diary, no lists yet |
| `asleep`: on a black beanbag, hugging the popcorn | Empty Watchlist and Recap (`EmptyScene` strip) | Empty Watchlist, Recap, list, a friend's private diary |
| `oops`: sweat drop, popcorn flying | Sign-in error, "Couldn't open your diary" | Sign-in error, Forgot password, missing pages |
| `cheer`: jumping, popcorn bursting | (not used yet) | Empty Trash ("All clear"), New password |

She stays a still drawing. She fades and rises in (360 to 420 ms), and gives a small shake when she turns to
"oops". With reduced motion she just appears. Screen readers skip her; the words beside her carry the meaning.

## How the drawings were made

1. Gemini (Inigo's account, chat "Chibi Indian Film Fan Mascot"), image generation. The first prompt described
   the whole character in a chibi sticker style on a plain white background. Each pose after that said "this
   exact girl in her golden-yellow outfit (gold cardigan with black cuffs, film-reel pin, pink scrunchie, black
   sneakers with pink laces)", then the pose, then "Full body, plain white background, no text." Short prompts
   worked; long ones sometimes failed with "Something went wrong".
2. Full-size downloads (1792 × 2400, or 2400 × 1792 for asleep). Frame Heart found no visible Gemini mark on
   them, and the corners were checked by eye.
3. `scripts/mascot-sticker.py IN.png assets/mascot/NAME.webp` cuts her out and adds the cream edge (run it
   with Frame Heart's `.venv` Python, which has Pillow and numpy). The full-size PNGs are in Inigo's Downloads
   as `Gemini_Generated_Image_*.png`; they're not in the repo (about 5 MB each).

A new pose: same chat, same prompt shape, then the script.
