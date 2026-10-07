# Setup: run the app on your Android phone

You only need to do steps 1–2 once.

## 1. Install tools on your laptop

- **Node.js LTS**: already installed (v24).
- **Git**: already installed.
- **VS Code extensions** (optional): "Expo Tools" and "ESLint".

## 2. Install Expo Go on your phone

Install **Expo Go** from the Play Store. Your phone and laptop must be on the **same Wi-Fi**.

## 3. Start the app

In VS Code, open a terminal (`` Ctrl+` ``) in the project folder and run:

```bash
npm install          # only after pulling new changes
npm run mobile       # starts the Expo dev server
```

A QR code appears in the terminal. Open **Expo Go** on your phone and scan it. The app loads
with **demo data** (45 days of realistic fake heart rate, HRV and sleep).

Edit any file under `apps/mobile/app/` and save; the phone updates in a second or two.

If the phone can't connect (office/college Wi-Fi often blocks it), run
`npx expo start --tunnel` from `apps/mobile` instead.

## 4. Run the scoring tests

```bash
npm test             # 31 tests for strain, sleep and recovery
npm run typecheck    # type errors across the whole repo
```

## Where things live

| Folder | What's inside |
|---|---|
| `packages/scoring/src/` | The math: `strain.ts`, `sleep.ts`, `recovery.ts`, plus `mock.ts` (fake data) |
| `packages/scoring/tests/` | Tests for the math |
| `apps/mobile/app/(tabs)/` | One file per tab: `index.tsx` (Today), `sleep.tsx`, `strain.tsx`, `log.tsx`, `coach.tsx` |
| `apps/mobile/components/` | Reusable UI: score rings, cards, bar charts |
| `apps/mobile/lib/health/` | Where health data comes from: demo data, or Health Connect in the app's own build |

## Your own build (needed for Health Connect)

Expo Go can't read Health Connect, so for real data you install the app's own **development
build**. It's an APK built in Expo's cloud (free tier, no Android Studio). You only rebuild it when
we add a library with native code; everyday code changes still reload over Wi-Fi like Expo Go.

**Once:**

1. Make a free account at [expo.dev](https://expo.dev).
2. From `apps/mobile`, log in and link the project:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init        # creates the project on expo.dev, adds its id to app.json
   ```
3. Start the build (10–20 minutes in the cloud):
   ```bash
   npx eas-cli@latest build --platform android --profile development
   ```
4. When it finishes, open the link or QR code it prints **on your phone**, download the APK and
   install it (allow "install unknown apps" for your browser when Android asks).

**Every day after that:** `npm run mobile`, then open **My Fitness** (not Expo Go) on the phone
and pick the dev server. Until the build is installed, use `npm run mobile:go` for Expo Go.

## Supabase (backend: sign-in and cloud backup)

The app works without this; it's needed for backup now, and for meal logging and the AI coach
later. Free tier is enough.

**1. Create the project** at [supabase.com](https://supabase.com): sign up, **New project**, name
it `my-fitness`, pick region **Mumbai (ap-south-1)**, and save the database password somewhere safe
(a password manager).

**2. Turn on email codes.** The default sign-in email only has a link, and the app signs in with a
code instead. Supabase only lets you edit the email after you set up your own sender (SMTP), so
send it through Gmail (free):

- Turn on 2-Step Verification in your Google account, then create an **app password** at
  [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
- Authentication -> **Emails** -> **SMTP Settings**: turn on custom SMTP. Sender email and username:
  your Gmail address; sender name `My Fitness`; host `smtp.gmail.com`; port `465`; password: the
  16-letter app password (no spaces).
- Authentication -> **Emails** -> **Magic link or OTP** *and* **Confirm signup** (a new email gets the
  second one on its first sign-in): subject `Your My Fitness sign-in code`, and in **Source** replace
  the body with:

```html
<h2>Your My Fitness sign-in code</h2>
<p>{{ .Token }}</p>
```

**3. Create the tables.** From the repo root:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # the ref is in the project URL
npm run db:push                                      # creates the tables from supabase/migrations/
```

`link` may ask for the database password from step 1.

**4. Connect the app.** In `apps/mobile`, copy `.env.example` to `.env` and fill in the two values
from **Project Settings -> API Keys** (the *publishable* key, never the secret one) and the project
URL. Restart `npm run mobile`.

**5. Sign in.** Today -> the person icon at the top right -> enter your email -> type the code. The
first emails may land in spam (Gmail address sent via Supabase); mark them "Not spam".

What's in the cloud: one summary row per day (resting HR, HRV, sleep times, the three scores and
their breakdowns). Raw heart-rate samples stay on the phone, and demo data is never uploaded, so
the table stays empty until the Fitbit Air data comes in. Every table has Row Level Security: each
account can only read its own rows.

> The development build started before Supabase was added doesn't include the part that remembers
> the sign-in, so there you'll sign in again after closing the app. The next build fixes that.

## Google sign-in (optional)

The Account screen shows "Continue with Google" as soon as Google is turned on in Supabase; no new
build needed. Until then it shows only the email code.

1. Google Cloud Console (console.cloud.google.com): create a project, then **APIs & Services ->
   OAuth consent screen**: External, app name "My Fitness", your email; add yourself as a test user.
2. **Credentials -> Create credentials -> OAuth client ID**, type **Web application**. Under
   "Authorized redirect URIs" add `https://uhbgogzfelkbnrqthutg.supabase.co/auth/v1/callback`.
   Copy the client ID and secret.
3. Supabase dashboard -> **Authentication -> Sign In / Providers -> Google**: turn it on, paste the
   client ID and secret, save.
4. Supabase dashboard -> **Authentication -> URL Configuration -> Redirect URLs**: add
   `myfitness://auth-callback`.

Signing in with Google using the same Gmail address as the email code gives the same account and data.

## Coach connector (Claude reads your data and logs workouts and meals)

The connector lets a chat in the Claude app read your scores and record what you tell it ("push
day, 45 min", "2 rotis and dal"). It's an MCP server in `supabase/functions/mcp/`; Claude signs you
in through Supabase with the page in `docs/oauth/consent.html`. A free Claude plan allows one custom
connector.

**Once:**

1. **Supabase -> Authentication -> OAuth Server:** turn it on, set the authorization path to
   `/oauth/consent`, and turn on **dynamic client registration**.
2. **Supabase -> Authentication -> URL Configuration:** set the Site URL to
   `https://chinmay1103.github.io/My-Fitness-APP`.
3. **GitHub -> the repo -> Settings -> Pages:** *Deploy from a branch*, pick the branch with this code
   and the `/docs` folder. After a minute,
   `https://chinmay1103.github.io/My-Fitness-APP/oauth/consent` shows "Start from Claude instead".
4. **Deploy the connector** (from the repo root):
   ```bash
   npx supabase functions deploy mcp --no-verify-jwt --use-api
   ```
   Redeploy the same way after changing `supabase/functions/mcp/index.ts`.
5. **claude.ai -> Customize -> Connectors -> Add custom connector:** name `My Fitness`, URL
   `https://uhbgogzfelkbnrqthutg.supabase.co/functions/v1/mcp`. If it asks how Claude registers,
   pick **Register automatically**. Click **Connect**, sign in with your email code, tap **Allow**.

**Using it:** in a chat, make sure My Fitness is on (**+** -> Connectors). Ask "how did I recover
today?" or say what you trained or ate. After Claude explains a day it saves a short **coach
note**, which appears on the Today screen under the rings when you switch back to the app. Scores show up once real band data has synced; demo data is
never uploaded.

## Day one with the Fitbit Air (milestone 1)

1. Set up the band in the Google Health / Fitbit app, and in its settings turn on syncing to
   **Health Connect** for everything it offers.
2. Wear it for a night so there's sleep, HRV and resting heart rate.
3. In My Fitness: Today → tap the **Demo data ›** pill → **Connect Health Connect** → allow all.
4. The **In Health Connect, last 7 days** list shows each data type, how many records exist and
   which app wrote them. Screenshot it and share it with Claude: that's the "which data types does
   the band write" check.
5. Once the four types marked *scores* have data, the pill says **Health Connect** and the rings
   use your own numbers. Recovery shows "calibrating" for the first two weeks.

## Live heart rate and the home-screen widget

Live heart rate reads the band over Bluetooth about once a second; the **Heart rate** widget puts
it on your home screen. Both need the build from Oct 6 or later (Bluetooth, widget and background
service are native code), so rebuild once: `npx eas-cli@latest build --platform android --profile development`.

1. In the Google Health app open **Fitbit Air › Share heart rate** and turn it on.
2. In My Fitness tap the heart icon on Today (or Strain › **Open live heart rate**), then **Start
   live heart rate**. Allow "Nearby devices" and notifications when Android asks.
3. A notification shows your heart rate while it runs; that is what keeps it going when you leave
   the app. Tap **Stop** when you're done, because sharing uses more of the band's battery.
4. **Add widget to home screen** on the same screen, or long-press the home screen › Widgets ›
   My Fitness › Heart rate. It updates every few seconds while live heart rate runs; otherwise it
   shows the newest reading from Health Connect and its time. Tapping it opens the Live screen.

If it can't find the band: check Share heart rate is still on, keep the band close, and make sure
no other app (e.g. a gym machine) is connected to it.

## Heart-rate alert (SMS + WhatsApp to a contact)

Needs the build from Oct 7 or later (it adds the SMS sender and contact picker), and live heart
rate running: the alert watches the live readings.

1. Live screen › **Heart-rate alert** › **Pick a contact**, choose the limit (110–130 bpm).
2. WhatsApp, once, on the contact's phone: add CallMeBot's number (on
   [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/); +34 623 75 84 18
   as of Oct 2026) and send it "I allow callmebot to send me messages". It replies with a key;
   type that key into the card. Without a key, only the SMS goes out.
3. **Turn alert on** (allow SMS when asked), then **Send a test message**.

Rule: heart rate at or above the limit for 2 minutes in a row; then at most one alert per 30
minutes. Turn it off before workouts, or it will fire during them.
