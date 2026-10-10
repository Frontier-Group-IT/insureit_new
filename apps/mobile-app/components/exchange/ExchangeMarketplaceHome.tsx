import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
  type ImageSourcePropType,
} from 'react-native';

export type ExchangeHomeCategory = 'All' | 'Truck' | 'Tipper' | 'Pickup' | 'Bus' | 'Construction';

export type ExchangeHomeVehicle = {
  id: string;
  title: string;
  category: Exclude<ExchangeHomeCategory, 'All'>;
  sellingMode: 'fixed_price' | 'open_bidding' | 'managed_auction';
  year: number;
  km: number;
  location: string;
  askingPrice: number;
  currentBid: number;
  bids: number;
  ending: string;
  verified: boolean;
  documentsVerified: boolean;
  inspected: boolean;
  score: number;
  fuel: string;
  ownership: string;
  image: ImageSourcePropType;
};

type BudgetFilter = 'All' | 'Under 15L' | '15-25L' | '25-40L' | '40L+';
type SortMode = 'Recommended' | 'Price low' | 'Price high' | 'Newest';

const categories: ExchangeHomeCategory[] = ['All', 'Truck', 'Tipper', 'Pickup', 'Bus', 'Construction'];
const budgets: BudgetFilter[] = ['All', 'Under 15L', '15-25L', '25-40L', '40L+'];

function formatCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatKm(value: number) {
  return value > 0 ? `${value.toLocaleString('en-IN')} km` : 'KM verified';
}

function categoryIcon(category: ExchangeHomeCategory) {
  if (category === 'All') return 'view-grid-outline' as const;
  if (category === 'Tipper') return 'dump-truck' as const;
  if (category === 'Pickup') return 'car-pickup' as const;
  if (category === 'Bus') return 'bus' as const;
  if (category === 'Construction') return 'excavator' as const;
  return 'truck' as const;
}

function budgetMatch(vehicle: ExchangeHomeVehicle, budget: BudgetFilter) {
  if (budget === 'All') return true;
  if (budget === 'Under 15L') return vehicle.askingPrice < 1500000;
  if (budget === '15-25L') return vehicle.askingPrice >= 1500000 && vehicle.askingPrice < 2500000;
  if (budget === '25-40L') return vehicle.askingPrice >= 2500000 && vehicle.askingPrice < 4000000;
  return vehicle.askingPrice >= 4000000;
}

function sellerTrustLabel(vehicle: ExchangeHomeVehicle) {
  if (vehicle.inspected && vehicle.documentsVerified) return 'InsureIT inspected';
  if (vehicle.documentsVerified) return 'Documents verified';
  if (vehicle.verified) return 'Owner verified';
  return null;
}

function priceSignal(vehicle: ExchangeHomeVehicle) {
  if (vehicle.sellingMode === 'managed_auction' && vehicle.bids > 0) return 'Live auction';
  if (vehicle.sellingMode === 'open_bidding' && vehicle.bids > 0) return 'Offers active';
  if (vehicle.inspected && vehicle.score >= 8) return 'Strong condition';
  if (vehicle.sellingMode === 'fixed_price') return 'Fixed price';
  return 'Open to offers';
}

export function ExchangeMarketplaceHome({
  query,
  category,
  vehicles,
  totalVehicles,
  favorites,
  refreshing,
  onRefresh,
  onQueryChange,
  selectedLocation,
  availableLocations,
  onLocationChange,
  onCategoryChange,
  onOpenVehicle,
  onFavorite,
  onSell,
  onActivity,
  onValue,
  onBrowseAll,
}: {
  query: string;
  category: ExchangeHomeCategory;
  vehicles: ExchangeHomeVehicle[];
  totalVehicles: number;
  favorites: string[];
  refreshing: boolean;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  selectedLocation: string | null;
  availableLocations: string[];
  onLocationChange: (location: string | null) => void;
  onCategoryChange: (category: ExchangeHomeCategory) => void;
  onOpenVehicle: (vehicle: ExchangeHomeVehicle) => void;
  onFavorite: (id: string) => void;
  onSell: () => void;
  onActivity: () => void;
  onValue: () => void;
  onBrowseAll: () => void;
}) {
  const [budget, setBudget] = useState<BudgetFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('Recommended');
  const [filterVisible, setFilterVisible] = useState(false);
  const [locationVisible, setLocationVisible] = useState(false);

  const visibleVehicles = useMemo(() => {
    const filtered = vehicles.filter((vehicle) => budgetMatch(vehicle, budget));
    if (sortMode === 'Price low') return [...filtered].sort((a, b) => a.askingPrice - b.askingPrice);
    if (sortMode === 'Price high') return [...filtered].sort((a, b) => b.askingPrice - a.askingPrice);
    if (sortMode === 'Newest') return [...filtered].sort((a, b) => b.year - a.year);
    return filtered;
  }, [budget, sortMode, vehicles]);

  const featured = visibleVehicles.slice(0, 4);

  return (
    <>
      <Modal transparent visible={locationVisible} animationType="fade" onRequestClose={() => setLocationVisible(false)}>
        <View style={styles.locationModalBackdrop}>
          <View style={styles.locationModalCard}>
            <View style={styles.locationModalHeading}>
              <Text style={styles.locationModalTitle}>Select location</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close locations" onPress={() => setLocationVisible(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#44536B" />
              </Pressable>
            </View>
            <ScrollView style={styles.locationModalOptions} keyboardShouldPersistTaps="handled">
              {[null, ...availableLocations].map((location) => {
                const active = selectedLocation === location;
                return (
                  <Pressable
                    key={location ?? 'all-locations'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => { onLocationChange(location); setLocationVisible(false); }}
                    style={[styles.locationModalOption, active && styles.locationModalOptionActive]}
                  >
                    <MaterialCommunityIcons name={active ? "radiobox-marked" : "radiobox-blank"} size={19} color={active ? "#174EA6" : "#8C9AAE"} />
                    <Text numberOfLines={2} style={styles.locationModalOptionText}>{location ?? 'All locations'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.pageTitle}>Exchange</Text>
        <View style={styles.searchFilterRow}>
          <MaterialCommunityIcons name="magnify" size={21} color="#8190A5" />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search trucks, tippers, buses, JCB..."
            placeholderTextColor="#8A95A5"
            style={styles.searchInput}
            accessibilityLabel="Search exchange vehicles"
          />
          {query ? (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8} accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={18} color="#9AA5B5" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedLocation ? `Change location filter, ${selectedLocation}` : 'Filter by location'}
            accessibilityHint="Opens a list of marketplace locations"
            onPress={() => setLocationVisible(true)}
            hitSlop={8}
            style={styles.locationIndicator}
          >
            <MaterialCommunityIcons name={selectedLocation ? "map-marker" : "map-marker-outline"} size={23} color={selectedLocation ? "#174EA6" : "#8290A4"} />
          </Pressable>
        </View>

        <View style={styles.segmentedStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentedContent} accessibilityLabel="Vehicle category filters">
            {categories.map((item) => {
              const count = item === 'All' ? totalVehicles : vehicles.filter((vehicle) => vehicle.category === item).length;
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onCategoryChange(item)}
                  style={({ pressed }) => [styles.segmentTab, selected && styles.segmentTabActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>{item} ({count})</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.intentGrid}>
          <IntentCard
            icon="truck-check"
            title="Buy a Vehicle"
            copy="Find verified commercial vehicles"
            tone="blue"
            onPress={onBrowseAll}
          />
          <IntentCard
            icon="truck-plus"
            title="Sell a Vehicle"
            copy="List a vehicle from your fleet"
            tone="orange"
            onPress={onSell}
          />
          <IntentCard
            icon="chart-line"
            title="Check Value"
            copy="Know approximate market value"
            tone="green"
            onPress={onValue}
          />
          <IntentCard
            icon="clipboard-check-outline"
            title="My Exchange"
            copy="Offers, listings and deals"
            tone="indigo"
            onPress={onActivity}
          />
        </View>

        {featured.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured vehicles</Text>
              <Pressable onPress={onBrowseAll} hitSlop={8}>
                <View style={styles.viewAllRow}><Text style={styles.sectionAction}>View all</Text><MaterialCommunityIcons name="chevron-right" size={17} color="#1455AB" /></View>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featureRail}
            >
              {featured.map((vehicle) => (
                <FeaturedVehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  favorite={favorites.includes(vehicle.id)}
                  onFavorite={() => onFavorite(vehicle.id)}
                  onOpen={() => onOpenVehicle(vehicle)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>{category === 'All' ? 'Vehicles for you' : category}</Text>
            <Text style={styles.sectionSubtitle}>{visibleVehicles.length} matching vehicles</Text>
          </View>
          <Pressable onPress={() => setFilterVisible(true)} style={styles.filterButton}>
            <MaterialCommunityIcons name="tune-variant" size={16} color="#0F1D33" />
            <Text style={styles.filterButtonText}>Filters</Text>
            {budget !== 'All' ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFilterRail}
        >
          <QuickFilter
            label={budget === 'All' ? 'Budget' : budget}
            active={budget !== 'All'}
            onPress={() => setFilterVisible(true)}
          />
          <QuickFilter label="Make & Model" onPress={() => setFilterVisible(true)} />
          <QuickFilter label="Year" onPress={() => setFilterVisible(true)} />
          <QuickFilter
            label={sortMode === 'Recommended' ? 'Sort' : sortMode}
            active={sortMode !== 'Recommended'}
            onPress={() => setFilterVisible(true)}
          />
        </ScrollView>

        <View style={styles.vehicleList}>
          {visibleVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              favorite={favorites.includes(vehicle.id)}
              onOpen={() => onOpenVehicle(vehicle)}
              onFavorite={() => onFavorite(vehicle.id)}
            />
          ))}
        </View>

        {visibleVehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="car-search-outline" size={28} color="#164BB8" />
            </View>
            <Text style={styles.emptyTitle}>No matching vehicles</Text>
            <Text style={styles.emptyCopy}>Try another category, budget or search term.</Text>
            <Pressable
              onPress={() => {
                setBudget('All');
                onCategoryChange('All');
                onQueryChange('');
              }}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={onBrowseAll} style={({ pressed }) => [styles.browseAllButton, pressed && styles.pressed]}>
          <Text style={styles.browseAllText}>Browse all vehicles</Text>
          <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
        </Pressable>

        <View style={styles.sellBanner}>
          <View style={styles.sellBannerIcon}>
            <MaterialCommunityIcons name="truck-plus-outline" size={25} color="#164BB8" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.sellBannerTitle}>Planning to sell a commercial vehicle?</Text>
            <Text style={styles.sellBannerCopy}>Start with a vehicle already saved in your InsureIT fleet.</Text>
          </View>
          <Pressable onPress={onSell} hitSlop={8}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#164BB8" />
          </Pressable>
        </View>
      </ScrollView>

      <FilterSheet
        visible={filterVisible}
        category={category}
        budget={budget}
        sortMode={sortMode}
        onClose={() => setFilterVisible(false)}
        onCategoryChange={onCategoryChange}
        onBudgetChange={setBudget}
        onSortChange={setSortMode}
      />
    </>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function IntentCard({
  icon,
  title,
  copy,
  tone,
  onPress,
}: {
  icon: 'truck-check' | 'truck-plus' | 'chart-line' | 'clipboard-check-outline';
  title: string;
  copy: string;
  tone: 'blue' | 'orange' | 'green' | 'indigo';
  onPress: () => void;
}) {
  const toneStyle = tone === 'orange'
    ? styles.intentOrange
    : tone === 'green'
      ? styles.intentGreen
      : tone === 'indigo'
        ? styles.intentIndigo
        : styles.intentBlue;
  const iconColor = tone === 'orange' ? '#C56A12' : tone === 'green' ? '#0D7C58' : tone === 'indigo' ? '#4B4FB8' : '#164BB8';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.intentCard, toneStyle, pressed && styles.pressed]}>
      <View style={styles.intentTop}>
        <View style={styles.intentIconBadge}><MaterialCommunityIcons name={icon} size={30} color={iconColor} /></View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={iconColor} />
      </View>
      <Text style={styles.intentTitle}>{title}</Text>
      <Text style={styles.intentCopy}>{copy}</Text>
    </Pressable>
  );
}

function FeaturedVehicleCard({
  vehicle,
  favorite,
  onOpen,
  onFavorite,
}: {
  vehicle: ExchangeHomeVehicle;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const trust = sellerTrustLabel(vehicle);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.featureCard, pressed && styles.pressed]}>
      <View style={styles.featureImageWrap}>
        <Image source={vehicle.image} resizeMode="cover" style={styles.featureImage} />
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          style={styles.favoriteFloat}
        >
          <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? '#D7385E' : '#243349'} />
        </Pressable>
      </View>
      <View style={styles.featureBody}>
        <Text numberOfLines={1} style={styles.featureTitle}>{vehicle.year ? `${vehicle.year} ` : ''}{vehicle.title}</Text>
        <View style={styles.featureMetaRow}>
          <MaterialCommunityIcons name="speedometer" size={15} color="#8091AB" /><Text style={styles.featureMeta}>{formatKm(vehicle.km)}</Text>
          <Text style={styles.featureMeta}>·</Text><MaterialCommunityIcons name="gas-station" size={15} color="#8091AB" /><Text style={styles.featureMeta}>{vehicle.fuel}</Text>
          {vehicle.verified ? <><Text style={styles.featureMeta}>·</Text><MaterialCommunityIcons name="check-decagram" size={15} color="#2674DB" /><Text style={styles.featureMeta}>Ownership verified</Text></> : null}
        </View>
        <Text style={styles.featurePrice}>{formatCurrency(vehicle.askingPrice)}</Text>
        <View style={styles.featureFoot}>
          {trust ? <View style={styles.verifiedPill}><MaterialCommunityIcons name="shield-check" size={16} color="#087E69" /><Text style={styles.verifiedPillText}>Verified</Text></View> : null}
          <View style={styles.offerPill}><MaterialCommunityIcons name="tag-outline" size={15} color="#2565B5" /><Text style={styles.offerPillText}>{priceSignal(vehicle)}</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

function VehicleCard({
  vehicle,
  favorite,
  onOpen,
  onFavorite,
}: {
  vehicle: ExchangeHomeVehicle;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const trust = sellerTrustLabel(vehicle);
  const hasAuction = vehicle.bids > 0;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}>
      <View style={styles.vehicleImageWrap}>
        <Image source={vehicle.image} resizeMode="contain" style={styles.vehicleImage} />
        {vehicle.inspected ? (
          <View style={styles.inspectedPill}>
            <MaterialCommunityIcons name="shield-check" size={11} color="#0D7C58" />
            <Text style={styles.inspectedText}>INSPECTED</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.vehicleBody}>
        <View style={styles.vehicleTitleRow}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.vehicleTitle}>{vehicle.year ? `${vehicle.year} ` : ''}{vehicle.title}</Text>
            <Text style={styles.vehicleMeta}>{formatKm(vehicle.km)} • {vehicle.fuel} • {vehicle.ownership}</Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onFavorite();
            }}
            hitSlop={8}
          >
            <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? '#D7385E' : '#8B97A7'} />
          </Pressable>
        </View>
        <View style={styles.locationLine}>
          <MaterialCommunityIcons name="map-marker-outline" size={13} color="#7B8797" />
          <Text numberOfLines={1} style={styles.locationLineText}>{vehicle.location}</Text>
        </View>
        <View style={styles.vehiclePriceRow}>
          <View>
            <Text style={styles.askingLabel}>ASKING PRICE</Text>
            <Text style={styles.vehiclePrice}>{formatCurrency(vehicle.askingPrice)}</Text>
          </View>
          <View style={styles.pricePill}><Text style={styles.pricePillText}>{priceSignal(vehicle)}</Text></View>
        </View>
        <View style={styles.vehicleFooter}>
          <Text numberOfLines={1} style={styles.vehicleTrust}>{trust ? `✓ ${trust}` : 'Vehicle details available'}</Text>
          {vehicle.sellingMode === 'managed_auction' ? (
            <View style={styles.bidContext}>
              <MaterialCommunityIcons name="gavel" size={12} color="#C56A12" />
              <Text style={styles.bidContextText}>{vehicle.bids ? `${vehicle.bids} bids • ${vehicle.ending}` : `Auction • ${vehicle.ending}`}</Text>
            </View>
          ) : vehicle.sellingMode === 'open_bidding' && hasAuction ? (
            <View style={styles.bidContext}>
              <MaterialCommunityIcons name="handshake-outline" size={12} color="#C56A12" />
              <Text style={styles.bidContextText}>{vehicle.bids} offers</Text>
            </View>
          ) : (
            <Text style={styles.viewText}>{vehicle.sellingMode === 'fixed_price' ? 'Request details' : 'View details'}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function QuickFilter({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickFilter, active && styles.quickFilterActive]}>
      <Text style={[styles.quickFilterText, active && styles.quickFilterTextActive]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-down" size={14} color={active ? '#164BB8' : '#657286'} />
    </Pressable>
  );
}

function FilterSheet({
  visible,
  category,
  budget,
  sortMode,
  onClose,
  onCategoryChange,
  onBudgetChange,
  onSortChange,
}: {
  visible: boolean;
  category: ExchangeHomeCategory;
  budget: BudgetFilter;
  sortMode: SortMode;
  onClose: () => void;
  onCategoryChange: (category: ExchangeHomeCategory) => void;
  onBudgetChange: (budget: BudgetFilter) => void;
  onSortChange: (sort: SortMode) => void;
}) {
  const sorts: SortMode[] = ['Recommended', 'Price low', 'Price high', 'Newest'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <MaterialCommunityIcons name="close" size={20} color="#0F1D33" />
            </Pressable>
          </View>

          <Text style={styles.filterLabel}>Vehicle category</Text>
          <View style={styles.optionGrid}>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => onCategoryChange(item)}
                style={[styles.optionChip, category === item && styles.optionChipActive]}
              >
                <MaterialCommunityIcons name={categoryIcon(item)} size={17} color={category === item ? '#164BB8' : '#6D798B'} />
                <Text style={[styles.optionText, category === item && styles.optionTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>Budget</Text>
          <View style={styles.optionGrid}>
            {budgets.map((item) => (
              <Pressable
                key={item}
                onPress={() => onBudgetChange(item)}
                style={[styles.optionChip, budget === item && styles.optionChipActive]}
              >
                <Text style={[styles.optionText, budget === item && styles.optionTextActive]}>{item === 'All' ? 'Any budget' : item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>Sort by</Text>
          <View style={styles.optionGrid}>
            {sorts.map((item) => (
              <Pressable
                key={item}
                onPress={() => onSortChange(item)}
                style={[styles.optionChip, sortMode === item && styles.optionChipActive]}
              >
                <Text style={[styles.optionText, sortMode === item && styles.optionTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onClose} style={styles.showButton}>
            <Text style={styles.showButtonText}>Show vehicles</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 36, backgroundColor: '#F8FAFD' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },

  pageTitle: { marginTop: 18, color: '#0A2146', fontSize: 19, fontWeight: '900' },
  locationModalBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(9,22,46,0.48)' },
  locationModalCard: { maxHeight: '70%', borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18 },
  locationModalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationModalTitle: { color: '#0A2146', fontSize: 17, fontWeight: '900' },
  locationModalOptions: { flexGrow: 0 },
  locationModalOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 10 },
  locationModalOptionActive: { backgroundColor: '#EEF4FF' },
  locationModalOptionText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#203956' },
  searchFilterRow: { marginTop: 14, minHeight: 48, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#E2E7F0' },
  searchInput: { flex: 1, minWidth: 0, height: 46, paddingVertical: 0, color: '#10213D', fontSize: 12, fontWeight: '600' },
  locationIndicator: { width: 30, height: 42, alignItems: 'center', justifyContent: 'center' },
  segmentedStrip: { marginTop: 9, backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#DEE5F0', overflow: 'hidden' },
  segmentedContent: { alignItems: 'stretch', minHeight: 47 },
  segmentTab: { minHeight: 47, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  segmentTabActive: { backgroundColor: '#EDF4FF', borderBottomColor: '#164B99' },
  segmentLabel: { color: '#69758A', fontSize: 11, fontWeight: '700' },
  segmentLabelActive: { color: '#163E79', fontWeight: '800' },
  sectionHeader: { marginTop: 26, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0A2146', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { marginTop: 2, color: '#8290A3', fontSize: 8.8, fontWeight: '700' },
  sectionAction: { color: '#1455AB', fontSize: 12, fontWeight: '800' },

  intentGrid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  intentCard: { width: '48.4%', minHeight: 112, borderRadius: 15, padding: 14, borderWidth: 1 },
  intentBlue: { backgroundColor: '#EEF4FF', borderColor: '#D8E5FB' },
  intentOrange: { backgroundColor: '#FFF5E9', borderColor: '#F4E4CD' },
  intentGreen: { backgroundColor: '#ECF8F3', borderColor: '#D4ECE2' },
  intentIndigo: { backgroundColor: '#F0F0FC', borderColor: '#DDDDF6' },
  intentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intentTitle: { marginTop: 11, color: '#0F1D33', fontSize: 12.5, fontWeight: '900' },
  intentCopy: { marginTop: 4, color: '#69768A', fontSize: 10, lineHeight: 14, fontWeight: '600' },

  featureRail: { paddingRight: 18, gap: 12 },
  featureCard: { width: 330, overflow: 'hidden', borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE7F0' },
  featureImageWrap: { height: 180, margin: 9, borderRadius: 10, overflow: 'hidden', backgroundColor: '#EDF1F6' },
  featureImage: { width: '100%', height: '100%' },
  favoriteFloat: { position: 'absolute', right: 9, top: 9, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  featureBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  featureTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  featureMeta: { color: '#788598', fontSize: 10, fontWeight: '700' },
  featurePrice: { marginTop: 12, color: '#0B2145', fontSize: 21, fontWeight: '900' },
  featureFoot: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  pricePill: { minHeight: 22, borderRadius: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F6EE' },
  pricePillText: { color: '#0D7C58', fontSize: 7.8, fontWeight: '900' },
  trustText: { flex: 1, color: '#687588', textAlign: 'right', fontSize: 7.6, fontWeight: '800' },

  listHeader: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterButton: { height: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2E9' },
  filterButtonText: { color: '#0F1D33', fontSize: 9, fontWeight: '900' },
  filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#164BB8' },
  quickFilterRail: { marginTop: 10, paddingRight: 14, gap: 7 },
  quickFilter: { height: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2E9' },
  quickFilterActive: { backgroundColor: '#EEF4FF', borderColor: '#B9CFF4' },
  quickFilterText: { color: '#657286', fontSize: 8.8, fontWeight: '800' },
  quickFilterTextActive: { color: '#164BB8', fontWeight: '900' },

  vehicleList: { marginTop: 11, gap: 10 },
  vehicleCard: { overflow: 'hidden', borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  vehicleImageWrap: { height: 176, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  vehicleImage: { width: '88%', height: '84%' },
  inspectedPill: { position: 'absolute', left: 10, top: 10, height: 24, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F6EE' },
  inspectedText: { color: '#0D7C58', fontSize: 7.2, fontWeight: '900', letterSpacing: 0.3 },
  vehicleBody: { padding: 13 },
  vehicleTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  vehicleTitle: { color: '#0F1D33', fontSize: 13.2, fontWeight: '900' },
  vehicleMeta: { marginTop: 4, color: '#758295', fontSize: 8.8, fontWeight: '700' },
  locationLine: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationLineText: { flex: 1, color: '#7B8797', fontSize: 8.5, fontWeight: '700' },
  vehiclePriceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  askingLabel: { color: '#8A96A7', fontSize: 7.2, fontWeight: '900', letterSpacing: 0.5 },
  vehiclePrice: { marginTop: 2, color: '#0F1D33', fontSize: 17, fontWeight: '900' },
  vehicleFooter: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF1F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vehicleTrust: { flex: 1, color: '#667387', fontSize: 8.2, fontWeight: '800' },
  bidContext: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bidContextText: { color: '#C56A12', fontSize: 7.9, fontWeight: '900' },
  viewText: { color: '#164BB8', fontSize: 8.5, fontWeight: '900' },

  emptyState: { marginTop: 18, borderRadius: 19, padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  emptyIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  emptyTitle: { marginTop: 10, color: '#0F1D33', fontSize: 13, fontWeight: '900' },
  emptyCopy: { marginTop: 4, color: '#7D899B', fontSize: 9.3, fontWeight: '700' },
  resetButton: { marginTop: 12, height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  resetButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },

  browseAllButton: { marginTop: 14, height: 48, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#164BB8' },
  browseAllText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  sellBanner: { marginTop: 18, borderRadius: 19, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D8E5FB' },
  sellBannerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sellBannerTitle: { color: '#0F1D33', fontSize: 10.5, fontWeight: '900' },
  sellBannerCopy: { marginTop: 3, color: '#687589', fontSize: 8.4, lineHeight: 11.5, fontWeight: '700' },

  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  intentIconBadge: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' },
  featureMetaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 15, backgroundColor: '#DCF5ED' },
  verifiedPillText: { color: '#087E69', fontSize: 10, fontWeight: '800' },
  offerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 15, backgroundColor: '#E8F1FF' },
  offerPillText: { color: '#2565B5', fontSize: 10, fontWeight: '800' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,29,0.45)' },
  sheetDismiss: { flex: 1 },
  sheet: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CAD1DB', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#0F1D33', fontSize: 18, fontWeight: '900' },
  sheetClose: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F8' },
  filterLabel: { marginTop: 18, marginBottom: 9, color: '#435168', fontSize: 10, fontWeight: '900' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  optionChip: { minHeight: 36, borderRadius: 10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E1E6ED' },
  optionChipActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  optionText: { color: '#667387', fontSize: 8.8, fontWeight: '800' },
  optionTextActive: { color: '#164BB8', fontWeight: '900' },
  showButton: { marginTop: 22, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  showButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});

export default ExchangeMarketplaceHome;
