import { useRouter } from 'expo-router';

import { Button, Card, Message, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function AccessDeniedScreen() {
  const router = useRouter();
  return (
    <Screen title="Access unavailable" subtitle="Your account cannot open this mobile experience right now.">
      <Card>
        <Message type="error">Please contact support if you believe your account should have access.</Message>
        <Button label="Back to sign in" onPress={async () => { await supabase.auth.signOut(); router.replace('/login'); }} />
      </Card>
    </Screen>
  );
}
