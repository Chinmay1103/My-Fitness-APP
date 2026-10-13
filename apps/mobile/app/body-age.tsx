import { BODY_AGE_MIN_DAYS } from '@fitness/scoring';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { BODY_AGE_FACTORS, useBodyAge } from '@/lib/bodyAge';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { HELP_BODY_AGE } from '@/lib/help';

const years = (y: number) => `${Math.abs(y).toFixed(1)} year${Math.abs(y) === 1 ? '' : 's'}`;

/**
 * Body age: how old your body acts, from the last 30 days (scoring's computeBodyAge), with what
 * added or took off years and the changes that would move it most.
 */
export default function BodyAgeScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { profile, days } = useScores();
  const b = useBodyAge();

  if (!b) {
    const worn = days.slice(-30).filter((d) => d.heartRate.length > 0 || d.sleep).length;
    return (
      <Screen back help={HELP_BODY_AGE} overline="BODY AGE" title="Not yet">
        <Card>
          <Muted>{`Body age looks at the last 30 days, so it needs at least ${BODY_AGE_MIN_DAYS} days of band data (${worn} so far).`}</Muted>
        </Card>
      </Screen>
    );
  }

  const younger = b.delta < 0;
  const tone = Math.abs(b.delta) < 0.5 ? colors.text : younger ? colors.recovery.green : colors.recovery.red;
  const scale = Math.max(...b.factors.map((f) => Math.abs(f.years)), 0.5);
  const levers = b.factors.filter((f) => f.lever).sort((x, y) => x.lever!.years - y.lever!.years).slice(0, 3);

  return (
    <Screen back help={HELP_BODY_AGE} overline="BODY AGE" title="Last 30 days" glow={tone}>
      <Card>
        <View style={styles.hero}>
          <Text style={[styles.big, { color: tone }]}>{b.bodyAge != null ? b.bodyAge.toFixed(1) : `${b.delta > 0 ? '+' : b.delta < 0 ? '−' : '±'}${Math.abs(b.delta).toFixed(1)}`}</Text>
          <Text style={styles.heroLabel}>{b.bodyAge != null ? 'BODY AGE' : 'YEARS VS YOUR AGE'}</Text>
          <Muted>
            {Math.abs(b.delta) < 0.5
              ? `Right at your age${b.age != null ? ` of ${b.age}` : ''}.`
              : `${years(b.delta)} ${younger ? 'younger' : 'older'} than your${b.age != null ? ` ${b.age}` : ' age'}, from how you’ve lived the last 30 days.`}
          </Muted>
          {b.age == null ? <Muted>Add your birth date on the Account screen to see the age itself.</Muted> : null}
        </View>
      </Card>

      <Card title={b.bodyAge != null ? `WHY ${b.bodyAge.toFixed(1)}` : 'WHY'}>
        <Breakdown>
          {b.age != null ? <BreakdownTotal label="Your age" detail="From your birth date" value={String(b.age)} /> : null}
          {b.factors.map((f) => {
            const def = BODY_AGE_FACTORS[f.key];
            return (
              <BreakdownFactor
                key={f.key}
                label={def.label}
                detail={`${def.format(f.value)} vs a typical adult’s ${def.format(f.typical)}. ${def.why}`}
                delta={f.years}
                scale={scale}
                decimals={1}
                unit=" y"
                color={f.years < 0 ? colors.recovery.green : colors.recovery.red}
              />
            );
          })}
          <BreakdownTotal
            label={b.bodyAge != null ? 'Body age' : 'Years vs your age'}
            value={b.bodyAge != null ? b.bodyAge.toFixed(1) : `${b.delta > 0 ? '+' : ''}${b.delta.toFixed(1)}`}
            color={tone}
          />
        </Breakdown>
        <Muted>Green takes years off, red adds them. A typical adult on every factor would be exactly their own age.</Muted>
      </Card>

      {levers.length ? (
        <Card title="BIGGEST LEVERS">
          {levers.map((f) => (
            <View key={f.key} style={styles.lever}>
              <Text style={styles.leverText}>{BODY_AGE_FACTORS[f.key].lever(f.lever!.target)}</Text>
              <Text style={[styles.leverYears, { color: colors.recovery.green }]}>{`−${Math.abs(f.lever!.years).toFixed(1)} y`}</Text>
            </View>
          ))}
          <Muted>Keep it up for a few weeks and body age follows: it always looks at the last 30 days.</Muted>
        </Card>
      ) : null}

      {b.missing.length ? (
        <Card title="NOT COUNTED YET">
          {[...new Map(b.missing.map((m) => [m.need, m])).values()].map((m) => (
            <Muted key={m.key}>{`${BODY_AGE_FACTORS[m.key].label}${b.missing.filter((x) => x.need === m.need).length > 1 ? ' and more' : ''}: needs ${m.need}.`}</Muted>
          ))}
          {b.missing.some((m) => m.key === 'bmi') ? <Button label="Add your height" variant="secondary" onPress={() => router.push('/account')} /> : null}
        </Card>
      ) : null}

      <Card title="HOW IT WORKS">
        <Muted>
          {`Each factor is linked, in large studies, to how long people live. Risk roughly doubles every 8 years of age, so a higher or lower risk becomes years. The factors overlap (active people also have lower resting heart rates), so each counts at half its study effect, at most 3 years, and 10 in total. ${
            profile.sex ? '' : 'Your sex isn’t set, so cardio fitness is compared with the average of men’s and women’s norms. '
          }It’s a wellness estimate, not a medical test: use it to see which habits move you, not as a verdict.`}
        </Muted>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: 4 },
  big: { fontFamily: fonts.number, fontSize: 72, fontVariant: ['tabular-nums'] },
  heroLabel: { ...type.overline, color: colors.muted },
  lever: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leverText: { ...type.body, color: colors.text, flex: 1 },
  leverYears: { fontFamily: fonts.numberSemi, fontSize: 18 },
}));
