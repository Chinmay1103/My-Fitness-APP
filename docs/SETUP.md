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
npm test             # 25 tests for strain, sleep and recovery
npm run typecheck    # type errors across the whole repo
```

## Where things live

| Folder | What's inside |
|---|---|
| `packages/scoring/src/` | The math: `strain.ts`, `sleep.ts`, `recovery.ts`, plus `mock.ts` (fake data) |
| `packages/scoring/tests/` | Tests for the math |
| `apps/mobile/app/(tabs)/` | One file per tab: `index.tsx` (Today), `sleep.tsx`, `strain.tsx`, `log.tsx`, `coach.tsx` |
| `apps/mobile/components/` | Reusable UI: score rings, cards, bar charts |
| `apps/mobile/lib/health/` | Where health data comes from. Today: demo data. Milestone 1: Health Connect |

## Later: when the Fitbit Air arrives (milestone 1)

Health Connect needs native code that Expo Go doesn't include, so from milestone 1 we build our
own "development build" of the app with **EAS Build** (Expo's cloud builder, free tier) and
install that APK instead of using Expo Go. You'll need a free account at
[expo.dev](https://expo.dev) for that. No Android Studio required.
