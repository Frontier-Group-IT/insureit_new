import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MetricCard } from '@/components/metric-card';
import { PartnerScreen } from '@/components/partner-screen';
import { ScopeCard } from '@/components/scope-card';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function BusinessScreen() {
  const { context } = usePartnerSession();
  if (!context) return null;

  const { identity, scope } = context;

  return (
    <PartnerScreen eyebrow="MY BUSINESS" title="Commercial network">
      <ScopeCard scope={scope} />

      <View style={styles.heading}>
        <Text style={styles.sectionTitle}>Authorized structure</Text>
        <Text style={styles.sectionCopy}>Counts below come directly from your commercial access scope.</Text>
      </View>

      <View style={styles.metrics}>
        <MetricCard icon="people-outline" label="Partner families" value={scope.partner_ids.length} />
        <MetricCard icon="git-network-outline" label="Groups" value={scope.group_ids.length} />
      </View>
      <View style={styles.metrics}>
        <MetricCard icon="person-circle-outline" label="Intermediary accounts" value={scope.intermediary_ids.length} />
        <MetricCard icon="people-circle-outline" label="Employee scope" value={scope.employee_ids.length} />
      </View>

      <View style={styles.identityCard}>
        <View style={styles.identityIcon}><Ionicons name="id-card-outline" size={20} color={partnerTheme.colors.brand} /></View>
        <View style={styles.identityBody}>
          <Text style={styles.identityLabel}>SIGNED IN AS</Text>
          <Text style={styles.identityName}>{identity.display_name}</Text>
          <Text style={styles.identityMeta}>{identity.actor_kind === 'employee' ? employeeMeta(identity.employee_code, identity.designation) : intermediaryMeta(identity.intermediary_code, identity.partner_code)}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How this structure works</Text>
        <Text style={styles.infoText}>Permanent Partners remain the commercial family root. Linked POSP/MISP accounts inherit that Partner family's business relationship and Group context.</Text>
      </View>
    </PartnerScreen>
  );
}

function employeeMeta(code: string, designation: string | null) {
  return [code, designation].filter(Boolean).join(' · ');
}

function intermediaryMeta(code: string | null, partnerCode: string) {
  return [code, `Partner family ${partnerCode}`].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  heading: { marginTop: 22, marginBottom: 11 },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  sectionCopy: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 14 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  identityCard: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 13,
    borderRadius: partnerTheme.radius.lg,
    padding: 17,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  identityIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  identityBody: { flex: 1, justifyContent: 'center' },
  identityLabel: { color: partnerTheme.colors.inkMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  identityName: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  identityMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 14 },
  infoCard: { marginTop: 12, borderRadius: partnerTheme.radius.lg, padding: 17, backgroundColor: partnerTheme.colors.brandSoft },
  infoTitle: { color: partnerTheme.colors.brandStrong, fontSize: 11.5, fontWeight: '700' },
  infoText: { marginTop: 5, color: '#5D5A80', fontSize: 9.5, lineHeight: 15 },
});
