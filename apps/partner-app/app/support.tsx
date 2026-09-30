import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerSupport, type PartnerSupport } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type OpsTone = 'danger' | 'info' | 'claim';

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
          title="Support is temporarily unavailable"
          message={error || 'Support information could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <OperationsHero updatedAt={data.generated_at} />

          {data.relationship_contact ? (
            <View style={styles.contactStrip}>
              <View style={styles.contactIdentity}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(data.relationship_contact.name)}</Text>
                </View>
                <View style={styles.contactIdentityCopy}>
                  <Text style={styles.contactEyebrow}>YOUR RELATIONSHIP CONTACT</Text>
                  <Text numberOfLines={1} style={styles.contactName}>{data.relationship_contact.name}</Text>
                </View>
              </View>
              <View style={styles.contactActions}>
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
            </View>
          ) : null}

          <View style={styles.sectionHeaderWrap}>
            <PartnerSectionHeader title="Operations desk" />
          </View>
          <View style={styles.opsCard}>
            <OpsStat
              value={data.operations.intakes_need_attention}
              icon="warning"
              label="Need your attention"
              subtitle="Items that require your action"
              tone="danger"
              onPress={() => router.push('/policy-intakes')}
            />
            <OpsStat
              value={data.operations.intakes_in_progress}
              icon="document-text"
              label="Policy Intakes in progress"
              subtitle="Policies currently being processed"
              tone="info"
              onPress={() => router.push('/policy-intakes')}
            />
            <OpsStat
              value={data.operations.active_claims}
              icon="shield-outline"
              label="Active claims"
              subtitle="Claims currently in progress"
              tone="claim"
              onPress={() => router.push('/(tabs)/claims')}
              last
            />
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function OperationsHero({ updatedAt }: { updatedAt: string }) {
  return (
    <View style={styles.heroCard}>
      <View pointerEvents="none" style={styles.heroCircle} />
      <View pointerEvents="none" style={styles.heroSweep} />

      <View style={styles.heroArtworkShell}>
        <Image
          source={PartnerAssets.actions.supportVerified}
          style={styles.heroArtworkImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>INSUREIT Operations Desk</Text>
        <Text style={styles.heroSubtitle}>Your operational overview</Text>
        <View style={styles.heroUpdatedRow}>
          <Ionicons name="time-outline" size={14} color="#526582" />
          <Text style={styles.heroUpdated}>{formatUpdatedAt(updatedAt)}</Text>
        </View>
      </View>

      <View pointerEvents="none" style={styles.heroIllustration}>
        <View style={styles.heroDocument}>
          <View style={styles.heroDocumentDot} />
          <View style={styles.heroDocumentLineWide} />
          <View style={styles.heroDocumentLine} />
        </View>
        <View style={styles.heroChatSmall}>
          <Ionicons name="chatbox-ellipses" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.heroHeadset}>
          <Ionicons name="headset" size={34} color="#1558D6" />
        </View>
      </View>
    </View>
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
      <Ionicons name={icon} size={17} color={disabled ? '#AAB2C0' : '#1558D6'} />
      <Text style={styles.contactActionText}>{label}</Text>
    </Pressable>
  );
}

function OpsStat({
  value,
  icon,
  label,
  subtitle,
  tone,
  onPress,
  last = false,
}: {
  value: number;
  icon: IconName;
  label: string;
  subtitle: string;
  tone: OpsTone;
  onPress: () => void;
  last?: boolean;
}) {
  const toneStyle = OPS_TONES[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.opsRow, !last && styles.opsDivider, pressed && styles.opsPressed]}
    >
      <View style={[styles.opsTypeIcon, { backgroundColor: toneStyle.iconBg }]}>
        <Ionicons name={icon} size={25} color={toneStyle.icon} />
      </View>

      <View style={[styles.opsCount, { backgroundColor: toneStyle.countBg }]}>
        <Text style={[styles.opsValue, { color: toneStyle.count }]}>{value}</Text>
      </View>

      <View style={styles.opsCopy}>
        <Text numberOfLines={1} style={styles.opsLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.opsSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={24} color="#294A78" />
    </Pressable>
  );
}

const OPS_TONES: Record<OpsTone, { iconBg: string; icon: string; countBg: string; count: string }> = {
  danger: { iconBg: '#FDEBEC', icon: '#D9363E', countBg: '#FDEDED', count: '#D51F2A' },
  info: { iconBg: '#EAF5FF', icon: '#0791E8', countBg: '#EAF4FF', count: '#0572C8' },
  claim: { iconBg: '#FFF1E8', icon: '#F47B12', countBg: '#FFF2E8', count: '#EA7600' },
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IT';
}

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Updated today';
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d).toLowerCase();
  return `Updated today · ${time}`;
}

const styles = StyleSheet.create({
  heroCard: {
    minHeight: 104,
    marginTop: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CFE5FA',
    backgroundColor: '#EEF8FF',
    paddingLeft: 16,
    paddingRight: 106,
    shadowColor: '#0C4A86',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  heroCircle: {
    position: 'absolute',
    right: -18,
    bottom: -52,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: '#DCEEFF',
  },
  heroSweep: {
    position: 'absolute',
    right: 58,
    bottom: -46,
    width: 144,
    height: 108,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.48)',
    transform: [{ rotate: '-31deg' }],
  },
  heroArtworkShell: {
    width: 58,
    height: 58,
    marginRight: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FF',
  },
  heroArtworkImage: { width: 50, height: 50 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: {
    color: '#07152D',
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  heroSubtitle: {
    marginTop: 1,
    color: '#62718A',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  heroUpdatedRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroUpdated: {
    color: '#526582',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  heroIllustration: {
    position: 'absolute',
    right: 13,
    top: 13,
    width: 83,
    height: 78,
  },
  heroDocument: {
    position: 'absolute',
    right: 7,
    top: 0,
    width: 52,
    height: 55,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(167,205,242,0.55)',
    padding: 9,
  },
  heroDocumentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B9D7FF',
    marginBottom: 5,
  },
  heroDocumentLineWide: {
    height: 4,
    width: 26,
    borderRadius: 2,
    backgroundColor: '#C5DCF9',
  },
  heroDocumentLine: {
    marginTop: 5,
    height: 4,
    width: 19,
    borderRadius: 2,
    backgroundColor: '#C5DCF9',
  },
  heroChatSmall: {
    position: 'absolute',
    left: 0,
    bottom: 5,
    width: 34,
    height: 27,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B84F6',
  },
  heroHeadset: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(215,237,255,0.9)',
  },
  contactStrip: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE6F1',
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  contactIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#163A73',
  },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  contactIdentityCopy: { flex: 1, minWidth: 0 },
  contactEyebrow: { color: '#6B7A90', fontSize: 8.5, lineHeight: 11, letterSpacing: 1, fontWeight: '700' },
  contactName: { marginTop: 2, color: '#0B1730', fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  contactActions: { marginTop: 9, flexDirection: 'row', gap: 8 },
  contactAction: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E3F0',
    backgroundColor: '#F8FBFF',
  },
  contactActionText: { color: '#18385F', fontSize: 11.5, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  sectionHeaderWrap: { marginTop: 10 },
  opsCard: {
    overflow: 'hidden',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E8F0',
    shadowColor: '#17375D',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  opsRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  opsDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  opsTypeIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opsCount: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opsValue: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
  opsCopy: { flex: 1, minWidth: 0 },
  opsLabel: {
    color: '#07152D',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.08,
  },
  opsSubtitle: {
    marginTop: 2,
    color: '#66758E',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  opsPressed: { backgroundColor: '#F7FAFE' },
  pressed: { opacity: 0.78 },
});
