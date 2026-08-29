import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { partnerTheme } from '@/lib/theme';

export default function PulseScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerHome());
    } catch {
      setError('Your Pulse could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen
      eyebrow="INSUREIT PULSE"
      title="Your business today"
      action={
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Pulse is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>TODAY'S PULSE</Text>
            <Text style={styles.heroTitle}>{pulseTitle(data)}</Text>
            <Text style={styles.heroText}>{pulseSummary(data)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What is shaping your Pulse</Text>
            <PulseRow
              icon="trending-up-outline"
              label="Business momentum"
              value={humanize(data.pulse.business_momentum)}
              hint={premiumHint(data)}
              tone={data.pulse.business_momentum === 'rising' ? 'good' : data.pulse.business_momentum === 'slower' ? 'warn' : 'neutral'}
            />
            <PulseRow
              icon="refresh-outline"
              label="Renewal readiness"
              value={data.business.renewals_7_days ? `${data.business.renewals_7_days} due soon` : 'Clear'}
              hint={data.business.renewals_30_days ? `${data.business.renewals_30_days} policies expire within 30 days.` : 'No renewals are currently due within 30 days.'}
              tone={data.business.renewals_7_days ? 'warn' : 'good'}
            />
            <PulseRow
              icon="shield-checkmark-outline"
              label="Customer service"
              value={data.service.claims_need_attention ? `${data.service.claims_need_attention} need attention` : 'Steady'}
              hint={data.service.active_claims ? `${data.service.active_claims} active claims in your authorized book.` : 'No active claims require tracking.'}
              tone={data.service.claims_need_attention ? 'warn' : 'good'}
            />
            <PulseRow
              icon="document-text-outline"
              label="Operations actions"
              value={data.service.intakes_need_attention ? `${data.service.intakes_need_attention} waiting` : 'Clear'}
              hint={data.service.intakes_in_progress ? `${data.service.intakes_in_progress} Policy Intakes are moving through Operations.` : 'No Policy Intakes are currently in progress.'}
              tone={data.service.intakes_need_attention ? 'warn' : 'good'}
            />
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>BEST NEXT ACTION</Text>
            {data.today[0] ? (
              <>
                <Text style={styles.nextTitle}>{data.today[0].title}</Text>
                <Text style={styles.nextText}>{data.today[0].subtitle}</Text>
                <Pressable onPress={() => router.push(data.today[0].route as never)} style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>Open</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.nextTitle}>You are clear for now</Text>
                <Text style={styles.nextText}>No urgent renewal, claim or Policy Intake action is currently waiting.</Text>
              </>
            )}
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function PulseRow({ icon, label, value, hint, tone }: {
  icon: 'trending-up-outline' | 'refresh-outline' | 'shield-checkmark-outline' | 'document-text-outline';
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'neutral';
}) {
  const toneStyle = tone === 'good' ? styles.good : tone === 'warn' ? styles.warn : styles.neutral;
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={partnerTheme.colors.brand} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Text style={[styles.rowValue, toneStyle]}>{value}</Text>
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

function pulseSummary(data: PartnerHomeData) {
  const attention = data.service.intakes_need_attention + data.service.claims_need_attention + data.business.renewals_7_days;
  if (attention > 0) return `${attention} priority item${attention === 1 ? '' : 's'} are shaping your day. The details below explain exactly why.`;
  return 'Your authorized business book has no urgent action items right now.';
}

function premiumHint(data: PartnerHomeData) {
  const current = Number(data.business.premium_this_month || 0);
  const previous = Number(data.business.premium_last_month || 0);
  if (!previous && current > 0) return `${formatMoney(current)} gross premium recorded this month.`;
  if (!previous && !current) return 'No gross premium has been recorded in the comparison period.';
  const change = Number(data.business.premium_change_percent || 0);
  return `${formatMoney(current)} this month · ${Math.abs(change).toFixed(1)}% ${change >= 0 ? 'above' : 'below'} last month.`;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  errorText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
  retry: { marginTop: 10, color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '800' },
  hero: { borderRadius: partnerTheme.radius.xl, padding: 22, backgroundColor: partnerTheme.colors.nav },
  heroLabel: { color: '#AAA5FF', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroText: { marginTop: 8, maxWidth: 310, color: '#C9D0DE', fontSize: 10.5, lineHeight: 16 },
  section: { marginTop: 20 },
  sectionTitle: { marginBottom: 10, color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderRadius: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line, marginBottom: 8 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  rowBody: { flex: 1 },
  rowLabel: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  rowHint: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },
  rowValue: { maxWidth: 95, textAlign: 'right', fontSize: 9, fontWeight: '800' },
  good: { color: partnerTheme.colors.success },
  warn: { color: partnerTheme.colors.warning },
  neutral: { color: partnerTheme.colors.brand },
  nextCard: { marginTop: 14, borderRadius: partnerTheme.radius.xl, padding: 18, backgroundColor: partnerTheme.colors.brandSoft },
  nextEyebrow: { color: partnerTheme.colors.brand, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  nextTitle: { marginTop: 6, color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  nextText: { marginTop: 5, color: '#5D5A80', fontSize: 9.5, lineHeight: 14 },
  nextButton: { alignSelf: 'flex-start', marginTop: 13, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.brandStrong },
  nextButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
});
