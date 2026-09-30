import { Card, Muted, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function LogScreen() {
  return (
    <Screen overline="LOG" title="Workouts and meals" glow={colors.muted}>
      <Card title="WORKOUTS">
        <Muted>Coming in milestone 3: log a session, or import your weekly workout plan.</Muted>
      </Card>
      <Card title="MEALS">
        <Muted>
          Coming in milestone 3: type what you ate (e.g. "2 rotis and dal") or snap a photo, and the AI estimates
          calories and macros.
        </Muted>
      </Card>
    </Screen>
  );
}
