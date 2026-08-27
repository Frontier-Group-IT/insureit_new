import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type PartnerSessionContext, resolvePartnerSession, signOut } from '@/lib/partner-session';

export default function HomeScreen() {
  const router = useRouter();
  const [context, setContext] = useState<PartnerSessionContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePartnerSession()
      .then((value) => {
        if (!cancelled) setContext(value);
      })
      .catch(() => {
        if (!cancelled) router.replace('/access-denied');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  if (!context) {
    return <View style={styles.loading}><ActivityIndicator color="#5548D9" /></View>;
  }

  const { identity, scope } = context;
  const roleLabel = identity.actor_kind === 'employee'
    ? humanize(identity.role)
    : humanize(identity.intermediary_type);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>INSUREIT PARTNER</Text>
          <Text style={styles.greeting}>Hello, {identity.display_name}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>
        <Pressable onPress={logout} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>COMMERCIAL ACCESS</Text>
        <Text style={styles.heroTitle}>{scopeLabel(scope.scope_mode)}</Text>
        <Text style={styles.heroBody}>Your business workspace will be built from this server-authorized commercial scope.</Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Partner families" value={scope.partner_ids.length} />
        <Metric label="Groups" value={scope.group_ids.length} />
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Partner workspace foundation is ready</Text>
        <Text style={styles.placeholderText}>
          Home, Business, Customers, Policies, Renewals and Claims will be added after the Partner visual system and data contracts are finalized.
        </Text>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scopeLabel(value: PartnerSessionContext['scope']['scope_mode']) {
  if (value === 'partner_family') return 'My Partner family';
  if (value === 'hierarchy') return 'My sales hierarchy';
  if (value === 'organization') return 'Organization-wide';
  if (value === 'self') return 'My business';
  return 'No commercial scope';
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 20, paddingTop: 58, backgroundColor: '#F4F6FB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FB' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#6254E7', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  greeting: { marginTop: 6, maxWidth: 250, color: '#17203A', fontSize: 24, lineHeight: 30, fontWeight: '750' },
  role: { marginTop: 5, color: '#64748B', fontSize: 12 },
  signOut: { borderWidth: 1, borderColor: '#D8DFEA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  signOutText: { color: '#53627A', fontSize: 10, fontWeight: '700' },
  hero: { marginTop: 28, borderRadius: 22, padding: 22, backgroundColor: '#17203A' },
  heroEyebrow: { color: '#AFA7FF', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  heroBody: { marginTop: 8, color: '#CBD3E1', fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  metric: { flex: 1, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EE', padding: 17 },
  metricValue: { color: '#17203A', fontSize: 22, fontWeight: '750' },
  metricLabel: { marginTop: 4, color: '#6B778C', fontSize: 10 },
  placeholder: { marginTop: 14, borderRadius: 18, padding: 18, backgroundColor: '#ECEAFC' },
  placeholderTitle: { color: '#302A74', fontSize: 14, fontWeight: '700' },
  placeholderText: { marginTop: 7, color: '#5A5681', fontSize: 11, lineHeight: 17 },
});
