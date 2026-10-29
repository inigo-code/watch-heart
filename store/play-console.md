# Play Console answers

Answers for the forms under Play Console → Policy → App content, based on what the app actually does.
If the app changes (new data, a new SDK, ads), update these and the [privacy policy](https://inigo-code.github.io/watch-heart-site/privacy.html).

## Before you start

- **Every new app on a personal account needs a closed test first.** At least 12 testers have to opt in and stay opted in for 14 days in a row before you can apply for production access. This applies to Watch Heart even though Prompt Heart has been through it. You can reuse Prompt Heart's tester list or Google Group.
- **Package name:** `com.inigocode.watchheart`. It's permanent once uploaded, and it's the same package as the GitHub and F-Droid APKs. Android won't install a Play copy over a sideloaded one, because they're signed with different keys. Anyone switching has to back up or sign in, uninstall, then install from Play.
- **Signing:** EAS holds the upload key; keep Play App Signing on (the default) when you create the app.
- **First upload is manual.** Build with `npx eas-cli@latest build --platform android --profile production`, download the `.aab`, and upload it in Play Console. After that, `eas submit` can upload builds for you once a Google service account is set up.
- **Over-the-air updates:** Play builds use the `production` channel. From then on, publish each OTA to both `preview` (GitHub and F-Droid copies) and `production` (Play copy).

## Privacy policy

https://inigo-code.github.io/watch-heart-site/privacy.html

## App access

Choose **All or some functionality is restricted** and add instructions:

> The diary, search, watchlist, stories and everything else work without an account. An optional account (Settings → Account) adds sync across devices and Friends. Reviewers can sign in with the test account below. To see Friends, open Settings → Friends (or Friends on your profile); the test account already has a friend added.

Then add a test account's email and password. Create two accounts in the app with addresses you control, log a few titles on each, and make them friends with the invite code, so a reviewer sees Friends working. Keep them for reviews. Don't use your personal account.

## Ads

**No**, the app doesn't contain ads.

## Content rating

Category: **Utility, Productivity, Communication, or Other**. (Watch Heart is a diary, not a streaming or video app; it plays no video itself. Trailers open in YouTube.)

- Ratings-relevant content downloaded as part of the app package (code, assets)? **No**. Posters and synopses aren't bundled; they load from TMDB, with adult titles excluded.
- Violence: can the app contain violent material (the catalogue, not user content)? **Yes**. Posters, stills and synopses of horror, war and action films show or describe violence. These are pictures and text, not interactive. Realistic: yes. Blood: possible (horror posters). Graphic or gory: no.
- Sexual content, profanity, drugs, gambling, age-restricted products: **No**.
- Can users interact or exchange content with each other? **Yes**. Friends added with an invite code can see each other's diary, ratings, reviews, lists and profile photos. There's no chat, and strangers can't find you: it only works with a code you give out.
  - Is shared user-generated content the primary source of content? **No**
  - Public sharing of nudity, or of real-world graphic violence? **No** (nothing is public)
  - Can users block users or content? **Yes** (unfriend, or make a new invite code)
  - Can users report users or content? **No**
  - Chat moderation? **No** (there's no chat)
  - Can interactions be limited to invited friends only? **Yes** (always)
- Does the app show content from the internet? **Yes** (film data and posters from TMDB). Unrestricted web browsing: **No**
- Does the app share the user's location with others? **No**
- Can users buy digital goods? **No**
- Is it a web browser or search engine? **No**

Expected rating: Teen / PEGI 12–16 (film posters and synopses can show violence), with "Users Interact".

## Target audience and content

- Age groups: **13–15, 16–17 and 18+**. Don't select any group under 13, which would bring in the Families policy; the privacy policy says Watch Heart isn't for children under 13.
- Could the app unintentionally appeal to children? **No**

## News app / Government app / Financial features / Health

**No** to all.

## Data safety

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes.
**Do you provide a way for users to request that their data is deleted?** Yes. In the app (Settings → Account → your email → Delete account), and at https://inigo-code.github.io/watch-heart-site/delete-account.html

**Account creation:** username, password and other authentication (email and password, with a one-time code emailed at sign-up). Account deletion URL: https://inigo-code.github.io/watch-heart-site/delete-account.html

**Delete some data without deleting the account?** Yes: https://inigo-code.github.io/watch-heart-site/delete-account.html#some-data (diary entries, watchlist titles, lists, profile details, what friends see).

Data types. For each one: **Collected: yes. Shared: no. Processed ephemerally: no.**
- Supabase and Expo are service providers processing data on your behalf, which Google doesn't count as sharing.
- What friends see is shared because the user chose to share it. Google exempts sharing the user starts themselves.

| Data type (Play's category) | Required or optional | Purposes |
|---|---|---|
| Personal info → Email address | Optional (only with an account) | App functionality, Account management |
| Personal info → Name | Optional | App functionality, Account management |
| Personal info → User IDs | Optional (only with an account) | App functionality, Account management |
| Photos and videos → Photos | Optional (profile photo) | App functionality |
| App activity → Other user-generated content (diary entries, ratings, reviews, lists, watchlist, profile bio) | Optional (only with an account) | App functionality |
| App activity → In-app search history (what you search is sent to TMDB and TVmaze to find titles) | Required | App functionality |
| Device or other IDs (random install ID sent to Expo's update service) | Required | App functionality |

Everything else is **not collected**: location, contacts, messages, financial, health, audio, files, calendar, web history, app interactions, crash logs, diagnostics and other device info.

Kept only on the phone, so none of these go in the form:
- Who you watched with, and your tags. These do sync with an account, as part of the diary entry above, but friends never see them.
- Movie-night reminders, your region and language, and the widget's titles.
- Files picked for import.
- Your own TMDB key.

Why "Device or other IDs" is listed: Expo's update service (EAS Update) receives a random installation ID with each update check. It isn't used for tracking, but listing it is the safe reading of Google's rules. Why "In-app search history" is listed: the app sends search words straight to TMDB and TVmaze. You never see them, but they leave the phone because of your app, so listing it is again the safe reading.

## Permissions declarations

None needed: the app asks for no permission that has its own declaration form.
- **Notifications:** notification permission (POST_NOTIFICATIONS) for movie-night reminders, plus RECEIVE_BOOT_COMPLETED so a planned reminder survives a restart. There's no exact-alarm permission, so there's no alarm declaration to fill in.
- **Fingerprint lock:** biometric (USE_BIOMETRIC) for the optional App lock. Biometric data isn't collected: Android checks the fingerprint, face or PIN itself and only tells the app whether it passed.
- **Saving stories:** WRITE_EXTERNAL_STORAGE, which Android 9 and older use to save a story image to Photos.
- **Profile photos:** these come from Android's photo picker, which needs no permission. Camera, READ_MEDIA_IMAGES and READ_MEDIA_VIDEO are blocked in `app.json`, so there's no photo and video permissions declaration.
