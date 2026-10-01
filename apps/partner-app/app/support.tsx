import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
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
    <PartnerScreen title="Support" onBack={() => router.back()}>
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
          {data.relationship_contact ? (
            <View style={styles.personCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(data.relationship_contact.name)}</Text>
              </View>
              <View style={styles.personBody}>
                <Text style={styles.contactEyebrow}>YOUR RELATIONSHIP CONTACT</Text>
                <Text style={styles.name}>{data.relationship_contact.name}</Text>
                <Text style={styles.meta}>
                  {[data.relationship_contact.designation, data.relationship_contact.employee_code].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.updatedLine}>
                  <Ionicons name="time-outline" size={13} color="#64748B" />
                  <Text style={styles.updatedText}>{formatUpdatedAt(data.generated_at)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.operationsHero}>
              <View style={styles.operationsHeroWash} />
              <View style={styles.operationsHeroArc} />
              <View style={styles.operationsArtworkShell}>
                <Image
                  source={PartnerAssets.actions.supportVerified}
                  style={styles.operationsArtwork}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.operationsHeroBody}>
                <Text style={styles.operationsHeroTitle}>INSUREIT Operations Desk</Text>
                <Text style={styles.operationsHeroSubtitle}>Your operational overview</Text>
                <View style={styles.updatedLine}>
                  <Ionicons name="time-outline" size={13} color="#52647D" />
                  <Text style={styles.updatedText}>{formatUpdatedAt(data.generated_at)}</Text>
                </View>
              </View>

              <View style={styles.operationsHeroDecor} pointerEvents="none">
                <View style={styles.decorSheet}>
                  <Ionicons name="document-text-outline" size={25} color="#B7D2FA" />
                </View>
                <View style={styles.decorChat}>
                  <Ionicons name="chatbox-ellipses" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.decorHeadset}>
                  <Ionicons name="headset" size={32} color="#2C7CF6" />
                </View>
              </View>
            </View>
          )}

          {data.relationship_contact ? (
            <View style={styles.contactRow}>
              <ContactAction
                icon="call-outline"
                label="Call"
                disabled={!data.relationship_contact.phone}
                onPress={() =>
                  data.relationship_contact?.phone
                    ? void Linking.openURL(`tel:${data.relationship_contact.phone}`)
                    : undefined
                }
              />
              <ContactAction
                icon="mail-outline"
                label="Email"
                disabled={!data.relationship_contact.email}
                onPress={() =>
                  data.relationship_contact?.email
                    ? void Linking.openURL(`mailto:${data.relationship_contact.email}`)
                    : undefined
                }
              />
            </View>
          ) : null}

          <PartnerSectionHeader title="Operations desk" />
          <View style={styles.opsCard}>
            <OpsStat
              value={data.operations.intakes_need_attention}
              label="Need your attention"
              helper="Items that require your action"
              onPress={() => router.push('/policy-intakes')}
              tone="warning"
            />
            <OpsStat
              value={data.operations.intakes_in_progress}
              label="Policy Intakes in progress"
              helper="Policies currently being processed"
              onPress={() => router.push('/policy-intakes')}
              tone="info"
            />
            <OpsStat
              value={data.operations.active_claims}
              label="Active claims"
              helper="Claims currently in progress"
              onPress={() => router.push('/(tabs)/claims')}
              tone="orange"
              last
            />
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
  helper,
  onPress,
  tone,
  last = false,
}: {
  value: number;
  label: string;
  helper: string;
  onPress: () => void;
  tone: 'warning' | 'info' | 'orange';
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${helper}`}
      accessibilityHint="Opens the related records"
      onPress={onPress}
      style={({ pressed }) => [styles.opsRow, !last && styles.opsDivider, pressed && styles.opsRowPressed]}
    >
      <View
        style={[
          styles.opsCount,
          tone === 'warning' && styles.opsCountWarning,
          tone === 'info' && styles.opsCountInfo,
          tone === 'orange' && styles.opsCountOrange,
        ]}
      >
        <Text
          style={[
            styles.opsValue,
            tone === 'warning' && styles.opsValueWarning,
            tone === 'info' && styles.opsValueInfo,
            tone === 'orange' && styles.opsValueOrange,
          ]}
        >
          {value}
        </Text>
      </View>
      <View style={styles.opsTextBlock}>
        <Text style={styles.opsLabel}>{label}</Text>
        <Text style={styles.opsHelper}>{helper}</Text>
      </View>
    </Pressable>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IT';
}

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Updated recently';
  return `Updated today · ${new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)}`;
}

const styles = StyleSheet.create({
  personCard: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#F2F7FF',
    borderWidth: 1,
    borderColor: '#D8E7F8',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15365F',
  },
  avatarText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  personBody: { flex: 1 },
  contactEyebrow: {
    color: '#6A55DA',
    letterSpacing: 0.9,
    ...partnerTheme.typography.meta,
  },
  name: {
    marginTop: 3,
    color: '#081A37',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  meta: { marginTop: 2, color: '#66758B', ...partnerTheme.typography.caption },

  operationsHero: {
    minHeight: 104,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F1F7FF',
    borderWidth: 1,
    borderColor: '#D6E6F8',
    shadowColor: '#173B69',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  operationsHeroWash: {
    position: 'absolute',
    right: -45,
    top: -58,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#D8EAFF',
    opacity: 0.78,
  },
  operationsHeroArc: {
    position: 'absolute',
    right: 52,
    bottom: -92,
    width: 190,
    height: 150,
    borderRadius: 80,
    backgroundColor: '#E4F1FF',
    transform: [{ rotate: '-20deg' }],
  },
  operationsArtworkShell: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDEEFF',
    zIndex: 2,
  },
  operationsArtwork: { width: 44, height: 44 },
  operationsHeroBody: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 102,
    zIndex: 2,
  },
  operationsHeroTitle: {
    color: '#071A38',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  operationsHeroSubtitle: {
    marginTop: 2,
    color: '#62738C',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  updatedLine: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updatedText: {
    color: '#66758B',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  operationsHeroDecor: {
    position: 'absolute',
    right: 14,
    top: 16,
    width: 90,
    height: 72,
    zIndex: 1,
  },
  decorSheet: {
    position: 'absolute',
    right: 12,
    top: 0,
    width: 43,
    height: 37,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  decorChat: {
    position: 'absolute',
    left: 3,
    bottom: 1,
    width: 34,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C9DFF',
  },
  decorHeadset: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FF',
    borderWidth: 2,
    borderColor: '#77ACF8',
  },

  contactRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  contactAction: {
    flex: 1,
    minHeight: partnerTheme.control.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: partnerTheme.radius.md,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  contactText: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  disabled: { opacity: 0.45 },

  opsCard: {
    overflow: 'hidden',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF1',
    shadowColor: '#173B69',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  opsRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  opsDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF2',
  },
  opsRowPressed: { backgroundColor: '#F7FAFF' },
  opsCount: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opsCountWarning: { backgroundColor: '#FFF0F1' },
  opsCountInfo: { backgroundColor: '#EEF6FF' },
  opsCountOrange: { backgroundColor: '#FFF3E9' },
  opsValue: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  opsValueWarning: { color: '#E5353F' },
  opsValueInfo: { color: '#0876DE' },
  opsValueOrange: { color: '#F47A11' },
  opsTextBlock: { flex: 1, minWidth: 0 },
  opsLabel: {
    color: '#071A38',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  opsHelper: {
    marginTop: 1,
    color: '#718096',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  pressed: { opacity: 0.78 },
});
