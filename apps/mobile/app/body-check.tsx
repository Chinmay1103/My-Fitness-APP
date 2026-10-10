import { bodyCheck, type BodySignalKey } from '@fitness/scoring';
import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { DayPager } from '@/components/Swipe';
import { Card, Muted, Screen } from '@/components/ui';
import { fonts, spacing, type, withAlpha } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';

const SIGNALS: Record<BodySignalKey, { label: string; unit: string; format: (v: number) => string; href: Href; read: (d: { skinTempDelta?: number; respiratoryRate?: number; restingHr?: number }) => number | undefined }> = {
  skinTemp: {
    label: 'Skin temperature',
    unit: '°C',
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`,
    href: { pathname: '/metric/[key]', params: { key: 'skinTemp' } },
    read: (d) => d.skinTempDelta,
  },
  breathing: {
    label: 'Breathing rate',
    unit: 'br/min',
    format: (v) => v.toFixed(1),
    href: { pathname: '/metric/[key]', params: { key: 'breathing' } },
    read: (d) => d.respiratoryRate,
  },
  restingHr: {
    label: 'Resting heart rate',
    unit: 'bpm',
    format: (v) => String(Math.round(v)),
    href: { pathname: '/metric/[key]', params: { key: 'restingHr' } },
    read: (d) => d.restingHr,
  },
};

/**
 * The Body check up close: last night's skin temperature, breathing and resting heart rate, each
 * against your own usual, and whether they rose together. Opened from the Today card.
 */
export default function BodyCheckScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { days } = useScores();
  const { index, isLatest, score } = useSelectedDay();
  const check = bodyCheck(days, index);
  const tone = check?.level === 'alert' ? colors.recovery.red : check?.level === 'watch' ? colors.recovery.yellow : colors.recovery.green;
  const verdict =
    check?.level === 'alert'
      ? 'Several signals are up together'
      : check?.level === 'watch'
        ? 'One signal is up'
        : check
          ? 'Everything looks like your usual'
          : 'Not enough nights yet';

  return (
    <Screen back overline="BODY CHECK" title={isLatest ? 'Last night' : score ? formatDate(score.date) : ''} glow={tone}>
      <Card>
        <DayPager>
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: withAlpha(tone, 0.16) }]}>
              <Text style={[styles.badgeText, { color: tone }]}>{verdict}</Text>
            </View>
            <Muted>
              {check?.level === 'alert'
                ? 'This is how a cold or overtraining often starts, a day or two before you feel it. Keep today light, drink more water and get to bed early. If you feel unwell, rest.'
                : check?.level === 'watch'
                  ? 'Probably nothing on its own: one night can be off for many reasons (a hot room, a late meal, alcohol). Worth watching tomorrow.'
                  : check
                    ? 'Skin temperature, breathing and resting heart rate are all within your normal range.'
                    : 'The check needs a week of nights with at least two of these signals before it can compare.'}
            </Muted>
          </View>
        </DayPager>
      </Card>

      {check
        ? check.signals.map((s) => {
            const def = SIGNALS[s.key];
            return (
              <Card key={s.key} title={def.label.toUpperCase()} href={def.href} linkLabel="30 days">
                <Text style={[styles.diff, { color: s.raised ? colors.recovery.red : colors.muted }]}>
                  {`${s.raised ? 'Raised: ' : ''}${s.diff > 0 ? '+' : ''}${s.key === 'restingHr' ? Math.round(s.diff) : s.diff.toFixed(1)} ${def.unit} vs your usual ${def.format(s.usual)}`}
                </Text>
                <LineChart
                  label={def.label}
                  points={days.slice(0, index + 1).map((d) => ({ date: d.date, value: def.read(d) ?? null }))}
                  color={s.raised ? colors.recovery.red : colors.sleep}
                  format={(v) => `${def.format(v)} ${def.unit}`}
                  higherIsBetter={false}
                  height={90}
                />
              </Card>
            );
          })
        : null}

      <Card title="HOW IT WORKS">
        <Text style={styles.body}>
          Each night, three signals are compared with your own last 30 nights: skin temperature (up 0.5 °C or more), breathing
          (up 1 breath a minute or more) and resting heart rate (up 4 bpm or more), each also well outside your usual spread. One
          raised is worth watching; two or more together is an alert. It’s a wellness check, not a diagnosis: if you feel ill,
          talk to a doctor.
        </Text>
        <Text style={styles.link} onPress={() => router.push('/recovery')}>
          See this morning’s recovery ›
        </Text>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { gap: spacing.sm },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 15 },
  diff: { fontFamily: fonts.bodySemi, fontSize: 14 },
  body: { ...type.body, color: colors.text },
  link: { ...type.bodyStrong, color: colors.text },
}));
