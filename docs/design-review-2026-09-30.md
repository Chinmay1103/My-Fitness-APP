# Design review: screen recording of the app (Sep 30, 2026)

Written by the cloud Claude session after watching a 33-second recording of the app running on
Chinmay's Android phone in Expo Go (Today, Recovery, Sleep, Strain and Coach screens, all on
demo data). This is a to-do list for the next local session. Work through it in order and tick
items off as they're done.

**Overall verdict:** the parts are good (cards, rings, the "Why 58%" breakdowns, the charts), but
the screens don't feel like one app yet. Most of the inconsistency comes from the header area, the
fonts, and each chart being styled differently. None of it is hard to fix.

## 1. Header strip (biggest visual problem) ✅ done

> Done: navigator headers are hidden everywhere; `Screen` draws an overline + title (and a back
> arrow on Recovery) under the status bar, so the glow runs to the top edge. Titles: TODAY + date,
> SLEEP + "Last night", STRAIN + "Today so far", LOG + "Workouts and meals", COACH + "Ask about
> your day", RECOVERY + "This morning". Needs a check on the phone.

- Every screen has a flat black header bar ("Today", "Sleep", ...) sitting above the tinted
  background. Where the yellow/blue glow starts there's a hard horizontal seam just under the header.
  This is the main reason the app looks stitched together.
- **Fix:** make the header transparent so the glow runs up behind it
  (`headerTransparent: true` + matching top padding in `Screen`, or hide the navigator header and
  render our own title inside `Screen`). Do the same for the `recovery` stack screen in
  `app/_layout.tsx`.
- The Today screen shows its title twice: the small "Today" in the header plus the large
  "Wednesday 30 Sept" below it. Pick one. Suggested: a small overline "TODAY" with the date as the
  big title, and the same pattern on every tab (Sleep: "SLEEP" + "Last night", Strain: "STRAIN" +
  "Today so far").
- The grey gear-in-a-circle at the top right is **Expo Go's developer menu button, not our UI**.
  Ignore it; it won't appear in a real build.

## 2. Fonts ✅ done

> Done: Inter for all words, Barlow Condensed kept only for numbers (`fonts.number` in
> `constants/theme.ts`). Inter, Manrope and the old Barlow look were compared; Inter was kept.
> Barlow (regular) and Manrope were removed. MASTER.md and CLAUDE.md updated.

Right now three voices compete: Barlow Condensed Bold (titles, numbers), tracked uppercase Barlow
Condensed (section labels), and Barlow (body text). Condensed titles like "Today" and
"Wednesday 30 Sept" look cramped and scoreboard-like, while the body text is wide and soft.

- **Recommended:** **Inter** for all text (titles, labels, body, tab bar), with a condensed face
  kept **only for the big numbers** (ring values, stat values like "54 ms", deltas like "+7").
  Numbers are where a condensed face looks sporty; on words it looks cramped.
  - Package: `npx expo install @expo-google-fonts/inter` (weights 400, 500, 600, 700).
  - Update `fonts` / `type` in `constants/theme.ts` and the font map in `app/_layout.tsx`.
  - Keep `fontVariant: ['tabular-nums']` on changing numbers so they don't wobble during count-up.
  - Overlines ("LAST NIGHT", "WHY 58%"): Inter SemiBold 12, letter-spacing ~1, muted color.
- Alternative if Inter feels too plain: **Manrope** for text, same rule for numbers.
- Before switching, show Chinmay a before/after screenshot of the Today screen and let him pick.
- `design-system/my-fitness-app/MASTER.md` says Barlow, so update it to match whatever he picks.

## 3. Charts don't match each other ✅ done

> Done: all three trends use `TrendBars`; the line chart is deleted. Only the selected bar is
> labelled (today by default); tapping a bar shows that day's value and date, tapping again goes
> back to today. The average is a dashed line with "avg" below the chart. Bars use the ring
> gradients at full strength. **Changed from the suggestion:** past days aren't dimmed with
> opacity, because dimmed yellow on navy is exactly what looked like mustard/olive. Instead the
> selected day gets a faint column behind it. Sleep bars now start at 0 like the others (the old
> line chart zoomed in on the top of the range).

- Recovery (Today) is a **bar chart with a number on every bar**; Sleep and Strain are
  **line charts with only today's value labelled**. On a phone that reads as three different apps.
- **Fix:** one style for all three 14-day trends. Suggested: bars everywhere (easier to read
  day-by-day), label only today's bar and the average line, and show a day's value on tap.
  The crowded row of 14 numbers on the recovery chart goes away.
- Recovery bar colors look muddy: the yellow-zone bars render as dull mustard/olive next to
  saturated green and red. Use the same gradients as the ring (`gradients.recovery.*`) at
  full strength, and dim past days with opacity (~0.55) rather than a different color.

## 4. Tab bar ✅ done

> Done: a custom `TabButton` in `app/(tabs)/_layout.tsx` has no ripple; the active tab is
> marked by color only. The bar uses `colors.background` with a hairline top border.

- On Strain and Coach, the active tab shows a large grey circle (the Android ripple) that spills
  above the tab bar. On Today it doesn't appear, so the tabs behave differently.
- **Fix:** turn off the unbounded ripple (a custom `tabBarButton` with
  `android_ripple={{ borderless: false }}`, or none), and mark the active tab with color only,
  or a small pill behind the icon, the same on every tab.
- The tab bar background (`colors.card`) is a slightly different navy from the screen background,
  so it reads as a separate block. Try `colors.background` with a hairline top border.

## 5. Smaller things (mostly done)

> Done: refresh spinner offset below the title; Coach and Log get a neutral glow (Sleep already
> had its lavender one in code); `colors.track` is a bit lighter so a ±0 row's empty track shows;
> "Demo data" is an outlined pill (`Pill` in `components/ui.tsx`); Coach shows example questions.
> **Still open:** the ring-tap behaviour (Recovery pushes a screen, Sleep/Strain switch tab). That
> is a product choice for Chinmay, not a styling fix.

- **Pull-to-refresh spinner** sits on top of the "Wednesday 30 Sept" title while refreshing. Once
  the header is transparent, set `progressViewOffset` on the `RefreshControl` in
  `components/ui.tsx` so it appears below the title.
- **Screen glow is inconsistent:** Today/Recovery glow yellow and Strain glows blue, but Sleep and
  Coach have none. Give Sleep the lavender glow and Coach a neutral one, or drop glows everywhere
  except Today.
- **Detail screens differ:** Recovery opens as a pushed screen with a back arrow; Sleep and Strain
  explain themselves inline on their tabs. Fine for now, but the ring tap on Today should behave the
  same for all three (either all push a detail screen, or all switch to their tab).
- **Contribution bars in "Why" sections:** a `±0` row (Efficiency) has no bar while others do.
  Show an empty track so rows line up.
- **"Demo data" label** next to the date is easy to miss. Make it a small pill (muted border),
  or move it to the header area.
- **Coach placeholder** is a single card on an empty screen. Fine until milestone 4, but a short
  illustration or example questions would stop it looking broken.

## Suggested order

1. ~~Transparent header + one title pattern on every tab (section 1).~~ Done.
2. ~~Font swap (section 2), with a before/after screenshot for Chinmay.~~ Done: Inter.
3. ~~Unify the three trend charts (section 3).~~ Done.
4. ~~Tab bar ripple and background (section 4).~~ Done.
5. ~~The small things (section 5).~~ Done except the ring-tap behaviour.

After each step: `npm run typecheck`, then check on the phone. Commit each step separately so it's
easy to undo if Chinmay doesn't like it.
