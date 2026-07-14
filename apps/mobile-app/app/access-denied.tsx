import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile, routeForRole } from '@/lib/auth';
import { palette, radii } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function AccessDeniedScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reason, setReason] = useState('Checking your account access.');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!active) return;
        if (!session?.user) {
          setReason('You are not signed in on this device.');
          return;
        }
        const nextProfile = await getProfile(session.user.id);
        if (!active) return;
        setProfile(nextProfile);
        if (!nextProfile) setReason('Your login exists, but no app profile is linked to it yet.');
        else if (!nextProfile.is_active) setReason('Your profile is currently inactive.');
        else if (!isValidProfile(nextProfile)) setReason('Your app profile is not enabled for this build.');
        else {
          router.replace(routeForRole(nextProfile.role));
          return;
        }
      } catch {
        if (active) setReason('We could not read your app profile. Please sign in again or contact support.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) return <Screen title="Access unavailable" subtitle="Checking your account."><LoadingState label="Checking access" /></Screen>;

  return (
    <Screen title="Access unavailable" subtitle="This section is not enabled for your role.">
      <Card style={styles.card}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="lock-outline" size={23} color={palette.coral} />
        </View>
        <Text style={styles.title}>Permission required</Text>
        <Text style={styles.text}>{reason}</Text>
        {isValidProfile(profile) ? <Button label="Go to dashboard" onPress={() => router.replace(routeForRole(profile.role))} /> : null}
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', gap: 8 },
  icon: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: palette.coralSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  text: { color: palette.slate, fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
