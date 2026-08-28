import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MetricCard } from '@/components/metric-card';
import { PartnerScreen } from '@/components/partner-screen';
import { ScopeCard } from '@/components/scope-card';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function PartnerHomeScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  if (!context) return null;

  const { identity, scope } = context;
  const role = identity.actor_kind === 'employee' ? humanize(identity.role) : humanize(identity.intermediary_type);

  return (
    <PartnerScreen
      eyebrow="INSUREIT PARTNER"
      title={greeting(identity.display_name)}
      action={
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(identity.display_name)}</Text>
        </View>
      }
    >
      <Text style={styles.role}>{role}</Text>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>MY WORKSPACE</Text>
          <Text style={styles.heroTitle}>Business at a glance</Text>
          <Text style={styles.heroText}>One place for your authorized Partner network and insurance business workflows.</Text>
        </View>
        <View style={styles.heroMark}><Ionicons name="analytics-outline" size={28} color="#D8D6FF" /></View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Commercial network</Text>
        <Pressable onPress={() => router.push('/(tabs)/business')}><Text style={styles.sectionAction}>View business</Text></Pressable>
      </View>

      <View style={styles.metrics}>
        <MetricCard icon="people-outline" label="Partner families" value={scope.partner_ids.length} hint="Permanent Partner relationships" />
        <MetricCard icon="git-network-outline" label="Groups" value={scope.group_ids.length} hint="Active Intermediary Groups" />
      </View>

      <View style={styles.metrics}>
        <MetricCard icon="person-circle-outline" label="Intermediary accounts" value={scope.intermediary_ids.length} hint="Partner, POSP and MISP identities" />
        <MetricCard icon="people-circle-outline" label="Employee scope" value={scope.employee_ids.length} hint={scope.scope_mode === 'organization' ? 'Organization scope' : 'Authorized employee relationships'} />
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Access</Text>
      </View>
      <ScopeCard scope={scope} />

      <View style={styles.nextCard}>
        <View style={styles.nextIcon}><Ionicons name="sparkles-outline" size={18} color={partnerTheme.colors.brand} /></View>
        <View style={styles.nextBody}>
          <Text style={styles.nextTitle}>Next business modules</Text>
          <Text style={styles.nextText}>Policies, renewals and claims are visible in navigation now, but business data will only be connected after their scoped mobile contracts are approved.</Text>
        </View>
      </View>
    </PartnerScreen>
  );
}

function greeting(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || 'Partner';
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${prefix}, ${firstName}`;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  role: { marginTop: -11, marginBottom: 17, color: partnerTheme.colors.inkMuted, fontSize: 11 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  avatarText: { color: partnerTheme.colors.brandStrong, fontSize: 13, fontWeight: '800' },
  hero: {
    minHeight: 156,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: partnerTheme.radius.xl,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: partnerTheme.colors.nav,
  },
  heroCopy: { flex: 1, justifyContent: 'center' },
  heroEyebrow: { color: '#AAA5FF', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { marginTop: 7, color: partnerTheme.colors.white, fontSize: 21, fontWeight: '700' },
  heroText: { marginTop: 7, maxWidth: 260, color: '#C9D0DE', fontSize: 10.5, lineHeight: 16 },
  heroMark: { width: 62, alignItems: 'flex-end', justifyContent: 'flex-end' },
  sectionHeading: { marginTop: 22, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  sectionAction: { color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  nextCard: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    borderRadius: partnerTheme.radius.lg,
    padding: 16,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  nextIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  nextBody: { flex: 1 },
  nextTitle: { color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '700' },
  nextText: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 15 },
});
