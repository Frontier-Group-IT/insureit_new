import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getExchangeListingDetail,
  getExchangeMarketplaceFeed,
  type ExchangeFeedRow,
  type ExchangeListingDetail,
} from '@/lib/exchange';

type FeedRow = ExchangeFeedRow & { cover_url: string | null };

type CompareVehicle = {
  feed: FeedRow;
  detail: ExchangeListingDetail | null;
};

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function display(value: unknown, suffix = '') {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}${suffix}`;
}

function yesNo(value: boolean | null | undefined) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

function modeLabel(mode: FeedRow['selling_mode']) {
  if (mode === 'fixed_price') return 'Fixed price';
  if (mode === 'managed_auction') return 'Managed auction';
  return 'Open to offers';
}

export default function ExchangeCompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string | string[] }>();
  const raw = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const ids = useMemo(() => (raw ?? '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 3), [raw]);

  const [vehicles, setVehicles] = useState<CompareVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [raw]);

  async function load() {
    setLoading(true);
    try {
      const feed = await getExchangeMarketplaceFeed({ limit: 100 }) as FeedRow[];
      const selected = feed.filter((row) => ids.includes(row.listing_id));
      const detailed = await Promise.all(selected.map(async (row) => ({
        feed: row,
        detail: await getExchangeListingDetail(row.listing_id).catch(() => null),
      })));
      setVehicles(detailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Compare vehicles</Text>
          <Text style={styles.headerSubtitle}>Verified facts side by side</Text>
        </View>
        <View style={styles.headerButtonSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="compare-horizontal" size={32} color="#164BB8" />
          <Text style={styles.centerTitle}>Preparing comparison</Text>
          <Text style={styles.centerCopy}>Loading the latest listing and vehicle details.</Text>
        </View>
      ) : vehicles.length < 2 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="compare-horizontal" size={32} color="#164BB8" />
          <Text style={styles.centerTitle}>Select at least two vehicles</Text>
          <Text style={styles.centerCopy}>Choose 2–3 vehicles from Exchange Search to compare them.</Text>
          <Pressable onPress={() => router.replace('/customer/exchange/search')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Search</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
            {vehicles.map(({ feed }) => (
              <View key={feed.listing_id} style={styles.vehicleHeader}>
                <View style={styles.imageWrap}>
                  {feed.cover_url ? (
                    <Image source={{ uri: feed.cover_url }} resizeMode="contain" style={styles.image} />
                  ) : (
                    <MaterialCommunityIcons name="truck-outline" size={54} color="#63748A" />
                  )}
                </View>
                <Text numberOfLines={2} style={styles.vehicleTitle}>{feed.year ? `${feed.year} ` : ''}{feed.title}</Text>
                <Text style={styles.price}>{money(Number(feed.asking_price))}</Text>
                <View style={styles.modePill}><Text style={styles.modeText}>{modeLabel(feed.selling_mode)}</Text></View>
                <Pressable
                  onPress={() => router.push({ pathname: '/customer/exchange/[listingId]', params: { listingId: feed.listing_id } })}
                  style={styles.viewButton}
                >
                  <Text style={styles.viewButtonText}>View vehicle</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <ComparisonSection title="Marketplace">
            <CompareRow label="Price" vehicles={vehicles} value={({ feed }) => money(Number(feed.asking_price))} />
            <CompareRow label="Selling mode" vehicles={vehicles} value={({ feed }) => modeLabel(feed.selling_mode)} />
            <CompareRow label="Location" vehicles={vehicles} value={({ feed }) => [feed.city, feed.state].filter(Boolean).join(', ') || '—'} />
            <CompareRow label="Owner verified" vehicles={vehicles} value={({ feed }) => yesNo(feed.owner_verified)} />
            <CompareRow label="Documents verified" vehicles={vehicles} value={({ feed }) => yesNo(feed.documents_verified)} />
            <CompareRow label="Inspected" vehicles={vehicles} value={({ feed }) => yesNo(feed.inspected)} last />
          </ComparisonSection>

          <ComparisonSection title="Vehicle basics">
            <CompareRow label="Make" vehicles={vehicles} value={({ feed }) => display(feed.make)} />
            <CompareRow label="Model" vehicles={vehicles} value={({ feed }) => display(feed.model)} />
            <CompareRow label="Year" vehicles={vehicles} value={({ feed }) => display(feed.year)} />
            <CompareRow label="Odometer" vehicles={vehicles} value={({ feed }) => feed.odometer_km ? `${feed.odometer_km.toLocaleString('en-IN')} km` : '—'} />
            <CompareRow label="Fuel" vehicles={vehicles} value={({ feed }) => display(feed.fuel_type)} />
            <CompareRow label="Ownership" vehicles={vehicles} value={({ feed }) => feed.ownership_count ? `${feed.ownership_count} owner` : '—'} last />
          </ComparisonSection>

          <ComparisonSection title="Commercial specifications">
            <CompareRow label="GVW" vehicles={vehicles} value={({ detail }) => detail?.gvw_kg ? `${Number(detail.gvw_kg).toLocaleString('en-IN')} kg` : '—'} />
            <CompareRow label="Unladen weight" vehicles={vehicles} value={({ detail }) => detail?.unladen_weight_kg ? `${Number(detail.unladen_weight_kg).toLocaleString('en-IN')} kg` : '—'} />
            <CompareRow label="Wheelbase" vehicles={vehicles} value={({ detail }) => detail?.wheel_base_mm ? `${Number(detail.wheel_base_mm).toLocaleString('en-IN')} mm` : '—'} />
            <CompareRow label="Body type" vehicles={vehicles} value={({ detail }) => display(detail?.body_type)} />
            <CompareRow label="Engine capacity" vehicles={vehicles} value={({ detail }) => detail?.engine_capacity_cc ? `${Number(detail.engine_capacity_cc).toLocaleString('en-IN')} cc` : '—'} />
            <CompareRow label="Emission norm" vehicles={vehicles} value={({ detail }) => display(detail?.emission_norm)} last />
          </ComparisonSection>

          <ComparisonSection title="Health & compliance">
            <CompareRow label="RC verified" vehicles={vehicles} value={({ detail }) => yesNo(detail?.authbridge_verified)} />
            <CompareRow label="Fitness expiry" vehicles={vehicles} value={({ detail }) => display(detail?.fitness_expiry_date)} />
            <CompareRow label="PUC expiry" vehicles={vehicles} value={({ detail }) => display(detail?.puc_expiry_date)} />
            <CompareRow label="Road tax expiry" vehicles={vehicles} value={({ detail }) => display(detail?.road_tax_expiry_date)} />
            <CompareRow label="Permit" vehicles={vehicles} value={({ detail }) => display(detail?.permit_type)} />
            <CompareRow label="Financed" vehicles={vehicles} value={({ detail }) => yesNo(detail?.financed)} last />
          </ComparisonSection>

          <View style={styles.note}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#657286" />
            <Text style={styles.noteText}>A dash means the verified source does not currently contain that field. Exchange does not fill missing comparison values with estimates.</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ComparisonSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

function CompareRow({
  label,
  vehicles,
  value,
  last = false,
}: {
  label: string;
  vehicles: CompareVehicle[];
  value: (vehicle: CompareVehicle) => string;
  last?: boolean;
}) {
  return (
    <View style={[styles.compareRow, last && styles.compareRowLast]}>
      <Text style={styles.compareLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareValues}>
        {vehicles.map((vehicle) => (
          <View key={vehicle.feed.listing_id} style={styles.compareCell}>
            <Text style={styles.compareValue}>{value(vehicle)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  header: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E4E9EF' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  headerButtonSpacer: { width: 40, height: 40 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: '#8793A4', fontSize: 7.7, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  centerTitle: { marginTop: 10, color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  centerCopy: { marginTop: 4, color: '#7A8799', textAlign: 'center', fontSize: 8.7, lineHeight: 12.5, fontWeight: '700' },
  primaryButton: { marginTop: 13, height: 42, borderRadius: 21, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 8.8, fontWeight: '900' },

  columns: { padding: 14, gap: 9 },
  vehicleHeader: { width: 176, borderRadius: 18, padding: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  imageWrap: { height: 92, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F7' },
  image: { width: '90%', height: '86%' },
  vehicleTitle: { marginTop: 8, minHeight: 28, color: '#0F1D33', fontSize: 10, lineHeight: 13.5, fontWeight: '900' },
  price: { marginTop: 6, color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  modePill: { alignSelf: 'flex-start', marginTop: 6, minHeight: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  modeText: { color: '#164BB8', fontSize: 6.7, fontWeight: '900' },
  viewButton: { marginTop: 9, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  viewButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },

  section: { marginHorizontal: 14, marginBottom: 11, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  sectionTitle: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, color: '#0F1D33', fontSize: 11.5, fontWeight: '900' },
  rows: { borderTopWidth: 1, borderTopColor: '#EEF1F4' },
  compareRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#EEF1F4' },
  compareRowLast: { borderBottomWidth: 0 },
  compareLabel: { paddingHorizontal: 12, paddingTop: 9, color: '#7A8799', fontSize: 7.6, fontWeight: '800' },
  compareValues: { paddingHorizontal: 8, paddingBottom: 9, gap: 7 },
  compareCell: { width: 156, minHeight: 27, borderRadius: 9, paddingHorizontal: 8, alignItems: 'flex-start', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  compareValue: { color: '#26364D', fontSize: 8.5, fontWeight: '900' },

  note: { marginHorizontal: 14, marginBottom: 28, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#EEF1F4' },
  noteText: { flex: 1, color: '#657286', fontSize: 7.4, lineHeight: 10.8, fontWeight: '700' },
});

