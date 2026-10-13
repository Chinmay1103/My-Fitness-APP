# Bug report: full check against real data (Oct 12–13, 2026)

Checked every feature against Chinmay's real synced data (Oct 3–13: daily scores and breakdowns,
5 workouts, 8 days of meals, 42 weigh-ins, coach notes, the weekly summary, profile) and read the
code behind each one. Totals were recomputed by hand where possible.

**Status key:** Fixed = fixed in code and tested. Needs you = fixed, but only takes effect after a
step on your side (see the bottom). Note = not a code bug, but worth knowing.

## What checked out correctly

| Feature | Check on real data | Result |
|---|---|---|
| Recovery breakdown | Oct 12: 57 typical − 3 HRV + 10 resting HR − 4 breathing − 5 sleep | = 55 ✓ |
| Sleep score | Oct 12: 5 h 47 m of 8 h 47 m → ceiling 66 − 3 consistency − 2 deep+REM | = 61 ✓ |
| Sleep need | Oct 12: 8 h base + 0 strain (Oct 11 strain 6.1 is under 8) + 47 m debt | = 8 h 47 m ✓ |
| Strain breakdown | Oct 12: 0.7 + 0.6 + 3.5 + 3.4 + 1.3 | = 9.5 ✓ (9.8 after the late-evening resync) |
| Recovery history | "9 days of history" on Oct 12 = Oct 3 to Oct 11 | ✓ |
| Recovery zones | Oct 8 at 34% shows yellow (yellow is 34–66) | ✓ |
| Meal totals | Per-day calories and macros add up from the items | ✓ |
| Lift progress | Exercise names are consistent across sessions, so progress lines up | ✓ |

## Bugs

| # | Where | What went wrong | Effect on your data | Status |
|---|---|---|---|---|
| 1 | Workout effort (coach) | The coach could only save whole numbers for effort, so "8.5/10" was dropped; ratings ended up only in the notes | All 5 gym sessions have no effort. Upper B (96 min) scored only 1.2 strain; leg day 3.5 | **Needs you**: half points allowed and an `update_workout` tool added; ask the coach to add the ratings |
| 2 | Steps | Phone steps were added as "band off" whenever the band showed 0 in that 5-minute slot, but the band often files the same walk a few minutes later | Daily totals higher than both devices (Wed 7 Oct: 5,388 vs band 4,970 and phone 5,193) | Fixed |
| 3 | Training load (Strain screen, weekly report, coach, website) | The 28-day "usual" counted the 19 days before the band arrived as zero training | Ratio 3.62 → "Too much too soon" and "Ease off the training" when you were training normally | Fixed in the app and website; **needs you** for the coach (redeploy) |
| 4 | Sleep debt (weekly report, coach, website Sleep and Reports) | Each night's need already includes paying back earlier debt; adding up need − sleep counted the same missed hour again every night | This week shown as **12 h** of debt; it's about 7 h | Fixed in the app and website; **needs you** for the coach (redeploy) |
| 5 | Sleep heart rate | Heart rate between bedtime and midnight (for nights starting before 12) was counted as daytime | Added to the day's strain, average heart rate and zone minutes | Fixed |
| 6 | Sync | Days before the band arrived (Sep 14 – Oct 2) were uploaded as empty, zero-strain days | Dragged down averages on the website | Fixed: no longer uploaded, and the website skips the ones already in the cloud |
| 7 | Profile | Age was fixed at the demo 28 for max heart rate (zones, strain); Today's suggestions and the morning notification ignored your profile | Zones and strain assume 28 | Fixed; **needs you**: add your birth date (Account → About you) |
| 8 | Protein suggestion (Today) | Used 1.6 g per kg (about 98 g for you) instead of your 110 g goal | Today and the coach disagreed | Fixed: uses your goal, and mentions calories left to your 2,400 |
| 9 | "What led here" (Recovery, Sleep, metrics) | "Late eating" meant after 9 pm, but you sleep around 1 am | Every dinner flagged as late | Fixed: late now means within 2 h of falling asleep that night (same for workouts) |
| 10 | Workout screen | The activity screen used the demo profile's max heart rate | Zones on that screen were off | Fixed |

## Notes (not code bugs)

- **Oct 6 and Oct 7 workouts** are logged as 6:00–7:00 pm and 6:00–6:40 pm, which look like placeholder
  times; the band found no effort then. Give the coach the real times if you remember them.
- **No habits logged yet.** The coach logged the 11 pm chocolate and 10 pm dinners as meals, not
  habits, so the Habits screen stays empty. Telling the coach "log late snack as a habit" teaches it.
- **Heart-rate alert vs the gym.** The alert's limits go up to 130 bpm; your gym sessions peak at
  144–149. If you switch it on, it will message your contact during workouts.
- **Recovery is sensitive to resting heart rate** while the baseline is young: on Oct 12, 3 bpm below
  your usual gave +10 points. That's tuning, not a bug; judge it over the next two weeks (14 days of
  history on Oct 17).
- **Setup day (Oct 3)** has a resting heart rate of 79 from a 4.5-hour partial day. It's in the
  recovery baseline, but the median ignores outliers like this.
- **Scores can change after a resync** (Oct 10 recovery was revised): Google Health delivers the
  band's data in batches, so a later sync can add readings.

## What you need to do

1. `npm run db:push`: adds `sex` and `height_cm` to your profile.
2. Redeploy the coach connector (the `mcp` function): fixes #3 and #4 in the coach, and enables #1.
3. Build and install a new app version: everything else.
4. In the app, Account → About you: birth date, sex, height.
5. In the coach chat: "Add effort ratings to my last five workouts" (Upper B was 8.5, the rest are
   in each workout's notes), and correct the Oct 6–7 times.
