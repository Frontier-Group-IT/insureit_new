import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
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

      <PartnerSectionHeader title="Registration" />
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

      <PartnerSectionHeader title="Commercial access" />
      <ScopeCard scope={scope} />

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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  avatar: { width: 44, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#383F52' },
  avatarText: { color: partnerTheme.colors.white, ...partnerTheme.typography.bodyStrong },
  heroBody: { flex: 1 },
  name: { color: partnerTheme.colors.white, ...partnerTheme.typography.sectionTitle },
  role: { marginTop: 4, color: '#C5CCDA', ...partnerTheme.typography.caption },
  details: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  detailRow: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  detailLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  detailValue: { flex: 1, textAlign: 'right', color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
});
