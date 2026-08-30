import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { ScopeCard } from '@/components/scope-card';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  if (!context) return null;

  const { identity, scope } = context;

  return (
    <PartnerScreen
      eyebrow="ACCOUNT"
      title="Profile & registration"
      action={
        <PartnerIconButton icon="close" label="Close profile" onPress={() => router.back()} />
      }
    >
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(identity.display_name)}</Text></View>
        <View style={styles.heroBody}>
          <Text style={styles.name}>{identity.display_name}</Text>
          <Text style={styles.role}>{identity.actor_kind === 'employee' ? humanize(identity.role) : humanize(identity.intermediary_type)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        {identity.actor_kind === 'employee' ? (
          <>
            <Detail label="Employee code" value={identity.employee_code} />
            <Detail label="Designation" value={identity.designation || 'Not recorded'} />
            <Detail label="Role" value={humanize(identity.role)} />
          </>
        ) : (
          <>
            <Detail label="Intermediary code" value={identity.intermediary_code || 'Not recorded'} />
            <Detail label="Intermediary type" value={humanize(identity.intermediary_type)} />
            <Detail label="Partner family" value={identity.partner_name} />
            <Detail label="Partner code" value={identity.partner_code} />
            <Detail label="Portal status" value="Active" />
          </>
        )}
      </View>

      <View style={styles.scopeHeading}><Text style={styles.scopeTitle}>Commercial access</Text></View>
      <ScopeCard scope={scope} />

      <View style={styles.notice}>
        <Ionicons name="lock-closed-outline" size={16} color={partnerTheme.colors.brand} />
        <Text style={styles.noticeText}>Sensitive onboarding documents and identity numbers are intentionally not exposed in the mobile profile surface.</Text>
      </View>
    </PartnerScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_',' ').replace(/\b\w/g,(letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.nav },
  avatar: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#383F52' },
  avatarText: { color: partnerTheme.colors.white, fontSize: 14, fontWeight: '800' },
  heroBody: { flex: 1 },
  name: { color: partnerTheme.colors.white, fontSize: 16, fontWeight: '800' },
  role: { marginTop: 4, color: '#C5CCDA', fontSize: 9.5 },
  details: { marginTop: 14, overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  detailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  detailLabel: { color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  detailValue: { flex: 1, textAlign: 'right', color: partnerTheme.colors.ink, fontSize: 10, fontWeight: '700' },
  scopeHeading: { marginTop: 20, marginBottom: 10 },
  scopeTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  notice: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: partnerTheme.radius.md, padding: 13, backgroundColor: partnerTheme.colors.brandSoft },
  noticeText: { flex: 1, color: '#5D5A80', fontSize: 9.5, lineHeight: 14 },
});
