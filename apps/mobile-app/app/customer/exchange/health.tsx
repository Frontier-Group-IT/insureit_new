import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExchangeListingDetail, type ExchangeListingDetail } from '@/lib/exchange';

function displayDate(value: string | null | undefined) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiry(value: string | null | undefined) {
  if (!value) return { label: 'Not available', tone: 'unknown' as const };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: value, tone: 'unknown' as const };
  const valid = date.getTime() >= Date.now();
  return { label: `${valid ? 'Valid till' : 'Expired'} ${displayDate(value)}`, tone: valid ? 'good' as const : 'bad' as const };
}

function financeValue(detail: ExchangeListingDetail) {
  if (detail.financed === true) return detail.financer_name ? `Financed • ${detail.financer_name}` : 'Financed';
  if (detail.financed === false) return 'No finance recorded';
  return 'Not available';
}

function blacklistValue(value: string | null) {
  if (!value) return { label: 'Not available', tone: 'unknown' as const };
  const risky = /black|blocked|yes|true|active/i.test(value);
  return { label: value, tone: risky ? 'bad' as const : 'good' as const };
}

export default function ExchangeVehicleHealthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string | string[]; title?: string | string[] }>();
  const listingId = Array.isArray(params.listingId) ? params.listingId[0] : params.listingId;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;

  const [detail, setDetail] = useState<ExchangeListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [listingId]);

  async function load(asRefresh = false) {
    if (!listingId) {
      setError('Listing reference is missing.');
      setLoading(false);
      return;
    }
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDetail(await getExchangeListingDetail(listingId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Vehicle health data is not available.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const health = useMemo(() => {
    if (!detail) return null;
    return {
      fitness: expiry(detail.fitness_expiry_date),
      puc: expiry(detail.puc_expiry_date),
      roadTax: expiry(detail.road_tax_expiry_date),
      permit: expiry(detail.national_permit_expiry_date ?? detail.local_permit_expiry_date),
      insurance: expiry(detail.insurance?.end_date),
      blacklist: blacklistValue(detail.blacklist_status),
    };
  }, [detail]);

  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" /></Pressable>
          <Text style={styles.topTitle}>Vehicle Health Report</Text>
          <View style={styles.backSpacer} />
        </View>
        <View style={styles.center}>
          <View style={styles.centerIcon}><MaterialCommunityIcons name="shield-outline" size={29} color="#164BB8" /></View>
          <Text style={styles.centerTitle}>Reading vehicle health</Text>
          <Text style={styles.centerCopy}>Checking available fleet, policy and verification records.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || error || !health) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" /></Pressable>
          <Text style={styles.topTitle}>Vehicle Health Report</Text>
          <View style={styles.backSpacer} />
        </View>
        <View style={styles.center}>
          <View style={styles.centerIcon}><MaterialCommunityIcons name="alert-circle-outline" size={29} color="#B46A12" /></View>
          <Text style={styles.centerTitle}>Health report unavailable</Text>
          <Text style={styles.centerCopy}>{error ?? 'Please try again.'}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const rcSource = detail.authbridge_verified ? 'AuthBridge verification' : 'Vehicle registry record';
  const rcTimestamp = detail.authbridge_last_verified_at ? `Checked ${displayDate(detail.authbridge_last_verified_at)}` : 'Verification timestamp not available';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" /></Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.topTitle}>Vehicle Health Report</Text>
          <Text numberOfLines={1} style={styles.topSubtitle}>{title || detail.listing_no}</Text>
        </View>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="shield-check-outline" size={28} color="#FFFFFF" /></View>
          <View style={styles.flex}>
            <Text style={styles.heroEyebrow}>INSUREIT EXCHANGE</Text>
            <Text style={styles.heroTitle}>Health facts, not assumptions.</Text>
            <Text style={styles.heroCopy}>This report only shows information already available in InsureIT fleet, policy or verification records. Missing facts stay marked as unavailable.</Text>
          </View>
        </View>

        <HealthSection title="Identity & RC" subtitle="Ownership and registration-source confidence">
          <HealthFact
            icon="card-account-details-outline"
            label="Registration status"
            value={detail.registration_status || 'Not available'}
            tone={detail.registration_status ? 'good' : 'unknown'}
            source={rcSource}
            timestamp={rcTimestamp}
          />
          <HealthFact
            icon="calendar-check-outline"
            label="Registration date"
            value={displayDate(detail.registration_date)}
            tone={detail.registration_date ? 'good' : 'unknown'}
            source="Vehicle registry record"
          />
          <HealthFact
            icon="shield-sync-outline"
            label="Source verification"
            value={detail.authbridge_verified ? 'Verified' : 'Not verified'}
            tone={detail.authbridge_verified ? 'good' : 'unknown'}
            source={rcSource}
            timestamp={rcTimestamp}
            last
          />
        </HealthSection>

        <HealthSection title="Compliance" subtitle="Expiry-sensitive commercial vehicle records">
          <HealthFact icon="certificate-outline" label="Fitness" value={health.fitness.label} tone={health.fitness.tone} source="Vehicle registry record" />
          <HealthFact icon="weather-windy" label="PUC" value={health.puc.label} tone={health.puc.tone} source="Vehicle registry record" />
          <HealthFact icon="road-variant" label="Road tax" value={health.roadTax.label} tone={health.roadTax.tone} source="Vehicle registry record" />
          <HealthFact
            icon="file-certificate-outline"
            label={detail.permit_type ? `${detail.permit_type} permit` : 'Permit'}
            value={health.permit.label}
            tone={health.permit.tone}
            source="Vehicle registry record"
            last
          />
        </HealthSection>

        <HealthSection title="Insurance" subtitle="Latest linked policy validity">
          <HealthFact
            icon="shield-check-outline"
            label={detail.insurance?.insurer_name || 'Insurance policy'}
            value={health.insurance.label}
            tone={health.insurance.tone}
            source={detail.insurance?.source === 'external' ? 'External linked policy record' : detail.insurance?.source === 'internal' ? 'InsureIT policy record' : 'No linked policy record'}
            last
          />
        </HealthSection>

        <HealthSection title="Commercial specifications" subtitle="Known technical vehicle attributes">
          <HealthFact icon="weight-kilogram" label="GVW" value={detail.gvw_kg ? `${Number(detail.gvw_kg).toLocaleString('en-IN')} kg` : 'Not available'} tone={detail.gvw_kg ? 'good' : 'unknown'} source="Vehicle master" />
          <HealthFact icon="weight" label="Unladen weight" value={detail.unladen_weight_kg ? `${Number(detail.unladen_weight_kg).toLocaleString('en-IN')} kg` : 'Not available'} tone={detail.unladen_weight_kg ? 'good' : 'unknown'} source="Vehicle master" />
          <HealthFact icon="ruler" label="Wheelbase" value={detail.wheel_base_mm ? `${Number(detail.wheel_base_mm).toLocaleString('en-IN')} mm` : 'Not available'} tone={detail.wheel_base_mm ? 'good' : 'unknown'} source="Vehicle master" />
          <HealthFact icon="truck-cargo-container" label="Body type" value={detail.body_type || 'Not available'} tone={detail.body_type ? 'good' : 'unknown'} source="Vehicle master" />
          <HealthFact icon="engine-outline" label="Engine capacity" value={detail.engine_capacity_cc ? `${Number(detail.engine_capacity_cc).toLocaleString('en-IN')} cc` : 'Not available'} tone={detail.engine_capacity_cc ? 'good' : 'unknown'} source="Vehicle master" />
          <HealthFact icon="leaf" label="Emission norm" value={detail.emission_norm || 'Not available'} tone={detail.emission_norm ? 'good' : 'unknown'} source="Vehicle master" last />
        </HealthSection>

        <HealthSection title="Finance & risk" subtitle="Known finance and registry-risk signals">
          <HealthFact
            icon="bank-outline"
            label="Finance"
            value={financeValue(detail)}
            tone={detail.financed === false ? 'good' : detail.financed === true ? 'attention' : 'unknown'}
            source="Vehicle registry record"
          />
          <HealthFact
            icon="alert-octagon-outline"
            label="Blacklist status"
            value={health.blacklist.label}
            tone={health.blacklist.tone}
            source="Vehicle registry record"
            last
          />
        </HealthSection>

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons name="information-outline" size={18} color="#607087" />
          <Text style={styles.disclaimerText}>Inspection categories such as engine, gearbox, clutch, brakes, suspension and body condition are not shown unless InsureIT has captured verified inspection data for them. Challan data is not currently connected to this report.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

function HealthFact({
  icon,
  label,
  value,
  tone,
  source,
  timestamp,
  last = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'attention' | 'unknown';
  source: string;
  timestamp?: string;
  last?: boolean;
}) {
  const toneColor = tone === 'good' ? '#0D7C58' : tone === 'bad' ? '#C83D4B' : tone === 'attention' ? '#B26B10' : '#8290A2';
  const toneBg = tone === 'good' ? '#E8F7F1' : tone === 'bad' ? '#FCEAEC' : tone === 'attention' ? '#FFF3E3' : '#F0F2F5';
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <View style={[styles.factIcon, { backgroundColor: toneBg }]}><MaterialCommunityIcons name={icon} size={19} color={toneColor} /></View>
      <View style={styles.flex}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={[styles.factValue, { color: toneColor }]}>{value}</Text>
        <Text style={styles.factSource}>Source: {source}{timestamp ? ` • ${timestamp}` : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 36 },
  topBar: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E9EF' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  backSpacer: { width: 40, height: 40 },
  titleWrap: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
  topTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  topSubtitle: { marginTop: 2, maxWidth: 210, color: '#8793A4', fontSize: 7.7, fontWeight: '700' },

  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  centerIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  centerTitle: { marginTop: 11, color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  centerCopy: { marginTop: 5, color: '#7C899B', textAlign: 'center', fontSize: 9, lineHeight: 13, fontWeight: '700' },
  retry: { marginTop: 13, height: 40, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },

  hero: { borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#0F1D33' },
  heroIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  heroEyebrow: { color: '#8EB7FF', fontSize: 7.4, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 15.5, fontWeight: '900' },
  heroCopy: { marginTop: 5, color: '#B9C3D1', fontSize: 8.2, lineHeight: 12, fontWeight: '700' },

  section: { marginTop: 11, borderRadius: 19, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  sectionTitle: { color: '#0F1D33', fontSize: 12.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 2, color: '#8490A0', fontSize: 7.8, fontWeight: '700' },
  rows: { marginTop: 10 },
  fact: { minHeight: 73, paddingVertical: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EDF0F3' },
  factLast: { borderBottomWidth: 0, paddingBottom: 2 },
  factIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  factLabel: { color: '#58667B', fontSize: 7.8, fontWeight: '800' },
  factValue: { marginTop: 2, fontSize: 10.2, fontWeight: '900' },
  factSource: { marginTop: 4, color: '#929CAA', fontSize: 6.8, lineHeight: 9.5, fontWeight: '700' },

  disclaimer: { marginTop: 11, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF1F4' },
  disclaimerText: { flex: 1, color: '#657286', fontSize: 7.5, lineHeight: 11, fontWeight: '700' },
});

