import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, Screen } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { makeStyles, useColors } from '@/lib/theme';

/**
 * "Start here": how to use the app day to day and how to read any screen in it. Plain words, no
 * numbers of yours; the (?) on each screen has the per-screen version with your own ranges.
 */
export default function GuideScreen() {
  const colors = useColors();
  const styles = useStyles();

  return (
    <Screen back overline="START HERE" title="How to read the app">
      <Card>
        <Text style={styles.lead}>
          Three numbers, one routine. You don&apos;t need to read every screen: &quot;Your day&quot; at the top of Today
          tells you how your body is, what to do today and when to go to bed. Everything else is there for when you
          want to know why.
        </Text>
      </Card>

      <Card title="YOUR DAILY ROUTINE">
        <Step when="Morning · 1 minute" what="Open Today and read “Your day”. The Recovery color says how hard to go: green push, yellow moderate, red easy." href="/" />
        <Step when="During the day" what="The Strain ring fills as you move. Aim for the target range Your day gives. Tell the coach what you did and ate, in your own words." href="/strain" />
        <Step when="Evening" what="Check “Tonight” on Today: the time to be in bed for the sleep you need. Going to bed at a steady time is the biggest lever you have." href="/sleep" />
        <Step when="Sunday or Monday" what="Ask the coach “how did my week go?”. It writes the weekly report and one thing to focus on." href="/weekly" last />
      </Card>

      <Card title="THE THREE SCORES">
        <Text style={styles.scoreName}>Recovery · how ready your body is</Text>
        <Muted>Set each morning from last night&apos;s HRV, resting heart rate and sleep, against your own last 30 days.</Muted>
        <Band color={colors.recovery.green} text="67–100%  ready for a hard day" />
        <Band color={colors.recovery.yellow} text="34–66%  train, but moderately" />
        <Band color={colors.recovery.red} text="0–33%  rest, walk, stretch, sleep early" />

        <Text style={[styles.scoreName, styles.gapTop]}>Strain · how hard the day was, 0–21</Text>
        <Muted>From your heart rate. It gets harder to raise the higher it goes.</Muted>
        <Band color={colors.strain} text="under 10  light day" />
        <Band color={colors.strain} text="10–14  moderate: a normal workout" />
        <Band color={colors.strain} text="14–18  hard training" />
        <Band color={colors.strain} text="18+  all out" />

        <Text style={[styles.scoreName, styles.gapTop]}>Sleep · how much of your need you got</Text>
        <Muted>Your need goes up after hard days and short nights. Poor quality can take up to 30% off.</Muted>
        <Band color={colors.sleep} text="85%+  a good night" />
        <Band color={colors.sleep} text="70–84%  okay" />
        <Band color={colors.sleep} text="under 70%  short: go to bed earlier tonight" />
      </Card>

      <Card title="HOW TO READ ANY SCREEN">
        <Point n="1" text="The big number at the top is for the day shown under it. Swipe the rings (or use the arrows) to look at earlier days; every screen follows." />
        <Point n="2" text="“WHY” cards add up exactly to the number: a starting point plus or minus each part, so you see what moved it." />
        <Point n="3" text="“What led here” puts the number next to what happened: the day before, late meals, workouts, habits. Tap a line to open it." />
        <Point n="4" text="Charts: the dashed line is your middle, the shaded band your normal range. Drag to pick a day, pinch with two fingers to zoom, and “Show … above” switches the screen to that day." />
        <Point n="5" text="Colors mean the same everywhere: green good, yellow okay, red worth watching, grey just information." />
        <Point n="6" text="Lost? ☰ (top right) lists every screen and shows where you are. ? explains the screen you're on, with your own usual numbers." last />
      </Card>

      <Card title="WHAT NOT TO WORRY ABOUT">
        <Point n="•" text="One bad day. Bodies swing; look at the trend over a week, not one morning." />
        <Point n="•" text="The first two weeks. Recovery is still learning your normal and will settle." />
        <Point n="•" text="Small differences. A point or two of recovery, or 1 ms of HRV, is noise." />
        <Point n="•" text="Anything here is wellness guidance, not medical advice. If you feel unwell, see a doctor." last />
      </Card>

      <Card title="TALKING TO THE COACH" href="/coach" linkLabel="Open">
        <Muted>Say it like you would to a friend; it records it and explains your numbers.</Muted>
        <Quote text="“Ran 5 km from 6:10 to 6:45 pm, felt like a 7.”" />
        <Quote text="“Had dal rice and two rotis at 9:30 pm.”" />
        <Quote text="“How’s my day? Why is my recovery low?”" />
        <Quote text="“How did my week go?”" />
      </Card>
    </Screen>
  );
}

function Step({ when, what, href, last }: { when: string; what: string; href: Href; last?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        router.navigate(href);
      }}
      accessibilityRole="link"
      style={({ pressed }) => [styles.step, pressed && { opacity: 0.6 }]}>
      <View style={styles.rail}>
        <View style={[styles.railDot, { backgroundColor: colors.text }]} />
        {last ? null : <View style={[styles.railLine, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.when}>{when}</Text>
        <Text style={styles.body}>{what}</Text>
      </View>
    </Pressable>
  );
}

function Band({ color, text }: { color: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.band}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

function Point({ n, text, last }: { n: string; text: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.point, !last && styles.pointGap]}>
      <Text style={styles.pointN}>{n}</Text>
      <Text style={[styles.body, styles.flex]}>{text}</Text>
    </View>
  );
}

function Quote({ text }: { text: string }) {
  const styles = useStyles();
  return <Text style={styles.quote}>{text}</Text>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  lead: { ...type.bodyStrong, color: colors.text },
  step: { flexDirection: 'row', gap: 12 },
  rail: { width: 12, alignItems: 'center' },
  railDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  railLine: { width: 2, flex: 1, marginTop: 4 },
  stepBody: { flex: 1, gap: 2, paddingBottom: spacing.md },
  when: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  body: { ...type.body, color: colors.text },
  scoreName: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  gapTop: { marginTop: spacing.md },
  band: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  point: { flexDirection: 'row', gap: 10 },
  pointGap: { marginBottom: spacing.sm },
  pointN: { fontFamily: fonts.numberSemi, fontSize: 16, color: colors.muted, width: 14 },
  flex: { flex: 1 },
  quote: { ...type.body, color: colors.text, fontFamily: fonts.bodyMedium, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border },
}));
