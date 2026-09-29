# My-Fitness-APP

A free, Whoop-style companion app for the Fitbit Air: Strain / Recovery / Sleep scores plus an
AI coach that also knows the user's workouts and meals. Built by Chinmay (engineering background,
rusty on hands-on coding) together with Claude. Explain changes in plain terms and keep steps
concrete; Chinmay runs the app on his phone and judges how the scores feel.

Full plan: [docs/ROADMAP.md](docs/ROADMAP.md). Run instructions: [docs/SETUP.md](docs/SETUP.md).

## Decisions so far

- **Android first** (Health Connect); iOS (HealthKit) later from the same Expo codebase. All health
  reads go through the `HealthSource` interface in `apps/mobile/lib/health/`, so adding a platform
  means adding one source.
- **Demo data until the Fitbit Air arrives** (launches Oct 2, 2026). `generateMockDays()` in
  `packages/scoring/src/mock.ts` produces seeded, realistic days. First job once the band arrives:
  check which data types it actually writes into Health Connect.
- **Math computes scores, AI only explains them.** Scores must stay deterministic and tested.
- **Backend: Supabase** (not set up yet). The Claude API is called only from Supabase Edge
  Functions; API keys never ship in the app.
- **The coach gives wellness guidance, not medical advice.**

## How the scores work (`packages/scoring/src/`)

- **Strain (0–21)** `strain.ts`: Banister TRIMP over heart-rate-reserve fraction; time below 30% of
  reserve is ignored; gaps over 5 min aren't counted; `21 * (1 - e^(-TRIMP/120))`.
- **Sleep (0–100)** `sleep.ts`: `sufficiency * (0.7 + 0.3 * quality)`. Hours vs. need sets the
  ceiling; quality (efficiency, deep+REM share, bedtime consistency) can only take points off.
  Need = base (8h) + extra after strain > 8 + a third of the last 3 nights' shortfall (capped at 60
  min). Shortfall is measured against the *base* need, or debt ratchets up to the cap.
- **Recovery (0–100)** `recovery.ts`: z-scores of ln(HRV) and resting HR against a robust
  (median/MAD) 30-day personal baseline, plus sleep; `sigmoid(0.3 + combined)`. No score before 4
  days of history; flagged "calibrating" until 14. Median/MAD, z clipping and the sigmoid are there
  deliberately: Fitbit-based scores in other apps swing to extremes.

When changing a formula, check the numbers on mock data still look like a real Whoop week, not
just that tests pass.

## Layout

- `packages/scoring/`: pure TypeScript scoring and mock data, Vitest tests. Consumed as source
  (`main: src/index.ts`), no build step.
- `apps/mobile/`: Expo SDK 57 app with expo-router. Tabs live in `app/(tabs)/`: Today (`index.tsx`),
  Sleep, Strain, Log, Coach (Log and Coach are placeholders). Shared data comes from
  `lib/ScoresProvider.tsx`; UI pieces live in `components/`; colors in `constants/theme.ts`.
  Also read `apps/mobile/AGENTS.md`: Expo APIs change every SDK, so check the installed version's
  docs or types, not memory.

## Commands (run from the repo root)

```bash
npm install          # npm workspaces
npm test             # scoring tests
npm run typecheck    # all workspaces
npm run mobile       # Expo dev server; scan the QR with Expo Go
```

In `apps/mobile`, add packages with `npx expo install <pkg>`, not `npm install`.
On Windows PowerShell, call `npm.cmd` / `npx.cmd` if script execution policy blocks `npm`.

## Milestone status

| # | Milestone | Status |
|---|---|---|
| 0 | Setup | App scaffolded. To do: run on phone, create Supabase project, verify Fitbit Air data types |
| 1 | Health Connect data in | Waiting for the Fitbit Air; needs an EAS development build (Expo Go lacks the native module) |
| 2 | Scores + Today rings | Done on demo data; tune against real data |
| 3 | Logging: workouts, plans, meals (AI macros) | Not started |
| 4 | AI coach chat | Not started |
| 5 | Trends, weekly report, notifications, MCP server | Not started |

Keep this table up to date when a milestone moves.
