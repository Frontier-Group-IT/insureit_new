import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerSupport, type PartnerSupport } from '@/lib/engagement';
import { PartnerProfileMenuIcon } from '@/components/ui/partner-profile-menu-icon';

type StatTone = 'warning' | 'info' | 'purple';

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

  useEffect(() => { void load(); }, [load]);

  return (
    <PartnerScreen title="Support" hideTopBar fullWidth navyStatusBar bottomNavigationNavy
      bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <View style={styles.contentInset}>
        <PartnerCasePageHeader title="Support" icon="headset-outline" onBack={() => router.back()} />
      </View>
      {loading ? (
        <PartnerStateView state="loading" title="Loading support" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Support is temporarily unavailable"
          message={error || 'Support information could not be loaded.'}
          actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={styles.heroIconShell}>
              <PartnerProfileMenuIcon kind="support" size={60} />
            </View>
            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroInformation}>
                  <Text style={styles.heroTitle} numberOfLines={2}>INSUREIT Operations Desk</Text>
                  <Text style={styles.heroSubtitle} numberOfLines={2}>Your operational overview</Text>
                </View>
                <View style={styles.heroRight}>
                  <View style={styles.updatedLine}>
                    <Text style={styles.updatedText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{formatUpdatedAt(data.generated_at)}</Text>
                  </View>
                  <View style={styles.heroActions}>
                    <View style={styles.heroActionBubble}>
                      <Ionicons name="chatbubble-ellipses" size={23} color="#2681EB" />
                    </View>
                    <View style={styles.heroActionBubble}>
                      <Ionicons name="document-text" size={23} color="#1E70D4" />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.contentInset}>
          {data.relationship_contact ? (
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{initials(data.relationship_contact.name)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>YOUR RELATIONSHIP CONTACT</Text>
                <Text style={styles.contactName}>{data.relationship_contact.name}</Text>
                <Text style={styles.contactMeta}>
                  {[data.relationship_contact.designation, data.relationship_contact.employee_code].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.contactActions}>
                <ContactAction icon="call-outline" label="Call" disabled={!data.relationship_contact.phone}
                  onPress={() => { if (data.relationship_contact?.phone) void Linking.openURL('tel:' + data.relationship_contact.phone); }} />
                <ContactAction icon="mail-outline" label="Email" disabled={!data.relationship_contact.email}
                  onPress={() => { if (data.relationship_contact?.email) void Linking.openURL('mailto:' + data.relationship_contact.email); }} />
              </View>
            </View>
          ) : null}

          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Operations Desk</Text>
            <View style={styles.sectionUnderline} />
          </View>

          <View style={styles.statList}>
            <OpsStat value={data.operations.intakes_need_attention}
              label="Need your attention" helper="Items that require your action"
              tone="warning" onPress={() => router.push('/policy-intakes')} />
            <OpsStat value={data.operations.intakes_in_progress}
              label="Policy Intakes in progress" helper="Policies currently being processed"
              tone="info" onPress={() => router.push('/policy-intakes')} />
            <OpsStat value={data.operations.active_claims}
              label="Active claims" helper="Claims currently in progress"
              tone="purple" onPress={() => router.push('/(tabs)/claims')} />
          </View>
          <View pointerEvents="none" style={styles.bottomWaveArea}>
            <View style={styles.bottomWavePale} />
            <View style={styles.bottomWaveBlue} />
            <View style={styles.bottomWaveLight} />
          </View>
          </View>
        </View>
      )}
    </PartnerScreen>
  );
}

function ContactAction({ icon, label, disabled, onPress }: {
  icon: 'call-outline' | 'mail-outline'; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.contactAction, disabled && styles.disabled]}>
      <Ionicons name={icon} size={17} color="#246AC7" />
    </Pressable>
  );
}

function OpsStat({ value, label, helper, onPress, tone }: {
  value: number; label: string; helper: string; onPress: () => void; tone: StatTone;
}) {
  const color = tone === 'warning' ? '#DF284B' : tone === 'info' ? '#176ED6' : '#6B35D8';
  const icon = tone === 'warning' ? 'alert-circle' : tone === 'info' ? 'hourglass' : 'shield-checkmark';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label + ': ' + value + '. ' + helper}
      accessibilityHint="Opens the related records" onPress={onPress}
      style={({ pressed }) => [styles.statCard, pressed && styles.statPressed]}>
      <View style={[styles.statIconBox, tone === 'warning' ? styles.warningIconBg : tone === 'info' ? styles.infoIconBg : styles.purpleIconBg]}>
        <Ionicons name={icon} size={29} color={color} />
        <View style={[styles.countBubble, { backgroundColor: color }]}>
          <Text style={styles.countText}>{value}</Text>
        </View>
      </View>
      <View style={[styles.statDivider, { backgroundColor: color }]} />
      <View style={styles.statWords}>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.statHelper} numberOfLines={2}>{helper}</Text>
      </View>
      <View style={styles.arrowCircle}>
        <Ionicons name="chevron-forward" size={21} color={color} />
      </View>
    </Pressable>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'IT';
}
function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Updated recently';
  return 'Updated today · ' + new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(d);
}

const styles = StyleSheet.create({
  page: { paddingBottom: 12, overflow: 'hidden' },
  contentInset: { paddingHorizontal: 16 },
  hero: {
    minHeight: 106, marginHorizontal: 0, borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderColor: '#E1E6EF',
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, overflow: 'hidden',
    shadowColor: '#396CB2', shadowOpacity: 0.09, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  heroIconShell: { height: 60, width: 60, alignItems: 'center', justifyContent: 'center', marginRight: 12, zIndex: 1 },
  heroContent: { flex: 1, minWidth: 0, zIndex: 1 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' },
  heroInformation: { flex: 1, minWidth: 0, minHeight: 60, justifyContent: 'center' },
  heroTitle: { color: '#071B42', fontWeight: '800', fontSize: 12.8, lineHeight: 17 },
  heroSubtitle: { marginTop: 4, color: '#4E6484', fontSize: 10, lineHeight: 14 },
  heroRight: { flexShrink: 0, width: 100, alignItems: 'flex-end', justifyContent: 'center', gap: 7 },
  updatedLine: { width: '100%', alignItems: 'flex-end' },
  updatedText: { color: '#255390', fontSize: 9.2, fontWeight: '700', textAlign: 'right' },
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, zIndex: 1 },
  heroActionBubble: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDEBFF' },
  sectionTitleWrap: { marginTop: 19, marginBottom: 13 },
  sectionTitle: { color: '#071B42', fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  sectionUnderline: { marginTop: 5, width: 50, height: 4, borderRadius: 3, backgroundColor: '#3287EF' },
  statList: { gap: 12 },
  statCard: {
    minHeight: 91, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#E3E7EF', overflow: 'hidden', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 11,
    shadowColor: '#617AA4', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  statPressed: { opacity: 0.84 },
  statIconBox: { width: 53, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  warningIconBg: { backgroundColor: '#FBE5F0' }, infoIconBg: { backgroundColor: '#DFECFF' },
  purpleIconBg: { backgroundColor: '#EFE0FF' },
  countBubble: { position: 'absolute', right: -5, top: -7, minWidth: 25, height: 25, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#FFFFFF', elevation: 2 },
  countText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  statDivider: { width: 1, height: 49, marginLeft: 13, marginRight: 13, opacity: 0.6 },
  statWords: { flex: 1, minWidth: 0, zIndex: 1 },
  statLabel: { color: '#071B42', fontSize: 12.6, fontWeight: '800', lineHeight: 17 },
  statHelper: { marginTop: 3, color: '#586A84', fontSize: 10.2, lineHeight: 14 },
  arrowCircle: { marginLeft: 5, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0E5EC', backgroundColor: '#F5F6F8', zIndex: 1 },
  bottomWaveArea: { marginTop: 15, minHeight: 32, overflow: 'hidden' },
  bottomWavePale: { position: 'absolute', width: '140%', height: 66, left: -48, top: 16,
    borderRadius: 95, backgroundColor: '#E6EFFD', transform: [{ rotate: '5deg' }] },
  bottomWaveBlue: { position: 'absolute', width: '120%', height: 66, left: -30, top: 24,
    borderRadius: 95, backgroundColor: '#BED7FF', transform: [{ rotate: '-5deg' }] },
  bottomWaveLight: { position: 'absolute', width: '130%', height: 60, left: -40, top: 30,
    borderRadius: 95, backgroundColor: '#D6E5FF', transform: [{ rotate: '7deg' }] },
  contactCard: { marginTop: 10, padding: 10, backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1,
    borderColor: '#E1E9F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8E9FF' },
  contactAvatarText: { color: '#2358A2', fontWeight: '800', fontSize: 12 },
  contactInfo: { flex: 1, minWidth: 0 },
  contactLabel: { fontSize: 8, letterSpacing: 0.5, color: '#5D6F8D', fontWeight: '700' },
  contactName: { fontWeight: '800', color: '#10284E', fontSize: 12 },
  contactMeta: { fontSize: 9, color: '#61718A' },
  contactActions: { flexDirection: 'row', gap: 5 },
  contactAction: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EBF4FF',
    alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
