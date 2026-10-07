import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSelectedCustomerContext } from '@/lib/customer-context';
import { getExchangeMarketplaceFeed, toggleExchangeFavorite, type ExchangeFeedRow } from '@/lib/exchange';

type FeedRow = ExchangeFeedRow & { cover_url: string | null };
type SortMode = 'recommended' | 'price_low' | 'price_high' | 'newest';
type Budget = 'all' | 'under_15' | '15_25' | '25_40' | '40_plus';

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function km(value: number | null) {
  return value ? `${value.toLocaleString('en-IN')} km` : 'KM verified';
}

function modeLabel(mode: FeedRow['selling_mode']) {
  if (mode === 'fixed_price') return 'Fixed price';
  if (mode === 'managed_auction') return 'Auction';
  return 'Open to offers';
}

function categoryIcon(category: string) {
  if (category === 'Tipper') return 'dump-truck' as const;
  if (category === 'Pickup') return 'car-pickup' as const;
  if (category === 'Bus') return 'bus' as const;
  if (category === 'Construction') return 'tractor' as const;
  return 'truck-outline' as const;
}

function matchesBudget(row: FeedRow, budget: Budget) {
  const price = Number(row.asking_price || 0);
  if (budget === 'under_15') return price < 1500000;
  if (budget === '15_25') return price >= 1500000 && price < 2500000;
  if (budget === '25_40') return price >= 2500000 && price < 4000000;
  if (budget === '40_plus') return price >= 4000000;
  return true;
}

export default function ExchangeSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string | string[]; category?: string | string[] }>();
  const initialQuery = Array.isArray(params.query) ? params.query[0] : params.query;
  const initialCategory = Array.isArray(params.category) ? params.category[0] : params.category;

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [category, setCategory] = useState(initialCategory || 'All');
  const [make, setMake] = useState('All');
  const [model, setModel] = useState('All');
  const [year, setYear] = useState('All');
  const [location, setLocation] = useState('All');
  const [budget, setBudget] = useState<Budget>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load(asRefresh = false) {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const context = await getSelectedCustomerContext();
      setCustomerId(context?.customer_id ?? null);
      const data = await getExchangeMarketplaceFeed({ limit: 100 });
      setRows(data as FeedRow[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const makes = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => row.make).filter((value): value is string => Boolean(value)))).sort()], [rows]);
  const models = useMemo(() => ['All', ...Array.from(new Set(rows.filter((row) => make === 'All' || row.make === make).map((row) => row.model).filter((value): value is string => Boolean(value)))).sort()], [rows, make]);
  const years = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => row.year).filter((value): value is number => Boolean(value)))).sort((a, b) => b - a).map(String)], [rows]);
  const locations = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => [row.city, row.state].filter(Boolean).join(', ')).filter(Boolean))).sort()], [rows]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const rowLocation = [row.city, row.state].filter(Boolean).join(', ');
      const searchText = [row.title, row.make, row.model, row.category, row.city, row.state].filter(Boolean).join(' ').toLowerCase();
      return (!normalized || searchText.includes(normalized))
        && (category === 'All' || row.category === category)
        && (make === 'All' || row.make === make)
        && (model === 'All' || row.model === model)
        && (year === 'All' || String(row.year ?? '') === year)
        && (location === 'All' || rowLocation === location)
        && matchesBudget(row, budget);
    });

    if (sortMode === 'price_low') return [...filtered].sort((a, b) => Number(a.asking_price) - Number(b.asking_price));
    if (sortMode === 'price_high') return [...filtered].sort((a, b) => Number(b.asking_price) - Number(a.asking_price));
    if (sortMode === 'newest') return [...filtered].sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0));
    return filtered;
  }, [rows, query, category, make, model, year, location, budget, sortMode]);

  function toggleCompare(listingId: string) {
    setCompareIds((current) => {
      if (current.includes(listingId)) return current.filter((id) => id !== listingId);
      if (current.length >= 3) return current;
      return [...current, listingId];
    });
  }

  async function toggleFavorite(row: FeedRow) {
    if (!customerId) return;
    try {
      const added = await toggleExchangeFavorite(row.listing_id, customerId);
      setRows((current) => current.map((item) => item.listing_id === row.listing_id ? { ...item, is_favorite: added } : item));
    } catch {
      // Keep discovery usable if a favourite mutation fails; a later refresh restores server state.
    }
  }

  const activeFilterCount = [category !== 'All', make !== 'All', model !== 'All', year !== 'All', location !== 'All', budget !== 'all'].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Find a commercial vehicle</Text>
          <Text style={styles.headerSubtitle}>{rows.length} live vehicles loaded</Text>
        </View>
        <Pressable onPress={() => setSheet('filters')} style={styles.headerButton}>
          <MaterialCommunityIcons name="tune-variant" size={19} color="#0F1D33" />
          {activeFilterCount ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View> : null}
        </Pressable>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#718095" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search make, model, truck, JCB, city..."
            placeholderTextColor="#939EAC"
            style={styles.searchInput}
            autoFocus={Boolean(initialQuery)}
          />
          {query ? <Pressable onPress={() => setQuery('')}><MaterialCommunityIcons name="close-circle" size={18} color="#9AA5B4" /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label={category === 'All' ? 'Category' : category} active={category !== 'All'} onPress={() => setSheet('filters')} />
          <FilterChip label={make === 'All' ? 'Make' : make} active={make !== 'All'} onPress={() => setSheet('filters')} />
          <FilterChip label={model === 'All' ? 'Model' : model} active={model !== 'All'} onPress={() => setSheet('filters')} />
          <FilterChip label={year === 'All' ? 'Year' : year} active={year !== 'All'} onPress={() => setSheet('filters')} />
          <FilterChip label={location === 'All' ? 'Location' : location} active={location !== 'All'} onPress={() => setSheet('filters')} />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.resultHeader}>
          <View>
            <Text style={styles.resultTitle}>{loading ? 'Loading vehicles…' : `${visible.length} vehicles`}</Text>
            <Text style={styles.resultCopy}>Live Exchange inventory matching your filters</Text>
          </View>
          <Pressable onPress={() => setSheet('sort')} style={styles.sortButton}>
            <MaterialCommunityIcons name="sort" size={16} color="#164BB8" />
            <Text style={styles.sortText}>{sortMode === 'recommended' ? 'Sort' : sortMode === 'price_low' ? 'Price ↑' : sortMode === 'price_high' ? 'Price ↓' : 'Newest'}</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {visible.map((row) => (
            <Pressable
              key={row.listing_id}
              onPress={() => router.push({ pathname: '/customer/exchange/[listingId]', params: { listingId: row.listing_id } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.imageWrap}>
                {row.cover_url ? (
                  <Image source={{ uri: row.cover_url }} resizeMode="contain" style={styles.image} />
                ) : (
                  <MaterialCommunityIcons name={categoryIcon(row.category)} size={62} color="#607087" />
                )}
                <Pressable onPress={(event) => { event.stopPropagation(); void toggleFavorite(row); }} style={styles.favorite}>
                  <MaterialCommunityIcons name={row.is_favorite ? 'heart' : 'heart-outline'} size={19} color={row.is_favorite ? '#D7385E' : '#243349'} />
                </Pressable>
                {row.inspected ? <View style={styles.inspected}><MaterialCommunityIcons name="shield-check" size={11} color="#0D7C58" /><Text style={styles.inspectedText}>INSPECTED</Text></View> : null}
              </View>
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={styles.cardTitle}>{row.year ? `${row.year} ` : ''}{row.title}</Text>
                <Text style={styles.cardMeta}>{km(row.odometer_km)} • {row.fuel_type || 'Fuel verified'} • {row.ownership_count ? `${row.ownership_count} owner` : 'Ownership verified'}</Text>
                <View style={styles.locationLine}><MaterialCommunityIcons name="map-marker-outline" size={13} color="#7B8798" /><Text numberOfLines={1} style={styles.locationText}>{[row.city, row.state].filter(Boolean).join(', ') || 'Location available'}</Text></View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{money(Number(row.asking_price))}</Text>
                  <View style={styles.modePill}><Text style={styles.modeText}>{modeLabel(row.selling_mode)}</Text></View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.trustText}>{row.documents_verified ? '✓ Documents verified' : row.owner_verified ? '✓ Owner verified' : 'Verification in progress'}</Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleCompare(row.listing_id);
                    }}
                    style={[styles.comparePill, compareIds.includes(row.listing_id) && styles.comparePillActive]}
                  >
                    <MaterialCommunityIcons name={compareIds.includes(row.listing_id) ? 'check' : 'compare-horizontal'} size={13} color={compareIds.includes(row.listing_id) ? '#FFFFFF' : '#164BB8'} />
                    <Text style={[styles.comparePillText, compareIds.includes(row.listing_id) && styles.comparePillTextActive]}>Compare</Text>
                  </Pressable>
                </View>
                <View style={styles.cardSignalRow}>
                  {row.selling_mode === 'managed_auction' ? <Text style={styles.auctionText}>{row.bid_count} bids</Text> : row.selling_mode === 'open_bidding' && row.bid_count ? <Text style={styles.auctionText}>{row.bid_count} offers</Text> : <Text style={styles.viewText}>View details</Text>}
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {!loading && visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><MaterialCommunityIcons name="filter-remove-outline" size={25} color="#164BB8" /></View>
            <Text style={styles.emptyTitle}>No exact matches</Text>
            <Text style={styles.emptyCopy}>Try widening your location, budget or vehicle filters.</Text>
            <Pressable onPress={() => { setCategory('All'); setMake('All'); setModel('All'); setYear('All'); setLocation('All'); setBudget('all'); setQuery(''); }} style={styles.clearButton}><Text style={styles.clearText}>Clear all filters</Text></Pressable>
          </View>
        ) : null}
      </ScrollView>

      {compareIds.length > 0 ? (
        <View style={styles.compareBar}>
          <View style={styles.compareBarCopy}>
            <Text style={styles.compareBarTitle}>{compareIds.length} selected</Text>
            <Text style={styles.compareBarSubtitle}>{compareIds.length < 2 ? 'Select one more vehicle to compare' : 'Compare verified specs side by side'}</Text>
          </View>
          <Pressable onPress={() => setCompareIds([])} style={styles.compareClear}>
            <Text style={styles.compareClearText}>Clear</Text>
          </Pressable>
          <Pressable
            disabled={compareIds.length < 2}
            onPress={() => router.push({ pathname: '/customer/exchange/compare', params: { ids: compareIds.join(',') } })}
            style={[styles.compareButton, compareIds.length < 2 && styles.compareButtonDisabled]}
          >
            <Text style={styles.compareButtonText}>Compare</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      <FilterSheet
        visible={sheet === 'filters'}
        rows={rows}
        categories={['All', 'Truck', 'Tipper', 'Pickup', 'Bus', 'Construction', 'Other']}
        makes={makes}
        models={models}
        years={years}
        locations={locations}
        category={category}
        make={make}
        model={model}
        year={year}
        location={location}
        budget={budget}
        onCategory={setCategory}
        onMake={(value) => { setMake(value); setModel('All'); }}
        onModel={setModel}
        onYear={setYear}
        onLocation={setLocation}
        onBudget={setBudget}
        onClose={() => setSheet(null)}
      />

      <SortSheet visible={sheet === 'sort'} value={sortMode} onChange={(value) => { setSortMode(value); setSheet(null); }} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-down" size={14} color={active ? '#164BB8' : '#6E7B8F'} />
    </Pressable>
  );
}

function FilterSheet({
  visible,
  categories,
  makes,
  models,
  years,
  locations,
  category,
  make,
  model,
  year,
  location,
  budget,
  onCategory,
  onMake,
  onModel,
  onYear,
  onLocation,
  onBudget,
  onClose,
}: {
  visible: boolean;
  rows: FeedRow[];
  categories: string[];
  makes: string[];
  models: string[];
  years: string[];
  locations: string[];
  category: string;
  make: string;
  model: string;
  year: string;
  location: string;
  budget: Budget;
  onCategory: (value: string) => void;
  onMake: (value: string) => void;
  onModel: (value: string) => void;
  onYear: (value: string) => void;
  onLocation: (value: string) => void;
  onBudget: (value: Budget) => void;
  onClose: () => void;
}) {
  const budgetOptions: Array<[Budget, string]> = [['all', 'Any budget'], ['under_15', 'Under ₹15L'], ['15_25', '₹15–25L'], ['25_40', '₹25–40L'], ['40_plus', '₹40L+']];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Filters</Text><Pressable onPress={onClose} style={styles.sheetClose}><MaterialCommunityIcons name="close" size={20} color="#0F1D33" /></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <OptionSection title="Category" values={categories} selected={category} onSelect={onCategory} />
            <OptionSection title="Make" values={makes} selected={make} onSelect={onMake} />
            <OptionSection title="Model" values={models} selected={model} onSelect={onModel} />
            <OptionSection title="Year" values={years} selected={year} onSelect={onYear} />
            <OptionSection title="Location" values={locations} selected={location} onSelect={onLocation} />
            <Text style={styles.optionTitle}>Budget</Text>
            <View style={styles.optionWrap}>{budgetOptions.map(([value, label]) => <Option key={value} label={label} active={budget === value} onPress={() => onBudget(value)} />)}</View>
          </ScrollView>
          <Pressable onPress={onClose} style={styles.applyButton}><Text style={styles.applyText}>Show results</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function OptionSection({ title, values, selected, onSelect }: { title: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.optionWrap}>{values.slice(0, 30).map((value) => <Option key={value} label={value} active={selected === value} onPress={() => onSelect(value)} />)}</View>
    </>
  );
}

function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}><Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text></Pressable>;
}

function SortSheet({ visible, value, onChange, onClose }: { visible: boolean; value: SortMode; onChange: (value: SortMode) => void; onClose: () => void }) {
  const options: Array<[SortMode, string, string]> = [
    ['recommended', 'Recommended', 'Default marketplace order'],
    ['price_low', 'Price: low to high', 'Start with lower asking prices'],
    ['price_high', 'Price: high to low', 'Start with higher asking prices'],
    ['newest', 'Newest vehicle year', 'Newer model years first'],
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: '55%' }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Sort vehicles</Text>
          <View style={{ marginTop: 12, gap: 7 }}>
            {options.map(([key, title, copy]) => (
              <Pressable key={key} onPress={() => onChange(key)} style={[styles.sortRow, value === key && styles.sortRowActive]}>
                <View style={styles.flex}><Text style={styles.sortRowTitle}>{title}</Text><Text style={styles.sortRowCopy}>{copy}</Text></View>
                <MaterialCommunityIcons name={value === key ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={value === key ? '#164BB8' : '#9AA5B4'} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  header: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E9EF' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  headerCopy: { flex: 1, paddingHorizontal: 10 },
  headerTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: '#8793A4', fontSize: 7.8, fontWeight: '700' },
  filterBadge: { position: 'absolute', top: -2, right: -1, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  filterBadgeText: { color: '#FFFFFF', fontSize: 6.5, fontWeight: '900' },

  searchArea: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: '#F7F8FA' },
  searchBox: { minHeight: 50, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2E9' },
  searchInput: { flex: 1, minHeight: 48, color: '#0F1D33', fontSize: 11.5, fontWeight: '700' },
  chips: { paddingTop: 9, paddingRight: 14, gap: 7 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2E9' },
  chipActive: { backgroundColor: '#EEF4FF', borderColor: '#AFC7EC' },
  chipText: { color: '#69768A', fontSize: 8.4, fontWeight: '800' },
  chipTextActive: { color: '#164BB8', fontWeight: '900' },

  content: { padding: 14, paddingTop: 4, paddingBottom: 36 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  resultCopy: { marginTop: 2, color: '#8894A4', fontSize: 7.8, fontWeight: '700' },
  sortButton: { height: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF4FF' },
  sortText: { color: '#164BB8', fontSize: 8.3, fontWeight: '900' },

  list: { marginTop: 11, gap: 10 },
  card: { overflow: 'hidden', borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  imageWrap: { height: 174, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F7' },
  image: { width: '90%', height: '86%' },
  favorite: { position: 'absolute', right: 10, top: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  inspected: { position: 'absolute', left: 10, top: 10, height: 24, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F6EE' },
  inspectedText: { color: '#0D7C58', fontSize: 6.9, fontWeight: '900' },
  cardBody: { padding: 13 },
  cardTitle: { color: '#0F1D33', fontSize: 13, fontWeight: '900' },
  cardMeta: { marginTop: 4, color: '#748195', fontSize: 8.5, fontWeight: '700' },
  locationLine: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { flex: 1, color: '#7B8798', fontSize: 8.2, fontWeight: '700' },
  priceRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: '#0F1D33', fontSize: 17, fontWeight: '900' },
  modePill: { minHeight: 23, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  modeText: { color: '#164BB8', fontSize: 7, fontWeight: '900' },
  cardFooter: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EEF1F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  comparePill: { height: 30, borderRadius: 15, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C7D8F3' },
  comparePillActive: { backgroundColor: '#164BB8', borderColor: '#164BB8' },
  comparePillText: { color: '#164BB8', fontSize: 7.4, fontWeight: '900' },
  comparePillTextActive: { color: '#FFFFFF' },
  cardSignalRow: { marginTop: 7, flexDirection: 'row', justifyContent: 'flex-end' },
  trustText: { flex: 1, color: '#667387', fontSize: 7.8, fontWeight: '800' },
  auctionText: { color: '#C56A12', fontSize: 7.8, fontWeight: '900' },
  viewText: { color: '#164BB8', fontSize: 7.8, fontWeight: '900' },

  empty: { marginTop: 18, padding: 24, borderRadius: 18, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  emptyTitle: { marginTop: 9, color: '#0F1D33', fontSize: 11, fontWeight: '900' },
  emptyCopy: { marginTop: 4, color: '#7B8798', fontSize: 8.3, textAlign: 'center', fontWeight: '700' },
  clearButton: { marginTop: 11, height: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  clearText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },

  compareBar: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DFE5EC' },
  compareBarCopy: { flex: 1 },
  compareBarTitle: { color: '#0F1D33', fontSize: 9.5, fontWeight: '900' },
  compareBarSubtitle: { marginTop: 2, color: '#7C899B', fontSize: 7.3, fontWeight: '700' },
  compareClear: { height: 36, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F6' },
  compareClearText: { color: '#657286', fontSize: 7.6, fontWeight: '900' },
  compareButton: { height: 42, borderRadius: 21, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#164BB8' },
  compareButtonDisabled: { opacity: 0.42 },
  compareButtonText: { color: '#FFFFFF', fontSize: 8.4, fontWeight: '900' },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,29,0.45)' },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '84%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 9, paddingBottom: 18, backgroundColor: '#FFFFFF' },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#CAD1DB', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#0F1D33', fontSize: 17, fontWeight: '900' },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F8' },
  sheetContent: { paddingBottom: 10 },
  optionTitle: { marginTop: 16, marginBottom: 8, color: '#4B596F', fontSize: 9, fontWeight: '900' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { minHeight: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E3E7ED' },
  optionActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  optionText: { color: '#68758A', fontSize: 8.1, fontWeight: '800' },
  optionTextActive: { color: '#164BB8', fontWeight: '900' },
  applyButton: { marginTop: 8, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  applyText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  sortRow: { minHeight: 62, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF' },
  sortRowActive: { backgroundColor: '#EEF4FF', borderColor: '#AFC7EC' },
  sortRowTitle: { color: '#25344A', fontSize: 9.5, fontWeight: '900' },
  sortRowCopy: { marginTop: 3, color: '#7A8799', fontSize: 7.5, fontWeight: '700' },
});

