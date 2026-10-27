# Cloud sync setup (Supabase, free plan)

Watch Heart works without this; the diary then stays on the phone. These steps turn on accounts and
sync. They take about 10 minutes, once.

## 1. Create the project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name `watch-heart`, a strong database password (save it in your password manager; the app never
   needs it), and the same region as Prompt Heart's project. Plan: **Free**.

## 2. Create the tables

**SQL Editor → New query**, paste all of [schema.sql](schema.sql), **Run**. It's safe to run again.

## 3. Email codes (sign-up and forgot password)

Reuse Prompt Heart's Resend setup; the domain is already verified, so there's nothing new to set up there.

1. **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:

   | Field | Value |
   |---|---|
   | Sender email | `no-reply@mail.tosstheworld.org` |
   | Sender name | `Watch Heart` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | a Resend API key (the same one as Prompt Heart's, or a new one at resend.com → API Keys) |

2. **Authentication → Emails → Templates**: for **Confirm signup** and **Reset password**, paste the
   matching file from [email-templates/](email-templates/) into **Message body** and set the subject
   (it's in the comment at the top of each file). Or apply both at once with
   [apply-email-templates.mjs](apply-email-templates.mjs).
3. **Authentication → Providers → Email** (or **Sign In / Providers**): **Confirm email** on, and
   **Email OTP Length** 6.

## 4. Connect the app

**Project Settings → API**: copy the **Project URL** and the **publishable** key (`sb_publishable_…`).
Both are public by design; they ship inside the app, and Row Level Security keeps each person's data
private. Never use the `service_role` / secret key in the app.

For builds and updates (EAS), from the project folder:

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-REF.supabase.co --environment preview --environment production --visibility plaintext --non-interactive
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_YOUR_KEY --environment preview --environment production --visibility plaintext --non-interactive
```

For `npx expo start` on your PC, put the same two lines in `.env.local` (it's gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Then publish an update (`eas update --channel preview --environment preview`) and the installed app
gets **Settings → Account & sync**.

## 5. Keep the free project awake

Free projects pause after a week without activity. [.github/workflows/keepalive.yml](../.github/workflows/keepalive.yml)
reads the database once a day. Give it the URL and key as repository variables:

```bash
gh variable set SUPABASE_URL --body https://YOUR-REF.supabase.co
gh variable set SUPABASE_PUBLISHABLE_KEY --body sb_publishable_YOUR_KEY
```

## How sync works

- Each diary entry and watchlist item is one JSON row (`data`), private to its owner.
- Changes sync about a second after you make them (at most once a minute), when the app opens or goes
  to the background, and live when another device changes something.
- Conflicts: the most recent edit wins. Deleting for good leaves a tiny tombstone so other devices
  delete it too.
- Signing out keeps the diary on the phone, or removes it if you choose; the account keeps everything.
- **Delete account** in the app deletes the account and all its rows (`delete_my_account()`).
