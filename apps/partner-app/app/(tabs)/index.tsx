import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function PartnerHomeScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  const [data, setData] = useState<PartnerHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerHome());
    } catch {
      setError('Your business Home could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (!context) return null;

  const { identity } = context;
  const role = identity.actor_kind === 'employee' ? humanize(identity.role) : humanize(identity.intermediary_type);

  return (
    <PartnerScreen
      eyebrow="INSUREIT PARTNER"
      title={greeting(identity.display_name)}
      action={
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/activity')} style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={18} color={partnerTheme.colors.ink} />
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(identity.display_name)}</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.role}>{role}</Text>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={24} color="#94A3B8" />
          <Text style={styles.errorText}>{error || 'Home is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <Pressable onPress={() => router.push('/pulse')} style={styles.pulseCard}>
            <View style={styles.pulseTop}>
              <View>
                <Text style={styles.pulseEyebrow}>YOUR PULSE</Text>
                <Text style={styles.pulseTitle}>{pulseTitle(data)}</Text>
              </View>
              <View style={styles.pulseOrb}><Ionicons name="pulse-outline" size={24} color="#FFFFFF" /></View>
            </View>

            <View style={styles.pulseSignals}>
              <Signal label="Business" value={humanize(data.pulse.business_momentum)} />
              <Signal label="Renewals" value={data.business.renewals_7_days ? `${data.business.renewals_7_days} due` : 'Clear'} />
              <Signal label="Service" value={data.service.claims_need_attention ? `${data.service.claims_need_attention} attention` : 'Steady'} />
            </View>

            <View style={styles.pulseFooter}>
              <Text style={styles.pulseFooterText}>See what is shaping today</Text>
              <Ionicons name="arrow-forward" size={14} color="#D8D6FF" />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today</Text>
            <Text style={styles.sectionMeta}>{todayLabel()}</Text>
          </View>

          {data.today.length ? (
            <View style={styles.todayList}>
              {data.today.map((item) => (
                <Pressable key={item.kind} onPress={() => router.push(item.route as never)} style={styles.todayRow}>
                  <View style={[styles.todayIcon, todayIconTone(item.kind)]}>
                    <Ionicons name={todayIcon(item.kind)} size={18} color={todayIconColor(item.kind)} />
                  </View>
                  <View style={styles.todayBody}>
                    <Text style={styles.todayTitle}>{item.title}</Text>
                    <Text style={styles.todaySubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#A0A8B6" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.clearCard}>
              <View style={styles.clearIcon}><Ionicons name="checkmark-circle-outline" size={22} color={partnerTheme.colors.success} /></View>
              <View style={styles.clearBody}>
                <Text style={styles.clearTitle}>You are clear for now</Text>
                <Text style={styles.clearText}>No urgent renewal, claim or Policy Intake action is waiting.</Text>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
          <View style={styles.quickGrid}>
            <QuickAction icon="add-circle-outline" label="New business" onPress={() => router.push('/policy-intake-new')} />
            <QuickAction icon="refresh-outline" label="Renewal" onPress={() => router.push('/renewals')} />
            <QuickAction icon="shield-outline" label="Claim" onPress={() => router.push('/(tabs)/claims')} />
            <QuickAction icon="person-outline" label="Customer" onPress={() => router.push('/customers')} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My business</Text>
            <Pressable onPress={() => router.push('/(tabs)/business')}>
              <Text style={styles.sectionAction}>View business</Text>
            </Pressable>
          </View>

          <View style={styles.businessCard}>
            <View style={styles.businessMain}>
              <Text style={styles.businessEyebrow}>THIS MONTH</Text>
              <Text style={styles.businessPremium}>{formatMoney(data.business.premium_this_month)}</Text>
              <Text style={styles.businessPremiumLabel}>gross premium</Text>
              <Trend value={Number(data.business.premium_change_percent || 0)} hasPrevious={Number(data.business.premium_last_month || 0) > 0} />
            </View>

            <View style={styles.businessStats}>
              <BusinessStat value={data.business.policies_this_month} label="Policies" />
              <BusinessStat value={data.business.total_customers} label="Customers" />
              <BusinessStat value={data.business.renewals_30_days} label="Renewals" />
              <BusinessStat value={data.service.active_claims} label="Claims" />
            </View>
          </View>

          <Pressable onPress={() => router.push('/impact')} style={styles.characterCard}>
            <View style={styles.characterIcon}><Ionicons name="heart-outline" size={20} color={partnerTheme.colors.accent} /></View>
            <View style={styles.characterBody}>
              <Text style={styles.characterEyebrow}>YOUR IMPACT</Text>
              <Text style={styles.characterTitle}>{impactTitle(data)}</Text>
              <Text style={styles.characterText}>{impactText(data)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7F9896" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function QuickAction({ icon, label, onPress }: {
  icon: 'add-circle-outline' | 'refresh-outline' | 'shield-outline' | 'person-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIcon}><Ionicons name={icon} size={21} color={partnerTheme.colors.brand} /></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue}>{value}</Text>
    </View>
  );
}

function BusinessStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.businessStat}>
      <Text style={styles.businessStatValue}>{value}</Text>
      <Text style={styles.businessStatLabel}>{label}</Text>
    </View>
  );
}

function Trend({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison month</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={13} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} />
      <Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}% {positive ? 'above' : 'below'} last month
      </Text>
    </View>
  );
}

function pulseTitle(data: PartnerHomeData) {
  const attention = data.service.intakes_need_attention + data.service.claims_need_attention + data.business.renewals_7_days;
  if (attention === 0 && data.pulse.business_momentum === 'rising') return 'Strong momentum';
  if (attention > 3) return 'Action-focused day';
  if (attention > 0) return 'A few things need you';
  return 'Steady and clear';
}

function impactTitle(data: PartnerHomeData) {
  if (data.impact.active_vehicles > 0) return `${data.impact.active_vehicles} vehicles currently protected`;
  if (data.impact.customers_served > 0) return `${data.impact.customers_served} customers in your authorized book`;
  return 'Your impact starts with every customer you help';
}

function impactText(data: PartnerHomeData) {
  const parts = [];
  if (data.impact.customers_served > 0) parts.push(`${data.impact.customers_served} customers served`);
  if (data.impact.claims_assisted > 0) parts.push(`${data.impact.claims_assisted} claims assisted`);
  return parts.length ? parts.join(' · ') : 'Business and service milestones will appear here as they happen.';
}

function todayIcon(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return 'document-text-outline' as const;
  if (kind === 'renewal') return 'refresh-outline' as const;
  return 'shield-outline' as const;
}

function todayIconColor(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return '#9A5B12';
  if (kind === 'renewal') return partnerTheme.colors.brand;
  return partnerTheme.colors.accent;
}

function todayIconTone(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return styles.todayIconWarn;
  if (kind === 'renewal') return styles.todayIconBrand;
  return styles.todayIconAccent;
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

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount >= 100000000 ? 0 : 1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date());
}

const styles = StyleSheet.create({
  role: { marginTop: -11, marginBottom: 15, color: partnerTheme.colors.inkMuted, fontSize: 11 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  avatarText: { color: partnerTheme.colors.brandStrong, fontSize: 12, fontWeight: '800' },
  loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  errorText: { marginTop: 9, color: partnerTheme.colors.inkMuted, fontSize: 10 },
  retry: { marginTop: 10, color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '800' },

  pulseCard: { borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.nav },
  pulseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  pulseEyebrow: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.3 },
  pulseTitle: { marginTop: 5, color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  pulseOrb: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#343D52' },
  pulseSignals: { marginTop: 17, flexDirection: 'row', gap: 7 },
  signal: { flex: 1, minHeight: 53, borderRadius: 13, padding: 10, backgroundColor: '#1C2637' },
  signalLabel: { color: '#8F9BAD', fontSize: 7.5, fontWeight: '700' },
  signalValue: { marginTop: 4, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  pulseFooter: { marginTop: 14, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4659' },
  pulseFooterText: { color: '#D8D6FF', fontSize: 8.5, fontWeight: '700' },

  sectionHeader: { marginTop: 21, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  sectionMeta: { color: partnerTheme.colors.inkMuted, fontSize: 9 },
  sectionAction: { color: partnerTheme.colors.brand, fontSize: 9.5, fontWeight: '800' },

  todayList: { gap: 8 },
  todayRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  todayIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  todayIconWarn: { backgroundColor: '#FFF2DD' },
  todayIconBrand: { backgroundColor: partnerTheme.colors.brandSoft },
  todayIconAccent: { backgroundColor: partnerTheme.colors.accentSoft },
  todayBody: { flex: 1 },
  todayTitle: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  todaySubtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },
  clearCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#F6FCF8', borderWidth: 1, borderColor: '#D7ECDC' },
  clearIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6ED' },
  clearBody: { flex: 1 },
  clearTitle: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  clearText: { marginTop: 3, color: '#5F7967', fontSize: 8.5, lineHeight: 13 },

  quickGrid: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minHeight: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  quickIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  quickLabel: { marginTop: 7, color: partnerTheme.colors.ink, fontSize: 8.5, fontWeight: '700', textAlign: 'center' },

  businessCard: { flexDirection: 'row', gap: 14, borderRadius: partnerTheme.radius.xl, padding: 17, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  businessMain: { width: '46%', paddingRight: 13, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: partnerTheme.colors.line },
  businessEyebrow: { color: partnerTheme.colors.brand, fontSize: 7.5, fontWeight: '800', letterSpacing: 1 },
  businessPremium: { marginTop: 6, color: partnerTheme.colors.ink, fontSize: 24, fontWeight: '800' },
  businessPremiumLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  trend: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 7.5, fontWeight: '700' },
  trendNeutral: { marginTop: 9, color: partnerTheme.colors.inkMuted, fontSize: 7.5 },
  businessStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  businessStat: { width: '50%' },
  businessStatValue: { color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '800' },
  businessStatLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 7.5 },

  characterCard: { marginTop: 12, flexDirection: 'row', gap: 12, borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: partnerTheme.colors.accentSoft },
  characterIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  characterBody: { flex: 1 },
  characterEyebrow: { color: '#3C7B78', fontSize: 7.5, fontWeight: '800', letterSpacing: 1 },
  characterTitle: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  characterText: { marginTop: 3, color: '#56716F', fontSize: 8.5, lineHeight: 13 },
});
