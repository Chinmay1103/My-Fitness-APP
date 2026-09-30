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
  missing, so the app still runs), signs in with an email code (`app/account.tsx`), and uploads one
  summary row per day (`lib/sync.ts`); raw heart rate and demo data never leave the phone. The
  Claude API is called only from Supabase Edge Functions; API keys never ship in the app.
- **Native modules that throw on import** (Health Connect, AsyncStorage) are loaded lazily behind a
  `TurboModuleRegistry.get` check, so an older build or Expo Go doesn't crash.
- **The coach gives wellness guidance, not medical advice.**
- **Dark mode only for now**; light mode later, once the screens settle (see ROADMAP).

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

Every score also returns a **breakdown** that adds up exactly to it (recovery: typical night +
factor points; sleep: hours ceiling − quality penalties, plus need = base + strain + debt; strain:
activities + everyday movement). The app shows these as "WHY 81%" cards, worded in
`apps/mobile/lib/insights.ts`. Keep breakdowns summing to the score; `tests/breakdown.test.ts` checks it.

## Layout

- `packages/scoring/`: pure TypeScript scoring and mock data, Vitest tests. Consumed as source
  (`main: src/index.ts`), no build step.
- `apps/mobile/`: Expo SDK 57 app with expo-router. Tabs live in `app/(tabs)/`: Today (`index.tsx`),
  Sleep, Strain, Coach; `app/recovery.tsx` is the Recovery detail screen.
  **No logging forms or Log tab** (Chinmay's call, Oct 1). **The coach is the Claude app, not an
  in-app chat** (Chinmay has no paid Claude plan or API key): the Coach tab opens a new claude.ai chat
  with the question plus today's numbers (`lib/claudeHandoff.ts`). Next: an MCP connector on Supabase
  (free plans allow one custom connector) so that same chat can read the data and record workouts and
  meals the user types or speaks. `lib/workouts.ts` holds the workout model
  and matches workouts to band-detected activities. Shared data comes from
  `lib/ScoresProvider.tsx`; UI pieces live in `components/`; design tokens (colors, gradients,
  fonts, motion) in `constants/theme.ts`. Use tokens, not raw hex, in screens.
  Visual direction: `design-system/my-fitness-app/MASTER.md` (made with the ui-ux-pro-max skill in
  `.claude/skills/`; its "Project decisions" table overrides the generated parts). Rings and charts
  animate via Reanimated and skip motion when the phone's "reduce motion" setting is on; haptics go through
  `lib/haptics.ts`. Fonts: Inter for words, Barlow Condensed only for numbers;
  on Android pick weights by `fontFamily` only (no `fontWeight`).
  Also read `apps/mobile/AGENTS.md`: Expo APIs change every SDK, so check the installed version's
  docs or types, not memory.

## Commands (run from the repo root)

```bash
npm install          # npm workspaces
npm test             # scoring tests
npm run typecheck    # all workspaces
npm run mobile       # dev server for the app's own build (development build)
npm run mobile:go    # same, for Expo Go (no Health Connect)
```

In `apps/mobile`, add packages with `npx expo install <pkg>`, not `npm install`.
On Windows PowerShell, call `npm.cmd` / `npx.cmd` if script execution policy blocks `npm`.

## Milestone status

| # | Milestone | Status |
|---|---|---|
| 0 | Setup | Runs on the phone; design review done; Supabase schema + sign-in + daily sync written. To do: Chinmay creates the Supabase project (docs/SETUP.md), verify Fitbit Air data types |
| 1 | Health Connect data in | Code ready (`lib/health/healthConnectSource.ts`, Health data screen `app/health.tsx`); first EAS dev build done (Oct 1); to do: check real Fitbit Air data |
| 2 | Scores + Today rings | Done on demo data; tune against real data |
| 3 | Logging: workouts, plans, meals (AI macros) | Merged into 4: the user types or speaks what they did or ate in the Coach chat and the AI records it (no forms) |
| 4 | AI coach (in the Claude app; also does all logging) | "Ask Claude" handoff done; to do: MCP connector on Supabase so Claude can read data and record workouts/meals |
| 5 | Trends, weekly report, notifications, MCP server | Not started |

Keep this table up to date when a milestone moves.
