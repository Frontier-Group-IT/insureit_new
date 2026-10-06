import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/lib/theme';

type ExchangeTab = 'buy' | 'sell' | 'activity';
type VehicleCategory = 'All' | 'Truck' | 'Tipper' | 'Pickup' | 'Bus' | 'Construction';
type MarketplaceVehicle = {
  id: string;
  title: string;
  category: Exclude<VehicleCategory, 'All'>;
  year: number;
  km: number;
  location: string;
  askingPrice: number;
  currentBid: number;
  bids: number;
  ending: string;
  verified: boolean;
  ownerVerified: boolean;
  documentsVerified: boolean;
  inspected: boolean;
  score: number;
  registration: string;
  fuel: string;
  ownership: string;
  tyres: string;
  permit: string;
  finance: string;
};

type SellDraft = {
  registration: string;
  makeModel: string;
  year: string;
  km: string;
  category: Exclude<VehicleCategory, 'All'>;
  askingPrice: string;
};

const categories: VehicleCategory[] = ['All', 'Truck', 'Tipper', 'Pickup', 'Bus', 'Construction'];

const marketplaceSeed: MarketplaceVehicle[] = [
  {
    id: 'ex-1001',
    title: 'Tata 407 Gold SFC',
    category: 'Truck',
    year: 2021,
    km: 72400,
    location: 'Jabalpur, MP',
    askingPrice: 840000,
    currentBid: 785000,
    bids: 8,
    ending: '4h 16m',
    verified: true,
    ownerVerified: true,
    documentsVerified: true,
    inspected: true,
    score: 86,
    registration: 'MP20•••7421',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '72% life',
    permit: 'National permit',
    finance: 'No active finance',
  },
  {
    id: 'ex-1002',
    title: 'BharatBenz 2823C',
    category: 'Tipper',
    year: 2020,
    km: 118500,
    location: 'Katni, MP',
    askingPrice: 1850000,
    currentBid: 1725000,
    bids: 11,
    ending: '7h 40m',
    verified: true,
    ownerVerified: true,
    documentsVerified: true,
    inspected: true,
    score: 82,
    registration: 'MP21•••3894',
    fuel: 'Diesel',
    ownership: '2nd owner',
    tyres: '64% life',
    permit: 'State permit',
    finance: 'Hypothecation closure in progress',
  },
  {
    id: 'ex-1003',
    title: 'Eicher Pro 3015',
    category: 'Truck',
    year: 2022,
    km: 64200,
    location: 'Damoh, MP',
    askingPrice: 1620000,
    currentBid: 1560000,
    bids: 6,
    ending: '1d 2h',
    verified: true,
    ownerVerified: true,
    documentsVerified: true,
    inspected: false,
    score: 0,
    registration: 'MP34•••1286',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '79% life',
    permit: 'National permit',
    finance: 'No active finance',
  },
  {
    id: 'ex-1004',
    title: 'Mahindra Bolero Pik-Up',
    category: 'Pickup',
    year: 2023,
    km: 31800,
    location: 'Seoni, MP',
    askingPrice: 925000,
    currentBid: 870000,
    bids: 4,
    ending: '2d 5h',
    verified: false,
    ownerVerified: true,
    documentsVerified: false,
    inspected: false,
    score: 0,
    registration: 'MP22•••9132',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '84% life',
    permit: 'State permit',
    finance: 'Finance details pending',
  },
  {
    id: 'ex-1005',
    title: 'Tata Starbus 32 Seater',
    category: 'Bus',
    year: 2019,
    km: 146300,
    location: 'Narsinghpur, MP',
    askingPrice: 1280000,
    currentBid: 1190000,
    bids: 7,
    ending: '10h 05m',
    verified: true,
    ownerVerified: true,
    documentsVerified: true,
    inspected: true,
    score: 78,
    registration: 'MP49•••6024',
    fuel: 'Diesel',
    ownership: '2nd owner',
    tyres: '58% life',
    permit: 'Stage carriage',
    finance: 'No active finance',
  },
  {
    id: 'ex-1006',
    title: 'JCB 3DX Super',
    category: 'Construction',
    year: 2020,
    km: 5960,
    location: 'Balaghat, MP',
    askingPrice: 2350000,
    currentBid: 2210000,
    bids: 9,
    ending: '18h 22m',
    verified: true,
    ownerVerified: true,
    documentsVerified: true,
    inspected: true,
    score: 84,
    registration: 'Equipment • serial masked',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '68% life',
    permit: 'Not applicable',
    finance: 'No active finance',
  },
];

function formatCompactCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatKm(value: number) {
  return `${value.toLocaleString('en-IN')} km`;
}

function categoryIcon(category: Exclude<VehicleCategory, 'All'>) {
  if (category === 'Tipper') return 'dump-truck' as const;
  if (category === 'Pickup') return 'car-pickup' as const;
  if (category === 'Bus') return 'bus' as const;
  if (category === 'Construction') return 'tractor' as const;
  return 'truck-outline' as const;
}

export default function ExchangeMarketplaceDraftScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ExchangeTab>('buy');
  const [category, setCategory] = useState<VehicleCategory>('All');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<MarketplaceVehicle | null>(null);
  const [bidOverrides, setBidOverrides] = useState<Record<string, number>>({});
  const [sellPreviewVisible, setSellPreviewVisible] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [sellDraft, setSellDraft] = useState<SellDraft>({
    registration: '',
    makeModel: '',
    year: '',
    km: '',
    category: 'Truck',
    askingPrice: '',
  });

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return marketplaceSeed.filter((vehicle) => {
      const matchesCategory = category === 'All' || vehicle.category === category;
      const matchesQuery =
        !normalizedQuery ||
        vehicle.title.toLowerCase().includes(normalizedQuery) ||
        vehicle.location.toLowerCase().includes(normalizedQuery) ||
        vehicle.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const myBids = useMemo(
    () =>
      marketplaceSeed
        .filter((vehicle) => bidOverrides[vehicle.id])
        .map((vehicle) => ({ vehicle, amount: bidOverrides[vehicle.id] })),
    [bidOverrides],
  );

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function currentBidFor(vehicle: MarketplaceVehicle) {
    return Math.max(vehicle.currentBid, bidOverrides[vehicle.id] ?? 0);
  }

  function placeBid(vehicle: MarketplaceVehicle, amount: number) {
    const currentBid = currentBidFor(vehicle);
    const minimum = currentBid + 10000;
    if (amount < minimum) {
      Alert.alert('Bid too low', `The next minimum bid is ${formatCompactCurrency(minimum)}.`);
      return;
    }

    Alert.alert(
      'Confirm bid',
      `Place a bid of ${formatCompactCurrency(amount)} on ${vehicle.title}?\n\nThis first draft keeps bids on-device only for visual review.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm bid',
          onPress: () => {
            setBidOverrides((current) => ({ ...current, [vehicle.id]: amount }));
            Alert.alert('Bid recorded', 'Your demo bid is now visible in My Activity.');
          },
        },
      ],
    );
  }

  function updateDraft<K extends keyof SellDraft>(key: K, value: SellDraft[K]) {
    setSellDraft((current) => ({ ...current, [key]: value }));
  }

  function previewSellDraft() {
    if (!sellDraft.registration.trim() || !sellDraft.makeModel.trim() || !sellDraft.askingPrice.trim()) {
      Alert.alert('Complete key details', 'Add the registration, make/model and expected price before previewing.');
      return;
    }
    setSellPreviewVisible(true);
  }

  function saveDraft() {
    setDraftSaved(true);
    Alert.alert('Draft saved', 'This first draft stores the listing only in the current app session. Nothing has been published.');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={10}
          onPress={() => router.replace('/customer/home')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Exchange</Text>
          <Text style={styles.headerSubtitle}>Commercial vehicle marketplace</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open my activity"
          onPress={() => setTab('activity')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        <TopTab label="Buy" icon="magnify" active={tab === 'buy'} onPress={() => setTab('buy')} />
        <TopTab label="Sell" icon="tag-outline" active={tab === 'sell'} onPress={() => setTab('sell')} />
        <TopTab label="My Activity" icon="gavel" active={tab === 'activity'} onPress={() => setTab('activity')} />
      </View>

      {tab === 'buy' ? (
        <BuyTab
          category={category}
          query={query}
          vehicles={filteredVehicles}
          favorites={favorites}
          currentBidFor={currentBidFor}
          onCategoryChange={setCategory}
          onQueryChange={setQuery}
          onOpenVehicle={setSelectedVehicle}
          onToggleFavorite={toggleFavorite}
          onSell={() => setTab('sell')}
        />
      ) : null}

      {tab === 'sell' ? (
        <SellTab
          draft={sellDraft}
          draftSaved={draftSaved}
          onUpdate={updateDraft}
          onPreview={previewSellDraft}
          onSaveDraft={saveDraft}
        />
      ) : null}

      {tab === 'activity' ? (
        <ActivityTab
          favorites={favorites}
          myBids={myBids}
          draftSaved={draftSaved}
          onBrowse={() => setTab('buy')}
          onOpenVehicle={setSelectedVehicle}
        />
      ) : null}

      <VehicleDetailModal
        vehicle={selectedVehicle}
        currentBid={selectedVehicle ? currentBidFor(selectedVehicle) : 0}
        isFavorite={Boolean(selectedVehicle && favorites.includes(selectedVehicle.id))}
        onClose={() => setSelectedVehicle(null)}
        onToggleFavorite={() => selectedVehicle && toggleFavorite(selectedVehicle.id)}
        onPlaceBid={placeBid}
      />

      <SellPreviewModal
        visible={sellPreviewVisible}
        draft={sellDraft}
        onClose={() => setSellPreviewVisible(false)}
        onSave={() => {
          setSellPreviewVisible(false);
          saveDraft();
        }}
      />
    </SafeAreaView>
  );
}

function TopTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: 'magnify' | 'tag-outline' | 'gavel';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.topTab, active && styles.topTabActive, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={active ? '#174EA6' : '#75839A'} />
      <Text style={[styles.topTabText, active && styles.topTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BuyTab({
  category,
  query,
  vehicles,
  favorites,
  currentBidFor,
  onCategoryChange,
  onQueryChange,
  onOpenVehicle,
  onToggleFavorite,
  onSell,
}: {
  category: VehicleCategory;
  query: string;
  vehicles: MarketplaceVehicle[];
  favorites: string[];
  currentBidFor: (vehicle: MarketplaceVehicle) => number;
  onCategoryChange: (category: VehicleCategory) => void;
  onQueryChange: (value: string) => void;
  onOpenVehicle: (vehicle: MarketplaceVehicle) => void;
  onToggleFavorite: (id: string) => void;
  onSell: () => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.previewNotice}>
        <View style={styles.previewNoticeIcon}>
          <MaterialCommunityIcons name="eye-outline" size={16} color="#174EA6" />
        </View>
        <View style={styles.previewNoticeTextWrap}>
          <Text style={styles.previewNoticeTitle}>First-draft preview</Text>
          <Text style={styles.previewNoticeText}>Marketplace actions are interactive, but no listing or bid is sent to the backend yet.</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>INSUREIT EXCHANGE</Text>
          <Text style={styles.heroTitle}>Verified commercial vehicles, transparent deals.</Text>
          <Text style={styles.heroCopy}>Browse trucks, tippers, pickups, buses and equipment. Seller contact stays protected until both sides are ready.</Text>
        </View>
        <View style={styles.heroArt}>
          <View style={styles.heroArtCircle}>
            <MaterialCommunityIcons name="truck-outline" size={48} color="#174EA6" />
          </View>
          <View style={styles.heroShield}>
            <MaterialCommunityIcons name="shield-check" size={17} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <Pressable onPress={onSell} style={({ pressed }) => [styles.sellCta, pressed && styles.cardPressed]}>
        <View style={styles.sellCtaIcon}>
          <MaterialCommunityIcons name="tag-outline" size={24} color="#174EA6" />
        </View>
        <View style={styles.sellCtaText}>
          <Text style={styles.sellCtaTitle}>Sell your commercial vehicle</Text>
          <Text style={styles.sellCtaSubtitle}>Create a listing and receive controlled offers from verified buyers.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#174EA6" />
      </Pressable>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#708096" />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search Tata 407, tipper, JCB..."
            placeholderTextColor="#8B98AA"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9AA7B8" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filterButton}>
          <MaterialCommunityIcons name="tune-variant" size={20} color="#174EA6" />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((item) => (
          <Pressable
            key={item}
            onPress={() => onCategoryChange(item)}
            style={({ pressed }) => [
              styles.categoryChip,
              category === item && styles.categoryChipActive,
              pressed && styles.pressed,
            ]}
          >
            {item !== 'All' ? (
              <MaterialCommunityIcons
                name={categoryIcon(item)}
                size={16}
                color={category === item ? '#FFFFFF' : '#35506F'}
              />
            ) : null}
            <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionTitle}>{category === 'All' ? 'Recommended for you' : category}</Text>
          <Text style={styles.sectionMeta}>{vehicles.length} vehicles in this preview</Text>
        </View>
        <View style={styles.locationPill}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color="#174EA6" />
          <Text style={styles.locationPillText}>Madhya Pradesh</Text>
        </View>
      </View>

      <View style={styles.vehicleGrid}>
        {vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            currentBid={currentBidFor(vehicle)}
            favorite={favorites.includes(vehicle.id)}
            onOpen={() => onOpenVehicle(vehicle)}
            onFavorite={() => onToggleFavorite(vehicle.id)}
          />
        ))}
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="truck-outline" size={32} color="#8B98AA" />
          <Text style={styles.emptyTitle}>No vehicles found</Text>
          <Text style={styles.emptyText}>Try a different search term or category.</Text>
        </View>
      ) : null}

      <View style={styles.trustStrip}>
        <TrustPoint icon="account-check-outline" title="Owner verified" />
        <TrustPoint icon="file-document-check-outline" title="Documents checked" />
        <TrustPoint icon="shield-check" title="InsureIT controlled" />
      </View>
    </ScrollView>
  );
}

function VehicleCard({
  vehicle,
  currentBid,
  favorite,
  onOpen,
  onFavorite,
}: {
  vehicle: MarketplaceVehicle;
  currentBid: number;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.vehicleCard, pressed && styles.cardPressed]}>
      <View style={styles.vehicleVisual}>
        <View style={styles.vehicleVisualGlow} />
        <MaterialCommunityIcons name={categoryIcon(vehicle.category)} size={62} color="#174EA6" />
        <View style={styles.vehicleCategoryBadge}>
          <Text style={styles.vehicleCategoryBadgeText}>{vehicle.category.toUpperCase()}</Text>
        </View>
        {vehicle.verified ? (
          <View style={styles.verifiedBadge}>
            <MaterialCommunityIcons name="shield-check" size={12} color="#FFFFFF" />
            <Text style={styles.verifiedBadgeText}>Verified</Text>
          </View>
        ) : (
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>Owner verified</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from saved vehicles' : 'Save vehicle'}
          onPress={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? '#D93B57' : '#35506F'} />
        </Pressable>
      </View>

      <View style={styles.vehicleContent}>
        <Text numberOfLines={1} style={styles.vehicleTitle}>{vehicle.title}</Text>
        <View style={styles.vehicleFacts}>
          <Text style={styles.vehicleFact}>{vehicle.year}</Text>
          <View style={styles.dot} />
          <Text style={styles.vehicleFact}>{formatKm(vehicle.km)}</Text>
          <View style={styles.dot} />
          <Text style={styles.vehicleFact}>{vehicle.fuel}</Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color="#7A889C" />
          <Text style={styles.locationText}>{vehicle.location}</Text>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Asking</Text>
            <Text style={styles.askingPrice}>{formatCompactCurrency(vehicle.askingPrice)}</Text>
          </View>
          <View style={styles.bidBlock}>
            <Text style={styles.priceLabel}>Current bid</Text>
            <Text style={styles.bidPrice}>{formatCompactCurrency(currentBid)}</Text>
          </View>
        </View>

        <View style={styles.bidMetaRow}>
          <View style={styles.bidMeta}>
            <MaterialCommunityIcons name="gavel" size={14} color="#63748B" />
            <Text style={styles.bidMetaText}>{vehicle.bids + (currentBid > vehicle.currentBid ? 1 : 0)} bids</Text>
          </View>
          <View style={styles.bidMeta}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#63748B" />
            <Text style={styles.bidMetaText}>Ends in {vehicle.ending}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function TrustPoint({ icon, title }: { icon: 'account-check-outline' | 'file-document-check-outline' | 'shield-check'; title: string }) {
  return (
    <View style={styles.trustPoint}>
      <View style={styles.trustIcon}>
        <MaterialCommunityIcons name={icon} size={18} color="#174EA6" />
      </View>
      <Text style={styles.trustText}>{title}</Text>
    </View>
  );
}

function SellTab({
  draft,
  draftSaved,
  onUpdate,
  onPreview,
  onSaveDraft,
}: {
  draft: SellDraft;
  draftSaved: boolean;
  onUpdate: <K extends keyof SellDraft>(key: K, value: SellDraft[K]) => void;
  onPreview: () => void;
  onSaveDraft: () => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.sellContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.sellIntro}>
        <View style={styles.sellIntroIcon}>
          <MaterialCommunityIcons name="truck-outline" size={34} color="#174EA6" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sellIntroTitle}>List a vehicle</Text>
          <Text style={styles.sellIntroCopy}>First-draft listing flow for visual approval. No marketplace record is created yet.</Text>
        </View>
      </View>

      <View style={styles.stepRail}>
        <StepBubble number="1" label="Vehicle" active />
        <StepLine />
        <StepBubble number="2" label="Condition" />
        <StepLine />
        <StepBubble number="3" label="Photos" />
        <StepLine />
        <StepBubble number="4" label="Price" />
      </View>

      <View style={styles.formCard}>
        <View style={styles.formSectionHeading}>
          <Text style={styles.formTitle}>Vehicle details</Text>
          <View style={styles.fleetHint}>
            <MaterialCommunityIcons name="link-variant" size={14} color="#174EA6" />
            <Text style={styles.fleetHintText}>Fleet autofill planned</Text>
          </View>
        </View>

        <FormField
          label="Registration number"
          value={draft.registration}
          onChangeText={(value) => onUpdate('registration', value.toUpperCase())}
          placeholder="MP20AB1234"
          autoCapitalize="characters"
        />
        <FormField
          label="Make / model"
          value={draft.makeModel}
          onChangeText={(value) => onUpdate('makeModel', value)}
          placeholder="e.g. Tata 407 Gold SFC"
        />

        <View style={styles.twoColumn}>
          <View style={styles.flex}>
            <FormField
              label="Year"
              value={draft.year}
              onChangeText={(value) => onUpdate('year', value.replace(/\D/g, '').slice(0, 4))}
              placeholder="2021"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <FormField
              label="KM driven"
              value={draft.km}
              onChangeText={(value) => onUpdate('km', value.replace(/\D/g, ''))}
              placeholder="72400"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Vehicle type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sellCategoryRow}>
          {categories.filter((item): item is Exclude<VehicleCategory, 'All'> => item !== 'All').map((item) => (
            <Pressable
              key={item}
              onPress={() => onUpdate('category', item)}
              style={({ pressed }) => [
                styles.sellCategoryChip,
                draft.category === item && styles.sellCategoryChipActive,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name={categoryIcon(item)} size={16} color={draft.category === item ? '#FFFFFF' : '#35506F'} />
              <Text style={[styles.sellCategoryText, draft.category === item && styles.sellCategoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formSectionHeading}>
          <Text style={styles.formTitle}>Guided photos</Text>
          <Text style={styles.optionalLabel}>Preview</Text>
        </View>
        <Text style={styles.formHelper}>The final flow will request consistent angles so buyers can compare vehicles confidently.</Text>
        <View style={styles.photoGrid}>
          {['Front', 'Rear', 'Left side', 'Right side', 'Cabin', 'Odometer'].map((label) => (
            <View key={label} style={styles.photoSlot}>
              <MaterialCommunityIcons name="camera-outline" size={23} color="#58708D" />
              <Text style={styles.photoLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Expected price</Text>
        <Text style={styles.formHelper}>Buyers will see your asking price and can submit controlled bids without seeing your phone number.</Text>
        <FormField
          label="Asking price"
          value={draft.askingPrice}
          onChangeText={(value) => onUpdate('askingPrice', value.replace(/\D/g, ''))}
          placeholder="840000"
          keyboardType="number-pad"
          prefix="₹"
        />
        <View style={styles.sellingModeCard}>
          <View style={styles.sellingModeIcon}>
            <MaterialCommunityIcons name="gavel" size={19} color="#174EA6" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.sellingModeTitle}>Open bidding</Text>
            <Text style={styles.sellingModeText}>Recommended for price discovery. You remain free to accept or reject the best offer.</Text>
          </View>
          <MaterialCommunityIcons name="check-circle" size={20} color="#219653" />
        </View>
      </View>

      <View style={styles.sellerProtection}>
        <MaterialCommunityIcons name="shield-lock-outline" size={21} color="#174EA6" />
        <View style={styles.flex}>
          <Text style={styles.sellerProtectionTitle}>Your contact stays protected</Text>
          <Text style={styles.sellerProtectionText}>Buyers place bids or request contact through InsureIT. Direct phone details are not shown publicly.</Text>
        </View>
      </View>

      <View style={styles.formActions}>
        <Pressable onPress={onSaveDraft} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>{draftSaved ? 'Draft saved' : 'Save draft'}</Text>
        </Pressable>
        <Pressable onPress={onPreview} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
          <Text style={styles.primaryButtonText}>Preview listing</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StepBubble({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return (
    <View style={styles.stepItem}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
        <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

function StepLine() {
  return <View style={styles.stepLine} />;
}

function FormField({
  label,
  prefix,
  ...props
}: TextInputProps & { label: string; prefix?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldShell}>
        {prefix ? <Text style={styles.fieldPrefix}>{prefix}</Text> : null}
        <TextInput
          {...props}
          placeholderTextColor="#98A4B5"
          style={[styles.fieldInput, prefix ? styles.fieldInputWithPrefix : null]}
        />
      </View>
    </View>
  );
}

function ActivityTab({
  favorites,
  myBids,
  draftSaved,
  onBrowse,
  onOpenVehicle,
}: {
  favorites: string[];
  myBids: { vehicle: MarketplaceVehicle; amount: number }[];
  draftSaved: boolean;
  onBrowse: () => void;
  onOpenVehicle: (vehicle: MarketplaceVehicle) => void;
}) {
  const savedVehicles = marketplaceSeed.filter((vehicle) => favorites.includes(vehicle.id));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.activityContent} showsVerticalScrollIndicator={false}>
      <View style={styles.activityHero}>
        <Text style={styles.activityHeroTitle}>My Exchange</Text>
        <Text style={styles.activityHeroCopy}>Keep buying and selling activity in one controlled place.</Text>
        <View style={styles.activityStats}>
          <ActivityStat value={String(savedVehicles.length)} label="Saved" />
          <ActivityStat value={String(myBids.length)} label="My bids" />
          <ActivityStat value={draftSaved ? '1' : '0'} label="Selling" />
        </View>
      </View>

      <ActivitySection title="My bids" subtitle="Demo bids placed in this preview">
        {myBids.length ? (
          myBids.map(({ vehicle, amount }) => (
            <Pressable key={vehicle.id} onPress={() => onOpenVehicle(vehicle)} style={({ pressed }) => [styles.activityRow, pressed && styles.cardPressed]}>
              <View style={styles.activityVehicleIcon}>
                <MaterialCommunityIcons name={categoryIcon(vehicle.category)} size={24} color="#174EA6" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.activityRowTitle}>{vehicle.title}</Text>
                <Text style={styles.activityRowMeta}>{vehicle.location} • {vehicle.ending} left</Text>
              </View>
              <View style={styles.activityAmountBlock}>
                <Text style={styles.activityAmount}>{formatCompactCurrency(amount)}</Text>
                <Text style={styles.activityStatus}>Leading demo bid</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <InlineEmpty icon="gavel" text="You have not placed a demo bid yet." action="Browse vehicles" onPress={onBrowse} />
        )}
      </ActivitySection>

      <ActivitySection title="Saved vehicles" subtitle="Shortlist vehicles before you bid">
        {savedVehicles.length ? (
          savedVehicles.map((vehicle) => (
            <Pressable key={vehicle.id} onPress={() => onOpenVehicle(vehicle)} style={({ pressed }) => [styles.activityRow, pressed && styles.cardPressed]}>
              <View style={styles.activityVehicleIcon}>
                <MaterialCommunityIcons name={categoryIcon(vehicle.category)} size={24} color="#174EA6" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.activityRowTitle}>{vehicle.title}</Text>
                <Text style={styles.activityRowMeta}>{vehicle.year} • {formatKm(vehicle.km)} • {vehicle.location}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#8A98A9" />
            </Pressable>
          ))
        ) : (
          <InlineEmpty icon="heart-outline" text="Save vehicles to compare them later." action="Browse vehicles" onPress={onBrowse} />
        )}
      </ActivitySection>

      <ActivitySection title="Selling" subtitle="Your listings and deal progress">
        {draftSaved ? (
          <View style={styles.sellingDraftRow}>
            <View style={styles.activityVehicleIcon}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={23} color="#174EA6" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.activityRowTitle}>Vehicle listing draft</Text>
              <Text style={styles.activityRowMeta}>Not published • first-draft preview</Text>
            </View>
            <View style={styles.draftBadge}><Text style={styles.draftBadgeText}>DRAFT</Text></View>
          </View>
        ) : (
          <InlineEmpty icon="tag-outline" text="No selling activity yet." action="Create listing" onPress={() => Alert.alert('Open Sell tab', 'Use the Sell tab above to create your first draft listing.')} />
        )}
      </ActivitySection>
    </ScrollView>
  );
}

function ActivityStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.activityStat}>
      <Text style={styles.activityStatValue}>{value}</Text>
      <Text style={styles.activityStatLabel}>{label}</Text>
    </View>
  );
}

function ActivitySection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.activitySection}>
      <Text style={styles.activitySectionTitle}>{title}</Text>
      <Text style={styles.activitySectionSubtitle}>{subtitle}</Text>
      <View style={styles.activitySectionBody}>{children}</View>
    </View>
  );
}

function InlineEmpty({
  icon,
  text,
  action,
  onPress,
}: {
  icon: 'gavel' | 'heart-outline' | 'tag-outline';
  text: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.inlineEmpty}>
      <MaterialCommunityIcons name={icon} size={23} color="#8A98A9" />
      <View style={styles.flex}>
        <Text style={styles.inlineEmptyText}>{text}</Text>
        <Pressable onPress={onPress}><Text style={styles.inlineEmptyAction}>{action}</Text></Pressable>
      </View>
    </View>
  );
}

function VehicleDetailModal({
  vehicle,
  currentBid,
  isFavorite,
  onClose,
  onToggleFavorite,
  onPlaceBid,
}: {
  vehicle: MarketplaceVehicle | null;
  currentBid: number;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onPlaceBid: (vehicle: MarketplaceVehicle, amount: number) => void;
}) {
  const [bidAmount, setBidAmount] = useState(0);

  if (!vehicle) return null;
  const minimumBid = currentBid + 10000;
  const shownBid = bidAmount >= minimumBid ? bidAmount : minimumBid;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.detailSafe} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.detailHeaderButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="chevron-left" size={25} color={palette.navy} />
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Vehicle details</Text>
          <Pressable onPress={onToggleFavorite} style={({ pressed }) => [styles.detailHeaderButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? '#D93B57' : palette.navy} />
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <View style={styles.detailVisual}>
            <View style={styles.detailVisualCircle} />
            <MaterialCommunityIcons name={categoryIcon(vehicle.category)} size={92} color="#174EA6" />
            <View style={styles.detailVisualBadge}>
              <Text style={styles.detailVisualBadgeText}>{vehicle.category}</Text>
            </View>
          </View>

          <View style={styles.detailTitleRow}>
            <View style={styles.flex}>
              <Text style={styles.detailTitle}>{vehicle.title}</Text>
              <Text style={styles.detailMeta}>{vehicle.year} • {formatKm(vehicle.km)} • {vehicle.fuel}</Text>
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#7A889C" />
                <Text style={styles.locationText}>{vehicle.location}</Text>
              </View>
            </View>
            {vehicle.verified ? (
              <View style={styles.detailVerified}>
                <MaterialCommunityIcons name="shield-check" size={16} color="#174EA6" />
                <Text style={styles.detailVerifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.detailPriceCard}>
            <View>
              <Text style={styles.detailPriceLabel}>Seller expectation</Text>
              <Text style={styles.detailAsking}>{formatCompactCurrency(vehicle.askingPrice)}</Text>
            </View>
            <View style={styles.detailPriceDivider} />
            <View>
              <Text style={styles.detailPriceLabel}>Current highest bid</Text>
              <Text style={styles.detailBid}>{formatCompactCurrency(currentBid)}</Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Trust & verification</Text>
            <View style={styles.verificationGrid}>
              <VerificationItem label="Owner verified" active={vehicle.ownerVerified} />
              <VerificationItem label="Documents verified" active={vehicle.documentsVerified} />
              <VerificationItem label="InsureIT inspected" active={vehicle.inspected} />
              <VerificationItem label={vehicle.inspected ? `Vehicle score ${vehicle.score}/100` : 'Inspection pending'} active={vehicle.inspected} />
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Vehicle overview</Text>
            <View style={styles.overviewGrid}>
              <OverviewItem label="Registration" value={vehicle.registration} />
              <OverviewItem label="Ownership" value={vehicle.ownership} />
              <OverviewItem label="Tyres" value={vehicle.tyres} />
              <OverviewItem label="Permit" value={vehicle.permit} />
              <OverviewItem label="Finance" value={vehicle.finance} wide />
            </View>
          </View>

          <View style={styles.controlledContactCard}>
            <MaterialCommunityIcons name="shield-lock-outline" size={23} color="#174EA6" />
            <View style={styles.flex}>
              <Text style={styles.controlledContactTitle}>Controlled seller connection</Text>
              <Text style={styles.controlledContactText}>Seller phone number and exact address stay private. After serious interest, InsureIT can coordinate the next step.</Text>
            </View>
          </View>

          <View style={styles.bidPanel}>
            <View>
              <Text style={styles.bidPanelEyebrow}>PLACE A BID</Text>
              <Text style={styles.bidPanelTitle}>Next minimum {formatCompactCurrency(minimumBid)}</Text>
            </View>
            <View style={styles.bidAdjuster}>
              <Pressable onPress={() => setBidAmount(Math.max(minimumBid, shownBid - 10000))} style={styles.bidAdjustButton}>
                <MaterialCommunityIcons name="minus" size={20} color="#174EA6" />
              </Pressable>
              <Text style={styles.bidAdjustValue}>{formatCompactCurrency(shownBid)}</Text>
              <Pressable onPress={() => setBidAmount(shownBid + 10000)} style={styles.bidAdjustButton}>
                <MaterialCommunityIcons name="plus" size={20} color="#174EA6" />
              </Pressable>
            </View>
            <Pressable
              onPress={() => onPlaceBid(vehicle, shownBid)}
              style={({ pressed }) => [styles.fullPrimaryButton, pressed && styles.primaryButtonPressed]}
            >
              <MaterialCommunityIcons name="gavel" size={18} color="#FFFFFF" />
              <Text style={styles.fullPrimaryButtonText}>Place bid</Text>
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Request received', 'In the production flow, this will create a controlled callback request through InsureIT.')}
              style={({ pressed }) => [styles.fullSecondaryButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="phone-outline" size={18} color="#174EA6" />
              <Text style={styles.fullSecondaryButtonText}>Ask InsureIT / Request callback</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function VerificationItem({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.verificationItem, !active && styles.verificationItemPending]}>
      <MaterialCommunityIcons name={active ? 'check-circle' : 'clock-outline'} size={18} color={active ? '#219653' : '#B98318'} />
      <Text style={styles.verificationItemText}>{label}</Text>
    </View>
  );
}

function OverviewItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.overviewItem, wide && styles.overviewItemWide]}>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
    </View>
  );
}

function SellPreviewModal({
  visible,
  draft,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: SellDraft;
  onClose: () => void;
  onSave: () => void;
}) {
  const price = Number(draft.askingPrice || 0);
  const km = Number(draft.km || 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismissArea} onPress={onClose} />
        <View style={styles.previewSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.previewSheetEyebrow}>LISTING PREVIEW</Text>
          <Text style={styles.previewSheetTitle}>This is what buyers will see</Text>

          <View style={styles.previewVehicleCard}>
            <View style={styles.previewVehicleVisual}>
              <MaterialCommunityIcons name={categoryIcon(draft.category)} size={54} color="#174EA6" />
              <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>OWNER VERIFIED</Text></View>
            </View>
            <Text style={styles.previewVehicleTitle}>{draft.makeModel || 'Commercial vehicle'}</Text>
            <Text style={styles.previewVehicleMeta}>
              {draft.year || 'Year'} • {km ? formatKm(km) : 'KM pending'} • {draft.category}
            </Text>
            <View style={styles.previewVehicleRegistration}>
              <MaterialCommunityIcons name="card-account-details-outline" size={15} color="#687A90" />
              <Text style={styles.previewVehicleRegistrationText}>{draft.registration || 'Registration pending'}</Text>
            </View>
            <View style={styles.cardDivider} />
            <Text style={styles.priceLabel}>Asking price</Text>
            <Text style={styles.previewVehiclePrice}>{price ? formatCompactCurrency(price) : 'Price pending'}</Text>
          </View>

          <View style={styles.previewProtection}>
            <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#174EA6" />
            <Text style={styles.previewProtectionText}>Your phone number is not displayed in the marketplace preview.</Text>
          </View>

          <View style={styles.previewSheetActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable onPress={onSave} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>Save draft</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#F4F8FC' },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },

  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.navy,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.1 },
  headerSubtitle: { marginTop: 2, color: '#BFD0E5', fontSize: 10.5, fontWeight: '700' },

  tabBar: {
    height: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4EAF1',
  },
  topTab: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  topTabActive: { backgroundColor: '#EAF3FF' },
  topTabText: { color: '#75839A', fontSize: 12.5, fontWeight: '800' },
  topTabTextActive: { color: '#174EA6' },

  scrollContent: { padding: 14, paddingBottom: 34 },
  previewNotice: {
    flexDirection: 'row',
    gap: 10,
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#EDF5FF',
    borderWidth: 1,
    borderColor: '#D7E8FB',
    marginBottom: 12,
  },
  previewNoticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  previewNoticeTextWrap: { flex: 1 },
  previewNoticeTitle: { color: '#173B69', fontSize: 12.5, fontWeight: '900' },
  previewNoticeText: { marginTop: 2, color: '#5E7088', fontSize: 11.3, lineHeight: 16, fontWeight: '600' },

  hero: {
    minHeight: 172,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#0D315E',
    marginBottom: 12,
  },
  heroText: { flex: 1, paddingRight: 8 },
  heroEyebrow: { color: '#8FC1FF', fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  heroCopy: { marginTop: 8, color: '#C7D6E8', fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  heroArt: { width: 96, alignItems: 'center', justifyContent: 'center' },
  heroArtCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroShield: {
    position: 'absolute',
    right: 1,
    bottom: 28,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#219653',
    borderWidth: 3,
    borderColor: '#0D315E',
  },

  sellCta: {
    minHeight: 76,
    padding: 13,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE8F2',
    shadowColor: '#0B2B59',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
    marginBottom: 14,
  },
  sellCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FF',
  },
  sellCtaText: { flex: 1 },
  sellCtaTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  sellCtaSubtitle: { marginTop: 3, color: '#6D7D91', fontSize: 10.8, lineHeight: 15, fontWeight: '600' },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBox: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE6F0',
  },
  searchInput: { flex: 1, color: palette.navy, fontSize: 13, fontWeight: '700', paddingVertical: 0 },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE6F0',
  },

  categoryRow: { gap: 7, paddingBottom: 4 },
  categoryChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE6F0',
  },
  categoryChipActive: { backgroundColor: '#174EA6', borderColor: '#174EA6' },
  categoryChipText: { color: '#35506F', fontSize: 11.5, fontWeight: '800' },
  categoryChipTextActive: { color: '#FFFFFF' },

  sectionHeadingRow: {
    marginTop: 17,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' },
  sectionMeta: { marginTop: 2, color: '#7A889C', fontSize: 10.5, fontWeight: '600' },
  locationPill: {
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF3FF',
  },
  locationPillText: { color: '#174EA6', fontSize: 10, fontWeight: '800' },

  vehicleGrid: { gap: 12 },
  vehicleCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#0B2B59',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  vehicleVisual: {
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FF',
    overflow: 'hidden',
  },
  vehicleVisualGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#F8FBFF',
  },
  vehicleCategoryBadge: {
    position: 'absolute',
    left: 11,
    top: 11,
    paddingHorizontal: 9,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(13,49,94,0.90)',
  },
  vehicleCategoryBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  verifiedBadge: {
    position: 'absolute',
    left: 11,
    bottom: 10,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#219653',
  },
  verifiedBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  reviewBadge: {
    position: 'absolute',
    left: 11,
    bottom: 10,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    justifyContent: 'center',
    backgroundColor: '#FFF3D8',
  },
  reviewBadgeText: { color: '#8B6214', fontSize: 9.5, fontWeight: '900' },
  favoriteButton: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  vehicleContent: { padding: 14 },
  vehicleTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  vehicleFacts: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleFact: { color: '#617289', fontSize: 10.8, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#ABB6C5' },
  locationRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: '#7A889C', fontSize: 10.8, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: '#ECF0F4', marginVertical: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceLabel: { color: '#8A97A9', fontSize: 9.8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  askingPrice: { marginTop: 3, color: palette.navy, fontSize: 17, fontWeight: '900' },
  bidBlock: { alignItems: 'flex-end' },
  bidPrice: { marginTop: 3, color: '#219653', fontSize: 16, fontWeight: '900' },
  bidMetaRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  bidMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bidMetaText: { color: '#63748B', fontSize: 10.3, fontWeight: '700' },

  emptyState: {
    marginTop: 8,
    paddingVertical: 30,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  emptyTitle: { marginTop: 7, color: palette.navy, fontSize: 14, fontWeight: '900' },
  emptyText: { marginTop: 3, color: '#7B899C', fontSize: 11, fontWeight: '600' },

  trustStrip: {
    marginTop: 18,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  trustPoint: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  trustIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3FF' },
  trustText: { color: '#53667F', fontSize: 9.5, lineHeight: 12, fontWeight: '800', textAlign: 'center' },

  sellContent: { padding: 14, paddingBottom: 34 },
  sellIntro: {
    padding: 15,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    borderWidth: 1,
    borderColor: '#D7E7FA',
  },
  sellIntroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sellIntroTitle: { color: palette.navy, fontSize: 18, fontWeight: '900' },
  sellIntroCopy: { marginTop: 4, color: '#62758D', fontSize: 11, lineHeight: 16, fontWeight: '600' },

  stepRail: { marginVertical: 18, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4 },
  stepItem: { width: 52, alignItems: 'center' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFD9E5',
  },
  stepCircleActive: { backgroundColor: '#174EA6', borderColor: '#174EA6' },
  stepNumber: { color: '#8391A3', fontSize: 11, fontWeight: '900' },
  stepNumberActive: { color: '#FFFFFF' },
  stepLabel: { marginTop: 5, color: '#8A97A8', fontSize: 8.5, fontWeight: '800' },
  stepLabelActive: { color: '#174EA6' },
  stepLine: { flex: 1, height: 1, marginTop: 14, backgroundColor: '#CFD9E5' },

  formCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  formSectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  formTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  formHelper: { marginTop: 4, color: '#75859A', fontSize: 10.7, lineHeight: 15, fontWeight: '600' },
  fleetHint: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: 13, backgroundColor: '#EAF3FF' },
  fleetHintText: { color: '#174EA6', fontSize: 9.4, fontWeight: '800' },
  optionalLabel: { color: '#8A97A8', fontSize: 9.5, fontWeight: '800' },

  fieldWrap: { marginTop: 13 },
  fieldLabel: { marginBottom: 6, color: '#435875', fontSize: 10.8, fontWeight: '800' },
  fieldShell: {
    minHeight: 46,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DDE5EE',
  },
  fieldPrefix: { paddingLeft: 13, color: palette.navy, fontSize: 15, fontWeight: '900' },
  fieldInput: { flex: 1, minHeight: 44, paddingHorizontal: 13, color: palette.navy, fontSize: 13, fontWeight: '700' },
  fieldInputWithPrefix: { paddingLeft: 6 },
  twoColumn: { flexDirection: 'row', gap: 10 },

  sellCategoryRow: { gap: 7 },
  sellCategoryChip: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DDE5EE',
  },
  sellCategoryChipActive: { backgroundColor: '#174EA6', borderColor: '#174EA6' },
  sellCategoryText: { color: '#35506F', fontSize: 10.7, fontWeight: '800' },
  sellCategoryTextActive: { color: '#FFFFFF' },

  photoGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoSlot: {
    width: '31%',
    aspectRatio: 1.15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D5E2',
  },
  photoLabel: { color: '#63758D', fontSize: 9, fontWeight: '800' },

  sellingModeCard: {
    marginTop: 12,
    padding: 11,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F4F8FD',
    borderWidth: 1,
    borderColor: '#DBE6F1',
  },
  sellingModeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3FF' },
  sellingModeTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  sellingModeText: { marginTop: 2, color: '#6F7F93', fontSize: 9.8, lineHeight: 14, fontWeight: '600' },

  sellerProtection: {
    padding: 13,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EDF7F1',
    borderWidth: 1,
    borderColor: '#D8EBE0',
    marginBottom: 14,
  },
  sellerProtectionTitle: { color: '#205B3A', fontSize: 11.5, fontWeight: '900' },
  sellerProtectionText: { marginTop: 3, color: '#547161', fontSize: 10, lineHeight: 14, fontWeight: '600' },

  formActions: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#174EA6',
  },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9D5E2',
  },
  secondaryButtonText: { color: '#174EA6', fontSize: 12.5, fontWeight: '900' },

  activityContent: { padding: 14, paddingBottom: 34 },
  activityHero: {
    borderRadius: 20,
    padding: 17,
    backgroundColor: '#0D315E',
    marginBottom: 14,
  },
  activityHeroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  activityHeroCopy: { marginTop: 4, color: '#C6D5E7', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  activityStats: { marginTop: 14, flexDirection: 'row', gap: 8 },
  activityStat: { flex: 1, paddingVertical: 9, borderRadius: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  activityStatValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  activityStatLabel: { marginTop: 2, color: '#BFD0E4', fontSize: 9.5, fontWeight: '800' },

  activitySection: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  activitySectionTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' },
  activitySectionSubtitle: { marginTop: 2, color: '#8592A4', fontSize: 9.8, fontWeight: '600' },
  activitySectionBody: { marginTop: 11, gap: 9 },
  activityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sellingDraftRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9 },
  activityVehicleIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3FF' },
  activityRowTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  activityRowMeta: { marginTop: 3, color: '#7D8B9E', fontSize: 9.4, fontWeight: '600' },
  activityAmountBlock: { alignItems: 'flex-end', maxWidth: 104 },
  activityAmount: { color: '#219653', fontSize: 11.5, fontWeight: '900' },
  activityStatus: { marginTop: 2, color: '#7D8B9E', fontSize: 8.3, fontWeight: '700', textAlign: 'right' },
  draftBadge: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center', backgroundColor: '#FFF3D8' },
  draftBadgeText: { color: '#8B6214', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  inlineEmpty: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineEmptyText: { color: '#697A90', fontSize: 10.5, fontWeight: '700' },
  inlineEmptyAction: { marginTop: 4, color: '#174EA6', fontSize: 10.5, fontWeight: '900' },

  detailSafe: { flex: 1, backgroundColor: '#F4F8FC' },
  detailHeader: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4EAF1',
  },
  detailHeaderButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F6FA' },
  detailHeaderTitle: { flex: 1, textAlign: 'center', color: palette.navy, fontSize: 15, fontWeight: '900' },
  detailContent: { padding: 14, paddingBottom: 30 },
  detailVisual: {
    height: 224,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FF',
  },
  detailVisualCircle: { position: 'absolute', width: 245, height: 245, borderRadius: 123, backgroundColor: '#F9FCFF' },
  detailVisualBadge: { position: 'absolute', left: 14, bottom: 14, height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: '#0D315E' },
  detailVisualBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  detailTitleRow: { marginTop: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailTitle: { color: palette.navy, fontSize: 21, fontWeight: '900' },
  detailMeta: { marginTop: 5, color: '#63748B', fontSize: 11, fontWeight: '700' },
  detailVerified: { height: 30, paddingHorizontal: 9, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF3FF' },
  detailVerifiedText: { color: '#174EA6', fontSize: 9.5, fontWeight: '900' },

  detailPriceCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  detailPriceLabel: { color: '#8A97A8', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  detailAsking: { marginTop: 4, color: palette.navy, fontSize: 20, fontWeight: '900' },
  detailBid: { marginTop: 4, color: '#219653', fontSize: 20, fontWeight: '900' },
  detailPriceDivider: { width: 1, height: 42, backgroundColor: '#E1E7ED', marginHorizontal: 18 },

  detailSection: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  detailSectionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  verificationGrid: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  verificationItem: { width: '48%', minHeight: 44, borderRadius: 12, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F1' },
  verificationItemPending: { backgroundColor: '#FFF7E8' },
  verificationItemText: { flex: 1, color: '#40556F', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },

  overviewGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overviewItem: { width: '48%', minHeight: 54, borderRadius: 12, padding: 9, backgroundColor: '#F7F9FC' },
  overviewItemWide: { width: '100%' },
  overviewLabel: { color: '#8A97A8', fontSize: 8.7, fontWeight: '800', textTransform: 'uppercase' },
  overviewValue: { marginTop: 4, color: '#334A67', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },

  controlledContactCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EEF5FF',
    borderWidth: 1,
    borderColor: '#D6E5F8',
  },
  controlledContactTitle: { color: '#173B69', fontSize: 11.5, fontWeight: '900' },
  controlledContactText: { marginTop: 3, color: '#61758E', fontSize: 9.8, lineHeight: 14, fontWeight: '600' },

  bidPanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  bidPanelEyebrow: { color: '#174EA6', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  bidPanelTitle: { marginTop: 3, color: palette.navy, fontSize: 14, fontWeight: '900' },
  bidAdjuster: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#DDE5EE',
  },
  bidAdjustButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bidAdjustValue: { color: palette.navy, fontSize: 18, fontWeight: '900' },
  fullPrimaryButton: { marginTop: 10, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#174EA6' },
  fullPrimaryButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  fullSecondaryButton: { marginTop: 8, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D6E4' },
  fullSecondaryButtonText: { color: '#174EA6', fontSize: 11.5, fontWeight: '900' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,22,40,0.46)' },
  sheetDismissArea: { flex: 1 },
  previewSheet: {
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F4F8FC',
  },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#C5CED9', marginBottom: 13 },
  previewSheetEyebrow: { color: '#174EA6', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  previewSheetTitle: { marginTop: 4, color: palette.navy, fontSize: 18, fontWeight: '900' },
  previewVehicleCard: { marginTop: 12, padding: 13, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE7F0' },
  previewVehicleVisual: { height: 116, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3FF' },
  previewBadge: { position: 'absolute', left: 10, bottom: 10, height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center', backgroundColor: '#219653' },
  previewBadgeText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  previewVehicleTitle: { marginTop: 11, color: palette.navy, fontSize: 15.5, fontWeight: '900' },
  previewVehicleMeta: { marginTop: 4, color: '#68798F', fontSize: 10.5, fontWeight: '700' },
  previewVehicleRegistration: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewVehicleRegistrationText: { color: '#687A90', fontSize: 9.8, fontWeight: '700' },
  previewVehiclePrice: { marginTop: 3, color: palette.navy, fontSize: 18, fontWeight: '900' },
  previewProtection: { marginTop: 10, padding: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF5FF' },
  previewProtectionText: { flex: 1, color: '#5F738D', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  previewSheetActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
});
