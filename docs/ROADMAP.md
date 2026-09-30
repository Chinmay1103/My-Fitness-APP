# My-Fitness-APP: Plan & Architecture

A free, Whoop-style companion app for the Fitbit Air (and later other trackers), with
**Strain / Recovery / Sleep** scores plus an **AI coach** that also knows your workouts
and food.

## 1. How the data reaches us

We don't talk to the Fitbit Air directly. The Fitbit/Google Health app syncs the band
and writes into the phone's health store, and we read from there. As far as we can tell,
that's also how Bevel works.

```
Fitbit Air ──BLE──▶ Google Health app ──▶ Health Connect (Android) / HealthKit (iOS)
                                                │
                                                ▼
                                        Our mobile app (reads)
                                                │
                                                ▼
                                Supabase (Postgres + Auth + Edge Functions)
                                                │
                                                ▼
                                   Claude API (AI coach, food parsing)
```

**Step zero is to check which data types the Fitbit Air actually writes into Health
Connect/HealthKit** (HR, HRV, resting HR, sleep stages, SpO2, steps, workouts). What we
can build depends on that list.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **React Native + Expo** (TypeScript) | One codebase for iOS and Android, and the easiest way back into coding |
| Health data | `react-native-health-connect` (Android), `@kingstinct/react-native-healthkit` (iOS) | Reads the phone's health store |
| Backend | **Supabase** | Postgres, login, file storage and serverless functions, with no servers to run |
| AI | **Claude API**, called only from Supabase Edge Functions | The API key never ships inside the app |
| Charts | `victory-native` or `react-native-gifted-charts` | Trend graphs |
| Builds | **EAS Build** (Expo cloud) | Builds iOS apps without owning a Mac |
| Tests | Vitest for the scoring package | Scores must be deterministic and tested |

## 3. Repo structure (monorepo)

```
My-Fitness-APP/
├── apps/
│   └── mobile/                 # Expo app
│       ├── app/                # screens (expo-router): today, sleep, strain, log, coach
│       ├── src/health/         # Health Connect + HealthKit adapters behind one interface
│       ├── src/sync/           # push raw samples to Supabase
│       └── src/ui/             # shared components (score rings, charts)
├── packages/
│   └── scoring/                # pure TypeScript: strain, recovery, sleep, baselines
│       └── tests/
├── supabase/
│   ├── migrations/             # SQL schema
│   └── functions/
│       ├── coach/              # chat with the AI coach (Claude + your data as tools)
│       ├── parse-meal/         # food text/photo -> calories & macros
│       └── daily-summary/      # morning briefing
└── docs/
    └── ROADMAP.md
```

## 4. Scores (our own Whoop-style formulas)

The math computes the scores. The AI only explains them.

- **Strain (0–21)**: TRIMP-style load from time spent in heart-rate zones, compressed
  logarithmically so it's hard to reach 21.
- **Recovery (0–100%)**: today's HRV and resting HR compared with *your* rolling 30-day
  baseline (z-scores), plus last night's sleep performance.
- **Sleep (0–100%)**: hours slept vs. sleep need (baseline + yesterday's strain + sleep
  debt), plus efficiency, consistency and restorative (deep + REM) share.
- **Calibration:** the video says Fitbit-based scores swing to extremes. We handle that
  with personal baselines, outlier clipping, and a "calibrating" state for the first 14
  days.

## 5. Data model (first pass)

Built (Sep 30, 2026, `supabase/migrations/`): `profiles`, `daily_summaries` (one row per day:
resting HR, HRV, sleep times, the three scores and their breakdowns), `workouts`,
`workout_plans`, `meals` (items + macros + photo in a private `meal-photos` bucket),
`coach_messages`. Every table uses Row Level Security, so each user only sees their own rows.

**Changed from the first plan:** no `hr_samples` / `hrv_daily` / `sleep_sessions` tables. Raw
heart-rate data stays on the phone; the phone computes the scores and uploads a daily summary,
which is all the coach needs and far less sensitive.

## 6. Decisions so far

- **Android first** (Health Connect). iOS (HealthKit) comes later from the same Expo
  codebase, so the health adapter sits behind one interface from day one.
- **Fitbit Air arrives after Oct 2.** Until then we build against realistic mock data and
  whatever the phone's Health Connect already holds, then switch to real band data.
- **Dark mode only for now** (decided Sep 30, 2026). Light mode, following the phone's setting,
  comes later once the screens settle (after milestones 3–4): the glows, rings and yellow
  recovery color are tuned for dark, and theming every screen twice slows down design changes.

## 7. Milestones

| # | Milestone | Done when | Status |
|---|---|---|---|
| 0 | Setup | Expo app runs on your phone, Supabase project created, Fitbit Air data types verified | App runs on the phone (Expo Go) and got a design pass (Sep 30); Supabase and the Fitbit check are still to do |
| 1 | Data in | App reads the last 30 days of HR/HRV/sleep/steps and shows raw numbers | Health Connect reader and Health data screen built (Sep 30); first dev build done (Oct 1); needs the band |
| 2 | Scores | `packages/scoring` implemented + tested; Today screen shows the 3 rings | Done on demo data; tune once real data arrives |
| 3 | Logging | Log workouts, import a workout plan, log meals by text or photo (AI macros) | Workout logging built (Oct 1): gym sets, distance/pace, effort, labels band-detected activities; stored on the phone. Plans and meals next |
| 4 | AI coach | Chat screen: Claude reads your scores, sleep, training and food through tools and gives advice | |
| 5 | Polish | Trends, weekly report, notifications, optional MCP server to use your data from the Claude app | |

## 8. Ground rules

- Health data is sensitive: RLS on every table, no API keys in the app, and you can
  delete your data.
- The coach gives wellness guidance, not medical advice.
