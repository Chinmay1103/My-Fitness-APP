import { Card, Muted, Screen } from '@/components/ui';

export default function CoachScreen() {
  return (
    <Screen>
      <Card title="AI COACH">
        <Muted>
          Coming in milestone 4: chat with a coach that sees your recovery, sleep, strain, workout plan and meals.
          Ask things like "Should I train legs today?" and get an answer based on your own numbers.
        </Muted>
      </Card>
    </Screen>
  );
}
