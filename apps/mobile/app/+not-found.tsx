import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { makeStyles, useColors } from '@/lib/theme';

export default function NotFoundScreen() {
  const styles = useStyles();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          Go to Today
        </Link>
      </View>
    </>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  link: { marginTop: 15, paddingVertical: 15, fontSize: 14, color: colors.strain },
}));
