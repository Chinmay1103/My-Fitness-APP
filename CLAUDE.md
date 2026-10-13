# My-Fitness-APP

A free, Whoop-style companion app for the Fitbit Air: Strain / Recovery / Sleep scores plus an
AI coach that also knows the user's workouts and meals. Built by Chinmay (engineering background,
rusty on hands-on coding) together with Claude. Explain changes in plain terms and keep steps
concrete; Chinmay runs the app on his phone and judges how the scores feel.

Full plan: [docs/ROADMAP.md](docs/ROADMAP.md). Run instructions: [docs/SETUP.md](docs/SETUP.md).
Open design to-dos from the Sep 30 screen-recording review: [docs/design-review-2026-09-30.md](docs/design-review-2026-09-30.md).

## Decisions so far

- **Android first** (Health Connect); iOS (HealthKit) later from the same Expo codebase. All health
  reads go through the `HealthSource` interface in `apps/mobile/lib/health/`, so adding a platform
  means adding one source. `pickHealthSource()` uses Health Connect once it's reachable and the
  core reads are allowed, else demo data. The library is loaded lazily: importing it in Expo Go crashes.
- **Demo data until the Fitbit Air arrives** (launches Oct 2, 2026). `generateMockDays()` in
  `packages/scoring/src/mock.ts` produces seeded, realistic days. First job once the band arrives:
  check which data types it actually writes into Health Connect.
- **Math computes scores, AI only explains them.** Scores must stay deterministic and tested.
- **Backend: Supabase.** Schema in `supabase/migrations/` (RLS on every table; deploy with
  `npm run db:push`). The app talks to it through `apps/mobile/lib/supabase.ts` (null when `.env` is
  missing, so the app still runs), signs in with Google or an email code (`app/account.tsx`, `lib/googleSignIn.ts`; PKCE, the session stays saved until Sign out; the Google button shows once Google is enabled in Supabase), and uploads one
  summary row per day (`lib/sync.ts`); raw heart rate and demo data never leave the phone. The
  Claude API is called only from Supabase Edge Functions; API keys never ship in the app.
- **Native modules that throw on import** (Health Connect, AsyncStorage) are loaded lazily behind a
  `TurboModuleRegistry.get` check, so an older build or Expo Go doesn't crash.
- **The coach gives wellness guidance, not medical advice.**
- **Light and dark mode** (Oct 10): System / Light / Dark on the Account screen (`lib/theme.tsx`).
  Screens get colors from `useColors()` / `makeStyles((c) => ...)`, never a fixed palette; only
  code outside React (widget, notification) uses `palettes.dark`.
- **Flat cards, drill-down everywhere** (Oct 10): cards are one solid fill and a hairline border (no
  glass, lit edges or ring glow); gradients stay on rings and charts. Every card, number and chart
  should open something deeper: `Card` takes `href`/`onPress` (title-row link, or `wholeCard`),
  `Stat` and `BreakdownFactor` take `onPress`, and day-by-day charts show `OpenDayLink` to switch the
  screen to the scrubbed day. Sleep-score parts open `app/trend/[key].tsx` (`lib/trends.ts`).
- **Battery**: backgrounds settle after 2 min (`motion.backgroundMotion`); live heart rate stops
  itself after 30 min, or after 10 min without the band, unless the heart-rate alert is on.

## How the scores work (`packages/scoring/src/`)

- **Strain (0–21)** `strain.ts`: Banister TRIMP over heart-rate-reserve fraction; time below 30% of
  reserve is ignored; gaps over 5 min aren't counted; `21 * (1 - e^(-TRIMP/120))`. A logged workout
  with an effort rating (from the coach) tops up what heart rate missed: session RPE
  (effort × minutes × 0.25) minus the heart-rate TRIMP in its window, never less (`effortStrain`).
- **Sleep (0–100)** `sleep.ts`: `sufficiency * (0.7 + 0.3 * quality)`. Hours vs. need sets the
  ceiling; quality (efficiency, deep+REM share, bedtime consistency) can only take points off.
  Need = base (8h) + extra after strain > 8 + a third of the last 3 nights' shortfall (capped at 60
  min). Shortfall is measured against the *base* need, or debt ratchets up to the cap.
- **Recovery (0–100)** `recovery.ts`: z-scores of ln(HRV) and resting HR against a robust
  (median/MAD) 30-day personal baseline, plus sleep; `sigmoid(0.3 + combined)`. No score before 4
  days of history; flagged "calibrating" until 14. Breathing rate joins (weight 0.1, taken from HRV
  and resting HR) once it has 4 nights of history. Median/MAD, z clipping and the sigmoid are there
  deliberately: Fitbit-based scores in other apps swing to extremes.

**Learned sleep need** (`personal.ts`): after 14 nights, the base need moves from 8 h towards the
median sleep before your best-recovery third of mornings (blended by nights/(nights+14), 6.5–9.5 h);
the app scores twice (default, then learned). **Insights** (shown, never scored): `bodyCheck.ts`
(skin temp, breathing, resting HR vs 30-night robust baseline; 2+ raised = alert), `load.ts`
(7-day vs 28-day TRIMP ratio), `habits.ts` (next-morning recovery and sleep with vs without each
habit), `week.ts` (week summary + rule-based focus), `lifts.ts` (progressive overload: each exercise's
best set by estimated max (Epley, reps capped at 12; bodyweight moves by reps), first vs latest session
→ progressing / holding (±2%) / slipping, "new bests" = sessions that beat every earlier one; muscle
from the exercise name by keyword rules, `muscleFor`).

Display-only metrics (`steps.ts`, `activity.ts`): `combineSteps` merges band and phone steps per 5
min and drops ghost steps (band-only, flat heart rate, low cadence); phone-only steps count only when
the band was off (no heart rate or band steps within 10 min), else they're the same walk filed in a
neighbouring window (`phoneOverlap`; before Oct 12 they were added and totals beat both devices); Active Zone Minutes the Fitbit
way (1/min fat burn, 2/min cardio and peak; 150 a week).

**Workouts** (`workout.ts`, display only): `analyzeWorkout` measures a logged workout over exactly its
start-to-end time: zones, TRIMP, strain of the workout alone (same TRIMP + effort top-up rule as the
day, breakdown by zone + effort), the 1-10 effort heart rate alone matches, and calories: 1 MET
resting (1 kcal/kg/h) + Keytel 2005 per zone above it (below zone 1 blends from rest to the formula's
value at 30% reserve) + Compendium METs for minutes without heart rate. Uses the weigh-in before it,
age from `profiles.birth_date`, `profiles.sex` (formulas averaged when unknown); defaults are flagged.

**Body age** (`bodyAge.ts`, display only, Whoop-Age style): last 30 days, needs 14 days of band data.
Nine factors (VO2max est. by Uth 15.3×maxHR/RHR vs FRIEND age-sex norms, resting HR, steps, moderate
40–60% and vigorous 60%+ HRR minutes/week, logged strength minutes/week, sleep hours, bedtime SD, BMI)
each map to a published all-cause-mortality hazard ratio; years = 0.5 × 8 × log2(HR) against a
typical adult (0.5 for overlap between factors), ±3 y per factor, ±10 total, shared out so they sum
to the difference. Levers = years at a realistic target. Screen `app/body-age.tsx`, Today card,
wording in `lib/bodyAge.ts`. Birth date, sex and height are set on Account (`components/AboutYouCard.tsx`,
the one profile form; logging still goes through the coach) or by telling the coach.

When changing a formula, check the numbers on mock data still look like a real Whoop week, not
just that tests pass.

Every score also returns a **breakdown** that adds up exactly to it (recovery: typical night +
factor points; sleep: hours ceiling − quality penalties, plus need = base + strain + debt; strain:
activities + everyday movement). The app shows these as "WHY 81%" cards, worded in
`apps/mobile/lib/insights.ts`. Keep breakdowns summing to the score; `tests/breakdown.test.ts` checks it.

## Layout

- `packages/scoring/`: pure TypeScript scoring and mock data, Vitest tests. Consumed as source
  (`main: src/index.ts`), no build step.
- `apps/mobile/`: Expo SDK 57 app with expo-router. **Today is the dashboard**: rings, Next steps
  (`lib/nextSteps.ts`, rule-based), the latest coach note, then a tile per metric (`lib/metrics.ts`:
  definitions, per-day values, "your usual" range). Every tile opens `app/metric/[key].tsx`. Logged
  workouts, meals, weigh-ins and habits are read back from Supabase in `lib/logged.ts`. Explore
screens: `app/weekly.tsx`, `app/body-check.tsx`, `app/habits.tsx`, `app/workouts.tsx`. The morning
summary (`lib/morningSummary.ts`) is a background task defined in `index.ts`; switched on from Account. Tabs live in `app/(tabs)/`: Today (`index.tsx`),
  Sleep, Strain, Coach; `app/recovery.tsx` is the Recovery detail screen; `app/heart-rate.tsx` is the
  all-day heart rate screen (opened from the Today card `components/HeartRateCard.tsx`). It re-reads
  today's heart rate every minute while open (`lib/heartRate.ts`; Health Connect only gets the band's
  data in batches via Google Health, so it's near-live, not live). Night heart rate lives in
  `DayData.sleepHeartRate` and never counts toward strain. A per-day heart-rate summary
  (`summarizeHeartRate`: low/avg/high, hourly averages) is synced in `daily_summaries.heart_rate` for the coach.
  **No logging forms or Log tab** (Chinmay's call, Oct 1). **The coach is the Claude app, not an
  in-app chat** (Chinmay has no paid Claude plan or API key): the Coach tab opens a new claude.ai chat
  with just the question (`lib/claudeHandoff.ts`; the latest scores are synced first and Claude reads them through the connector, so no numbers show in the chat). The user can save one chat's link (`lib/coachChat.ts`); then questions go to that chat instead, copied to the clipboard to paste, since claude.ai links can't prefill an existing chat (`lib/clipboard.ts`, loaded lazily). The **coach connector** (`supabase/functions/mcp/`, an
  MCP server; free plans allow one custom connector) lets that chat read the scores and record workouts
  and meals the user types or speaks. Claude signs in via Supabase Auth's OAuth server; the consent page
  is `docs/oauth/consent.html` on GitHub Pages (Edge Functions can't serve HTML). Type-check it with
  `npx deno check` in that folder; setup steps in docs/SETUP.md. Claude joins the scores with the
  logged workouts and meals into a **coach note** (`save_daily_note` -> `daily_notes` table) that the
  Today screen shows under the rings (`lib/coachNote.ts`, `components/CoachNoteCard.tsx`). The note
  explains; it never changes a score. `lib/workouts.ts` holds the workout model
  and matches workouts to band-detected activities. `app/workout.tsx` is one workout: how hard you pushed
  (WHY strain by zone) and calories (WHY kcal), from `lib/workoutAnalysis.ts`; the per-workout numbers are
  synced in `daily_summaries.extras.workouts` for the coach's list_workouts. "What led here" sentences
  (`lib/why.ts`, `components/WhyCard.tsx`) sit on Recovery, Sleep and every metric screen. The real
  profile (birth date, max HR, sex, height, protein/calorie targets) is read in `lib/profile.ts` and used
  for scoring and Next steps (demo data keeps `MOCK_PROFILE`). "Late" meals/workouts in `lib/why.ts`
  mean within 2 h of that night's bedtime. Sleep debt over several days is summed with
  `nightShortfall` (need minus its own debt payback), never need − asleep. Shared data comes from
  `lib/ScoresProvider.tsx`; UI pieces live in `components/`;
  **live heart rate** (`app/live.tsx`, `lib/liveHeartRate.ts`) reads the band's standard Bluetooth
  heart-rate signal ("Share heart rate" in Google Health) via react-native-ble-plx, kept alive in
  the background by a foreground service (react-native-background-actions; service type set in
  `plugins/withLiveHeartRateService.js`). It's for watching, never for scores. The Android
  home-screen **Heart rate widget** (`lib/heartRateWidget.ts`, drawing in `lib/widget/`,
  react-native-android-widget) is registered in the entry file `index.ts`. The **heart-rate alert**
  (`lib/heartRateAlert.ts`, rule `sustainedAbove()` in scoring) messages a chosen contact when live
  heart rate stays above a limit for 2 min, on WhatsApp via CallMeBot (Chinmay's pick; WhatsApp
  doesn't allow tap-free sending from his own account). **No SMS** (removed Oct 10): Android blocks
  SEND_SMS for sideloaded apps and Play Protect flagged the app as harmful because of it. Design tokens (colors, gradients,
  fonts, motion) in `constants/theme.ts`. Charts are in `components/charts/` (bars, line, combo, donut, sleep-stage
  hypnogram; all react-native-svg, no chart library). The background behind every screen is either
  **Scenes** (bundled photos per time of day, `components/SceneBackdrop.tsx`; dark mode only, light
  mode shows Plain instead), **Aurora** (moving lights) or **Plain** (`components/PlainBackdrop.tsx`,
  a still color wash), picked on the Account screen (`lib/backgroundStyle.ts`); the tab bar is
  `components/TabBar.tsx`.
  **Swiping** (`components/Swipe.tsx`, plain PanResponder): left/right anywhere on a tab screen changes tab;
  on the score rings (`DayPager`) it changes day. The picked day (`dayBack`, `useSelectedDay()` in
  `lib/ScoresProvider.tsx`) is shared by Today, Sleep, Strain, Recovery and Heart rate. Use tokens, not raw hex, in screens.
  Visual direction: `design-system/my-fitness-app/MASTER.md` (made with the ui-ux-pro-max skill in
  `.claude/skills/`; its "Project decisions" table overrides the generated parts). Rings and charts
  animate via Reanimated and skip motion when the phone's "reduce motion" setting is on; haptics go through
  `lib/haptics.ts`. Fonts: Inter for words, Barlow Condensed only for numbers;
  on Android pick weights by `fontFamily` only (no `fontWeight`).
  Also read `apps/mobile/AGENTS.md`: Expo APIs change every SDK, so check the installed version's
  docs or types, not memory.
- `apps/web/`: the **website** (Oct 10), Vite + React (react-dom, not React Native: the phone screens
  are built around Health Connect and touch, the website around wide screens and long ranges).
  Read-only view of the cloud copy (`daily_summaries`, workouts, meals, weights, habits, notes,
  weekly reports) over any range (30 days to all time), since the phone only sees 30 days. Pages:
  Overview, Progress (road to the goal weight, food vs daily targets with each day's meals, each lift's
  sets per session with "go up a step" at 12 reps, training calendar; `src/lib/progress.ts`; goals are
  `profiles.goal_weight_kg` / `calorie_target` / `protein_target_g`, set by telling the coach), Trends (any metric + "compare two things" scatter, no line or verdict under 14 days),
  Sleep, Training (progressive overload per muscle and exercise, `components/Overload.tsx`), Body & food, Habits,
  Reports (weekly/monthly table, CSV, print), and a day panel (`?day=` in the hash). Same sign-in,
  same Supabase project and tokens (`src/styles.css` mirrors `constants/theme.ts`; keep them in step),
  installable as an app (manifest + `public/sw.js`). Charts are hand-drawn SVG in
  `src/components/charts/` (one `TimeChart` for lines/bars/stacks/ranges, `Calendar`, `Scatter`),
  following the dataviz skill: one y axis, legend for 2+ series, hover readout, click opens the day.
  Report math in `src/lib/stats.ts` (tested in `apps/web/tests/`); it reuses `@fitness/scoring`
  (`habitImpact`, `trainingLoad`) and the phone's wording in `apps/mobile/lib/insights.ts`. Demo mode
  (`src/lib/demo.ts`) shows a made-up year. The phone's sync sends display-only `extras` (steps, zone
  minutes, SpO2, breathing, skin temp, energy, sleep stages) for it, and backfills older days the
  cloud is missing. Built into `docs/web/` (committed; GitHub Pages serves it at `/web/`) with
  `npm run web:build`.

## Commands (run from the repo root)

```bash
npm install          # npm workspaces
npm test             # scoring and website tests
npm run typecheck    # all workspaces
npm run mobile       # dev server for the app's own build (development build)
npm run mobile:go    # same, for Expo Go (no Health Connect)
npm run web          # the website on http://localhost:5173
npm run web:build    # build it into docs/web (commit that folder too)
```

In `apps/mobile`, add packages with `npx expo install <pkg>`, not `npm install`.
On Windows PowerShell, call `npm.cmd` / `npx.cmd` if script execution policy blocks `npm`.

## Milestone status

| # | Milestone | Status |
|---|---|---|
| 0 | Setup | Runs on the phone; design review done; Supabase project live (Mumbai, schema pushed Oct 2, Gmail SMTP for sign-in codes, sign-in works on the phone). To do: verify Fitbit Air data types |
| 1 | Health Connect data in | Band arrived Oct 3: heart rate flows from Google Health into Health Connect and strain scores on it; heart rate screen added. To do: check sleep, HRV and resting HR after the first nights |
| 2 | Scores + Today rings | Done on demo data; tune against real data |
| 3 | Logging: workouts, plans, meals (AI macros) | Merged into 4: the user types or speaks what they did or ate in the Coach chat and the AI records it (no forms) |
| 4 | AI coach (in the Claude app; also does all logging) | "Ask Claude" handoff done; coach connector live (read scores; log/list/delete workouts, meals, weight; profile; daily coach note on Today; `get_coach_notes` so each new chat picks up from earlier days). App reads logged workouts (they count toward strain), meals and weight back (Oct 10). To do: deploy the mcp function (now asks for workout effort) |
| 4c | Dashboard revamp (Oct 10) | Today dashboard with Next steps + metric tiles and drill-downs, phone+band steps, rebuilt hypnogram, light mode, battery limits. Then: flat cards, Plain background (light mode no longer shows the photos), drill-down links on every card and chart, sleep-part detail screens, tap/drag to read the live heart-rate graph. Needs a new EAS build (Weight permission, `userInterfaceStyle: automatic`); then check on the phone which device Health Connect labels steps with (Health data screen) |
| 4b | Live heart rate + home-screen widget + heart-rate alert (WhatsApp) | Code ready (Oct 6–7); needs a new EAS build and a test with the band |
| 5 | Trends, weekly report, notifications, MCP server | Done Oct 10 (needs a build to test): body check, training load, learned sleep need, habits, weekly report (Claude writes it via `save_weekly_report`), workout history with lift progress, morning summary notification (background task, Health Connect background read). App icon from the logo-designer skill (`logos/`) |
| 4d | Workout effort + calories, "why" everywhere (Oct 12) | Code ready: workout screen, steps double-count fix, real profile in scoring, connector `update_workout` + half-point effort + sex. To do: `npm run db:push` (sex column), redeploy the mcp function, have the coach add effort ratings to past workouts and your birth date and sex |
| 4e | Bug sweep + body age (Oct 13) | Fixed: training load counted pre-band days as zero (false "too much too soon"), pre-midnight sleep heart rate counted as daytime, empty days synced, Today next steps and morning summary used the demo profile. Added About you (birth date, sex, height) and body age. To do: `npm run db:push` (height), redeploy mcp, new build; body age appears after 14 days of band data (about Oct 17) |
| 4f | Full check on real data (Oct 13) | Report: [docs/bug-report-2026-10-13.md](docs/bug-report-2026-10-13.md). Fixed double-counted sleep debt, late meals vs bedtime, protein target, website skips empty pre-band rows. Same to-dos as 4d/4e |
| 6 | Website (long-range trends and reports) | Built Oct 10 (`apps/web/`, tried on demo data); extras column and goals (Oct 11) pushed, connector redeployed. Progress page added Oct 11. To do: install the Oct 11 preview build, tell the coach the goals, check the site at chinmay1103.github.io/My-Fitness-APP/web/ with real data |

Keep this table up to date when a milestone moves.
