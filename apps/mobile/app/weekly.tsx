import { weekSummary } from '@fitness/scoring';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ComboChart } from '@/components/charts/ComboChart';
import { DayPager } from '@/components/Swipe';
import { Button, Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { useAskCoach } from '@/lib/askCoach';
import { formatMinutes } from '@/lib/format';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { useWeeklyReport } from '@/lib/weeklyReport';

const LOAD_TEXT = {
  fresh: 'Lighter than usual',
  steady: 'Steady',
  building: 'Building fast',
  overreaching: 'Too much too soon',
} as const;

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * The week in one screen: the app's own numbers for the 7 days ending on the picked day, one
 * thing to focus on (by rule), and Claude's written report when one has been saved for the week.
 */
export default function WeeklyScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores } = useScores();
  const { index } = useSelectedDay();
  const week = weekSummary(scores, index);
  const report = useWeeklyReport(week?.start, week?.end);
  const { ask, busy } = useAskCoach();
  if (!week) return <Screen back title="Weekly report"><Muted>No data yet.</Muted></Screen>;

  const days = scores.slice(Math.max(0, index - 6), index + 1);
  return (
    <Screen back overline="WEEKLY REPORT" title={`${shortDate(week.start)} – ${shortDate(week.end)}`} glow={colors.sleep}>
      <Card>
        <DayPager>
          <Row>
            <Stat label="Recovery" value={week.recovery != null ? `${week.recovery}%` : '--'} hint="average" color={colors.recovery.green} />
            <Stat label="Sleep" value={week.sleep != null ? `${week.sleep}%` : '--'} hint="average" color={colors.sleep} />
            <Stat label="Strain" value={week.strain.toFixed(1)} hint="average" color={colors.strain} />
          </Row>
        </DayPager>
        <Row>
          <Stat label="Asleep" value={week.asleep != null ? formatMinutes(week.asleep) : '--'} hint="a night" />
          <Stat label="Sleep debt" value={formatMinutes(week.sleepDebt)} hint="this week" />
          <Stat label="Green / red" value={`${week.greenDays} / ${week.redDays}`} hint="mornings" />
        </Row>
        <Muted>Swipe the top row to look at earlier weeks.</Muted>
      </Card>

      <Card title="FOCUS FOR NEXT WEEK">
        <Text style={styles.focusTitle}>{report?.focus ? report.focus : week.focus.title}</Text>
        {report?.focus ? null : <Muted>{week.focus.detail}</Muted>}
      </Card>

      {report ? (
        <Card title="FROM YOUR COACH">
          <Text style={[styles.headline, { color: colors.sleep }]}>{report.headline}</Text>
          <Text style={styles.body}>{report.summary}</Text>
        </Card>
      ) : (
        <Card title="FROM YOUR COACH">
          <Muted>No written report for this week yet. Claude reads these numbers, your workouts, meals and habits, and writes one.</Muted>
          <Button
            label={busy ? 'Opening Claude…' : 'Ask Claude to write it'}
            disabled={busy}
            onPress={() => ask(`Write my weekly report for the week ending ${week.end}.`)}
          />
        </Card>
      )}

      <Card title="DAY BY DAY">
        <ComboChart
          points={days.map((s) => ({
            date: s.date,
            bar: s.strain.strain,
            line: s.recovery?.score ?? null,
            lineColor: s.recovery?.zone ? colors.recovery[s.recovery.zone] : undefined,
          }))}
          bar={{ label: 'Strain', color: colors.strain, max: 21, format: (v) => v.toFixed(1) }}
          line={{ label: 'Recovery', color: colors.text, max: 100, format: (v) => `${Math.round(v)}%` }}
          describe={(p) => `strain ${p.bar?.toFixed(1) ?? '--'} · recovery ${p.line != null ? `${Math.round(p.line)}%` : 'not scored'}`}
        />
        <View style={styles.bestWorst}>
          {week.best ? <Text style={styles.body}>{`Best morning: ${shortDate(week.best.date)}, ${week.best.recovery}%`}</Text> : null}
          {week.worst && week.worst.date !== week.best?.date ? (
            <Text style={styles.body}>{`Toughest: ${shortDate(week.worst.date)}, ${week.worst.recovery}%`}</Text>
          ) : null}
        </View>
      </Card>

      <Card title="TRAINING LOAD" href={{ pathname: '/metric/[key]', params: { key: 'trainingLoad' } }}>
        <Text style={styles.focusTitle}>
          {week.loadRatio != null && week.loadZone ? `${week.loadRatio.toFixed(2)} · ${LOAD_TEXT[week.loadZone]}` : 'Needs two weeks of data'}
        </Text>
        <Muted>The last 7 days’ load against the last 28. 0.8–1.3 builds fitness steadily; above 1.5 is a risky jump.</Muted>
        <Text style={styles.link} onPress={() => router.push('/workouts')}>
          Workout history ›
        </Text>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  focusTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.text },
  headline: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  body: { ...type.body, color: colors.text },
  bestWorst: { gap: spacing.xs },
  link: { ...type.bodyStrong, color: colors.text },
}));
