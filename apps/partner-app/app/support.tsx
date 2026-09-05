import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerSupport, type PartnerSupport } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function SupportScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerSupport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerSupport());
    } catch {
      setData(null);
      setError('Support information could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen
      eyebrow="SUPPORT"
      title="Support"
      onBack={() => router.back()}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading support" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          asset={PartnerAssets.emptyStates.supportResolved}
          title="Support is temporarily unavailable"
          message={error || 'Support information could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.freshness}>
            <Text style={styles.updated}>{formatUpdatedAt(data.generated_at)}</Text>
          </View>

          {data.relationship_contact ? (
            <View style={styles.personCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.relationship_contact.name)}</Text></View>
              <View style={styles.personBody}>
                <Text style={styles.eyebrow}>YOUR RELATIONSHIP CONTACT</Text>
                <Text style={styles.name}>{data.relationship_contact.name}</Text>
                <Text style={styles.meta}>{[data.relationship_contact.designation, data.relationship_contact.employee_code].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.teamCard}>
              <View style={styles.teamArtwork}>
                <Image source={PartnerAssets.actions.supportVerified} style={styles.teamArtworkImage} resizeMode="contain" />
              </View>
              <View style={styles.personBody}>
                <Text style={styles.teamName}>INSUREIT Operations Desk</Text>
              </View>
            </View>
          )}

          {data.relationship_contact ? (
            <View style={styles.contactRow}>
              <ContactAction
                icon="call-outline"
                label="Call"
                disabled={!data.relationship_contact.phone}
                onPress={() => data.relationship_contact?.phone ? void Linking.openURL(`tel:${data.relationship_contact.phone}`) : undefined}
              />
              <ContactAction
                icon="mail-outline"
                label="Email"
                disabled={!data.relationship_contact.email}
                onPress={() => data.relationship_contact?.email ? void Linking.openURL(`mailto:${data.relationship_contact.email}`) : undefined}
              />
            </View>
          ) : null}

          <PartnerSectionHeader title="Operations desk" />
          <View style={styles.opsCard}>
            <OpsStat value={data.operations.intakes_need_attention} label="Need your attention" onPress={() => router.push('/policy-intakes')} tone={data.operations.intakes_need_attention ? 'warning' : 'neutral'} />
            <OpsStat value={data.operations.intakes_in_progress} label="Policy Intakes in progress" onPress={() => router.push('/policy-intakes')} />
            <OpsStat value={data.operations.active_claims} label="Active claims" onPress={() => router.push('/(tabs)/claims')} last />
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function ContactAction({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'call-outline' | 'mail-outline';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.contactAction, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color={disabled ? '#AAB2C0' : partnerTheme.colors.brand} />
      <Text style={styles.contactText}>{label}</Text>
    </Pressable>
  );
}

function OpsStat({
  value,
  label,
  onPress,
  tone = 'neutral',
  last = false,
}: {
  value: number;
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'warning';
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.opsRow, !last && styles.opsDivider, pressed && styles.pressed]}
    >
      <View style={[styles.opsIcon, tone === 'warning' && styles.opsIconWarn]}>
        <Text style={[styles.opsValue, tone === 'warning' && styles.opsValueWarn]}>{value}</Text>
      </View>
      <Text style={styles.opsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
    </Pressable>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IT';
}

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Support scope loaded';
  return `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(d)}`;
}

const styles = StyleSheet.create({
  freshness: { minHeight: 22, marginTop: -8, marginBottom: 8, alignItems: 'flex-end', justifyContent: 'center' },
  updated: { color: '#8A94A6', ...partnerTheme.typography.meta },
  personCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  teamCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  avatar: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#383F52' },
  avatarText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  teamArtwork: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  teamArtworkImage: { width: 42, height: 42 },
  personBody: { flex: 1 },
  eyebrow: { color: '#AAA5FF', letterSpacing: 1, ...partnerTheme.typography.meta },
  name: { marginTop: 4, color: '#FFFFFF', ...partnerTheme.typography.sectionTitle },
  meta: { marginTop: 3, color: '#C5CCDA', ...partnerTheme.typography.caption },
  teamName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.cardTitle },
  contactRow: { marginTop: 7, flexDirection: 'row', gap: 8 },
  contactAction: { flex: 1, minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: partnerTheme.radius.md, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  contactText: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  disabled: { opacity: 0.45 },
  opsCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  opsRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  opsDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  opsIcon: { minWidth: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  opsIconWarn: { backgroundColor: partnerTheme.colors.warningSoft },
  opsValue: { color: partnerTheme.colors.brandStrong, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  opsValueWarn: { color: partnerTheme.colors.warning },
  opsLabel: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  pressed: { opacity: 0.78 },
});
