import { ageOn } from '@fitness/scoring';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Input, Muted } from '@/components/ui';
import { type } from '@/constants/theme';
import { fetchProfileRow, saveProfile } from '@/lib/profile';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles } from '@/lib/theme';

/**
 * Birth date, sex and height: what workout calories, max heart rate and body age need. Stored in
 * the profile, the same one the coach updates when you tell it. Shown when signed in.
 */
export function AboutYouCard() {
  const styles = useStyles();
  const { refresh } = useScores();
  const [birth, setBirth] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [height, setHeight] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileRow()
      .then((row) => {
        if (!row) return;
        setBirth(row.birth_date ?? '');
        setSex(row.sex === 'male' || row.sex === 'female' ? row.sex : null);
        setHeight(row.height_cm ? String(row.height_cm) : '');
      })
      .finally(() => setLoaded(true));
  }, []);

  const birthOk = birth === '' || (/^\d{4}-\d{2}-\d{2}$/.test(birth) && !Number.isNaN(Date.parse(birth)) && ageOn(birth, Date.now()) >= 10 && ageOn(birth, Date.now()) <= 100);
  const heightNum = height === '' ? null : Number(height);
  const heightOk = heightNum === null || (Number.isInteger(heightNum) && heightNum >= 120 && heightNum <= 230);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveProfile({ birth_date: birth || null, sex, height_cm: heightNum });
      setMessage('Saved. Scores, calories and body age now use it.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="ABOUT YOU">
      <Muted>Used for max heart rate, workout calories and body age. Only you (and your coach chat) can see it.</Muted>
      <Text style={styles.label}>Birth date</Text>
      <Input value={birth} onChangeText={setBirth} placeholder="YYYY-MM-DD, e.g. 1998-04-23" keyboardType="numbers-and-punctuation" maxLength={10} />
      {!birthOk ? <Text style={styles.error}>Write it as year-month-day, e.g. 1998-04-23.</Text> : birth ? <Muted>{`Age ${ageOn(birth, Date.now())}`}</Muted> : null}
      <Text style={styles.label}>Sex</Text>
      <View style={styles.chips}>
        <Chip label="Male" selected={sex === 'male'} onPress={() => setSex(sex === 'male' ? null : 'male')} />
        <Chip label="Female" selected={sex === 'female'} onPress={() => setSex(sex === 'female' ? null : 'female')} />
      </View>
      <Text style={styles.label}>Height (cm)</Text>
      <Input value={height} onChangeText={(t) => setHeight(t.replace(/[^0-9]/g, ''))} placeholder="e.g. 172" keyboardType="number-pad" maxLength={3} />
      {!heightOk ? <Text style={styles.error}>Between 120 and 230 cm.</Text> : null}
      <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={!loaded || busy || !birthOk || !heightOk} />
      {message ? <Muted>{message}</Muted> : null}
      <Muted>Weight comes from your weigh-ins: tell the coach whenever you step on a scale.</Muted>
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  label: { ...type.overline, color: colors.muted, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8 },
  error: { ...type.caption, color: colors.recovery.red },
}));
