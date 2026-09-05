import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
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
      action={<PartnerIconButton icon="close" label="Close business pulse" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading your Pulse" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Pulse is temporarily unavailable"
          message={error || 'Your Pulse could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>TODAY’S PULSE</Text>
            <Text style={styles.heroTitle}>{pulseTitle(data)}</Text>
            <Text style={styles.heroText}>{pulseSummary(data)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What is shaping your Pulse</Text>
            <PulseRow
              asset={PartnerAssets.actions.businessPerformance}
              label="Business momentum"
              value={humanize(data.pulse.business_momentum)}
              hint={premiumHint(data)}
              tone={data.pulse.business_momentum === 'rising' ? 'good' : data.pulse.business_momentum === 'slower' ? 'warn' : 'neutral'}
            />
            <PulseRow
              asset={PartnerAssets.actions.renewals}
              label="Renewal readiness"
              value={data.business.renewals_7_days ? `${data.business.renewals_7_days} due soon` : 'Clear'}
              hint={data.business.renewals_30_days ? `${data.business.renewals_30_days} policies expire within 30 days.` : 'No renewals are currently due within 30 days.'}
              tone={data.business.renewals_7_days ? 'warn' : 'good'}
            />
            <PulseRow
              asset={PartnerAssets.navigation.claims}
              label="Customer service"
              value={data.service.claims_need_attention ? `${data.service.claims_need_attention} need attention` : 'Steady'}
              hint={data.service.active_claims ? `${data.service.active_claims} active claims in your authorized book.` : 'No active claims require tracking.'}
              tone={data.service.claims_need_attention ? 'warn' : 'good'}
            />
            <PulseRow
              asset={PartnerAssets.navigation.policyIntake}
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

function PulseRow({ asset, label, value, hint, tone }: {
  asset: ImageSourcePropType;
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'neutral';
}) {
  const toneStyle = tone === 'good' ? styles.good : tone === 'warn' ? styles.warn : styles.neutral;
  return (
    <View style={styles.row}>
      <View style={styles.rowArtworkWrap}><Image source={asset} style={styles.rowArtwork} resizeMode="contain" /></View>
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
  if (!previous && current > 0) return `${formatIndianCurrency(current)} gross premium recorded this month.`;
  if (!previous && !current) return 'No gross premium has been recorded in the comparison period.';
  const change = Number(data.business.premium_change_percent || 0);
  return `${formatIndianCurrency(current)} this month · ${Math.abs(change).toFixed(1)}% ${change >= 0 ? 'above' : 'below'} last month.`;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 15, backgroundColor: partnerTheme.colors.nav },
  heroLabel: { color: '#AAA5FF', letterSpacing: 1.4, ...partnerTheme.typography.meta },
  heroTitle: { marginTop: 5, color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  heroText: { marginTop: 5, maxWidth: 310, color: '#C9D0DE', ...partnerTheme.typography.caption },
  section: { marginTop: partnerTheme.spacing.lg },
  sectionTitle: { marginBottom: 7, color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line, marginBottom: 8 },
  rowArtworkWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rowArtwork: { width: 38, height: 38 },
  rowBody: { flex: 1 },
  rowLabel: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  rowHint: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  rowValue: { maxWidth: 96, textAlign: 'right', ...partnerTheme.typography.caption, fontWeight: '800' },
  good: { color: partnerTheme.colors.success },
  warn: { color: partnerTheme.colors.warning },
  neutral: { color: partnerTheme.colors.brand },
  nextCard: { marginTop: 10, borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.brandSoft },
  nextEyebrow: { color: partnerTheme.colors.brand, letterSpacing: 1, ...partnerTheme.typography.meta },
  nextTitle: { marginTop: 6, color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  nextText: { marginTop: 5, color: '#5D5A80', ...partnerTheme.typography.caption },
  nextButton: { alignSelf: 'flex-start', marginTop: 9, minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: partnerTheme.radius.md, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.brandStrong },
  nextButtonText: { color: '#FFFFFF', ...partnerTheme.typography.caption, fontWeight: '800' },
});
