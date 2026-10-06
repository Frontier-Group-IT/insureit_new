import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerImpact, type PartnerImpactData } from '@/lib/impact';
import { partnerTheme } from '@/lib/theme';

export default function ImpactScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerImpact());
    } catch {
      setError('Your impact could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen eyebrow="MY IMPACT" title="Protection delivered" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading your impact" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Your impact is temporarily unavailable" message={error || 'Your impact could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open business performance"
            onPress={() => router.push('/(tabs)/business')}
            style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroEyebrow}>ACTIVE MOTOR PROTECTION</Text>
                <Text style={styles.heroValue}>{formatIndianCurrency(data.active_motor_idv)}</Text>
              </View>
              <ImpactIcon icon="shield-checkmark" inverse size={46} />
            </View>
            <View style={styles.heroBottomRow}>
              <Text style={styles.heroLabel}>Insured value currently protected in your Motor book.</Text>
              <Ionicons name="chevron-forward" size={18} color="#B8C4D8" />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Protection footprint</Text></View>
          <View style={styles.grid}>
            <ImpactCard icon="car-sport" value={data.active_vehicles} label="Vehicles covered" onPress={() => router.push('/customers')} />
            <ImpactCard icon="people" value={data.customers_served} label="Customers served" onPress={() => router.push('/customers')} />
          </View>
          <View style={styles.grid}>
            <ImpactCard icon="document-text" value={data.lifetime_policies} label="Policies in your book" onPress={() => router.push('/(tabs)/policies')} />
            <ImpactCard icon="shield-checkmark" value={data.claims_assisted} label="Claims assisted" onPress={() => router.push('/(tabs)/claims')} />
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>This month</Text></View>
          <View style={styles.monthCard}>
            <MonthStat icon="trending-up" label="Gross premium" value={formatIndianCurrency(data.gross_premium_this_month)} onPress={() => router.push('/business-report')} />
            <MonthStat icon="document-text" label="Policies" value={String(data.policies_this_month)} onPress={() => router.push('/(tabs)/policies')} />
            <MonthStat icon="person-add" label="Customers added" value={String(data.customers_this_month)} onPress={() => router.push('/customers')} />
          </View>

          {Number(data.claim_settlement_value || 0) > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open claim outcomes"
              onPress={() => router.push('/(tabs)/claims')}
              style={({ pressed }) => [styles.settlementCard, pressed && styles.pressed]}
            >
              <ImpactIcon icon="checkmark-done-circle" size={44} />
              <View style={styles.settlementBody}>
                <Text style={styles.settlementEyebrow}>CLAIM OUTCOMES</Text>
                <Text style={styles.settlementValue}>{formatIndianCurrency(data.claim_settlement_value)}</Text>
                <Text style={styles.settlementText}>Settlement value recorded across completed or assisted claims.</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#6F879D" />
            </Pressable>
          ) : null}

          <Pressable onPress={() => router.push('/journey')} style={({ pressed }) => [styles.journeyLink, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="See your journey">
            <ImpactIcon icon="navigate-circle" size={40} />
            <View style={styles.journeyBody}><Text style={styles.journeyTitle}>See your journey</Text></View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function ImpactCard({
  icon,
  value,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.impactCard, pressed && styles.pressed]}
    >
      <View style={styles.cardTopRow}>
        <ImpactIcon icon={icon} size={42} />
        <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
      </View>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </Pressable>
  );
}

function MonthStat({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.monthStat, pressed && styles.monthStatPressed]}
    >
      <ImpactIcon icon={icon} size={30} compact />
      <Text style={styles.monthValue}>{value}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
    </Pressable>
  );
}

function ImpactIcon({
  icon,
  size,
  compact = false,
  inverse = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <View
      style={[
        styles.iconShell,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        },
        compact && styles.iconShellCompact,
        inverse && styles.iconShellInverse,
      ]}
    >
      <View style={[styles.iconGlow, inverse && styles.iconGlowInverse]} />
      <Ionicons
        name={icon}
        size={Math.round(size * (compact ? 0.54 : 0.58))}
        color={inverse ? '#FFFFFF' : '#0878E8'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroBottomRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroEyebrow: { color: '#8FD1CE', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroValue: { marginTop: 5, color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroLabel: { flex: 1, maxWidth: 310, color: '#C9D0DE', ...partnerTheme.typography.caption },
  sectionHeader: { marginTop: 15, marginBottom: 7 },
  sectionTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  impactCard: { flex: 1, minHeight: 110, borderRadius: partnerTheme.radius.lg, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  impactValue: { marginTop: 7, color: partnerTheme.colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  impactLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  monthCard: { flexDirection: 'row', overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  monthStat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  monthStatPressed: { backgroundColor: '#F1F7FF' },
  monthValue: { marginTop: 5, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  monthLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  settlementCard: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.lg, padding: 14, backgroundColor: partnerTheme.colors.accentSoft },
  settlementBody: { flex: 1 },
  settlementEyebrow: { color: '#3C7B78', letterSpacing: 0.8, ...partnerTheme.typography.meta },
  settlementValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  settlementText: { marginTop: 3, color: '#56716F', ...partnerTheme.typography.caption },
  journeyLink: { marginTop: 10, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: partnerTheme.radius.lg, paddingHorizontal: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  journeyBody: { flex: 1 },
  journeyTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  iconShell: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1E9FF',
    shadowColor: '#0A62B8',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconShellCompact: {
    shadowOpacity: 0.08,
    elevation: 1,
  },
  iconShellInverse: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconGlow: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    right: -5,
    top: -5,
    borderRadius: 20,
    backgroundColor: 'rgba(56,176,255,0.22)',
  },
  iconGlowInverse: {
    backgroundColor: 'rgba(143,209,206,0.28)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
