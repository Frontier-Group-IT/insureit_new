import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
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
  inspected: boolean;
  score: number;
  registration: string;
  fuel: string;
  ownership: string;
  tyres: string;
  permit: string;
  finance: string;
  image: ImageSourcePropType;
  accent: string;
  tint: string;
  badge: string;
};

type SellDraft = {
  registration: string;
  makeModel: string;
  year: string;
  km: string;
  category: Exclude<VehicleCategory, 'All'>;
  askingPrice: string;
};

const truckBlue = require('../../assets/vehicles/truck-blue.png');
const truckOrange = require('../../assets/vehicles/truck-orange.png');
const truckWhite = require('../../assets/vehicles/truck-white.png');
const busSketch = require('../../assets/vehicles/bus sketch.png');
const jcbSketch = require('../../assets/vehicles/jcb sketch.png');
const brandedTruck = require('../../assets/vehicles/insureit-branded-truck.webp');

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
    inspected: true,
    score: 86,
    registration: 'MP20•••7421',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '72% life',
    permit: 'National permit',
    finance: 'No active finance',
    image: truckBlue,
    accent: '#5B5FF9',
    tint: '#ECECFF',
    badge: 'HOT DEAL',
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
    inspected: true,
    score: 82,
    registration: 'MP21•••3894',
    fuel: 'Diesel',
    ownership: '2nd owner',
    tyres: '64% life',
    permit: 'State permit',
    finance: 'Hypothecation closure in progress',
    image: truckOrange,
    accent: '#F48A2C',
    tint: '#FFF0E3',
    badge: 'LIVE',
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
    inspected: false,
    score: 0,
    registration: 'MP34•••1286',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '79% life',
    permit: 'National permit',
    finance: 'No active finance',
    image: truckWhite,
    accent: '#2C7BE5',
    tint: '#EAF3FF',
    badge: 'NEW',
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
    verified: true,
    inspected: false,
    score: 0,
    registration: 'MP22•••9132',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '84% life',
    permit: 'State permit',
    finance: 'Finance details pending',
    image: brandedTruck,
    accent: '#16A67A',
    tint: '#E8F8F2',
    badge: 'VALUE PICK',
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
    inspected: true,
    score: 78,
    registration: 'MP49•••6024',
    fuel: 'Diesel',
    ownership: '2nd owner',
    tyres: '58% life',
    permit: 'Stage carriage',
    finance: 'No active finance',
    image: busSketch,
    accent: '#AD68E8',
    tint: '#F3E9FB',
    badge: 'VERIFIED',
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
    inspected: true,
    score: 84,
    registration: 'Equipment • serial masked',
    fuel: 'Diesel',
    ownership: '1st owner',
    tyres: '68% life',
    permit: 'Not applicable',
    finance: 'No active finance',
    image: jcbSketch,
    accent: '#D6A100',
    tint: '#FFF8D8',
    badge: 'INSPECTED',
  },
];

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatCompactCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return formatCurrency(value);
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

export default function ExchangeMarketplaceScreen() {
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
    const normalized = query.trim().toLowerCase();
    return marketplaceSeed.filter((vehicle) => {
      const categoryMatch = category === 'All' || vehicle.category === category;
      const queryMatch =
        !normalized ||
        vehicle.title.toLowerCase().includes(normalized) ||
        vehicle.location.toLowerCase().includes(normalized) ||
        vehicle.category.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  const myBids = useMemo(
    () =>
      marketplaceSeed
        .filter((vehicle) => bidOverrides[vehicle.id])
        .map((vehicle) => ({ vehicle, amount: bidOverrides[vehicle.id] })),
    [bidOverrides],
  );

  function currentBidFor(vehicle: MarketplaceVehicle) {
    return Math.max(vehicle.currentBid, bidOverrides[vehicle.id] ?? 0);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function placeBid(vehicle: MarketplaceVehicle, amount: number) {
    const minimum = currentBidFor(vehicle) + 10000;
    if (amount < minimum) {
      Alert.alert('Increase your bid', `The next bid starts at ${formatCompactCurrency(minimum)}.`);
      return;
    }

    Alert.alert(
      'Confirm your bid',
      `${formatCompactCurrency(amount)} for ${vehicle.title}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setBidOverrides((current) => ({ ...current, [vehicle.id]: amount }));
            Alert.alert('Bid placed', 'Your bid is now leading.');
          },
        },
      ],
    );
  }

  function updateDraft<K extends keyof SellDraft>(key: K, value: SellDraft[K]) {
    setSellDraft((current) => ({ ...current, [key]: value }));
  }

  function previewListing() {
    if (!sellDraft.registration.trim() || !sellDraft.makeModel.trim() || !sellDraft.askingPrice.trim()) {
      Alert.alert('Complete vehicle details', 'Add registration number, make/model and expected price to continue.');
      return;
    }
    setSellPreviewVisible(true);
  }

  function saveDraft() {
    setDraftSaved(true);
    Alert.alert('Saved', 'Your vehicle listing has been saved.');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.shell}>
        <PremiumHeader
          tab={tab}
          onBack={() => router.replace('/customer/home')}
          onActivity={() => setTab('activity')}
        />

        <View style={styles.navBar}>
          <NavTab label="Explore" icon="compass-outline" active={tab === 'buy'} onPress={() => setTab('buy')} />
          <NavTab label="Sell" icon="sale" active={tab === 'sell'} onPress={() => setTab('sell')} />
          <NavTab label="My Exchange" icon="gavel" active={tab === 'activity'} onPress={() => setTab('activity')} />
        </View>

        {tab === 'buy' ? (
          <BuyExperience
            query={query}
            category={category}
            vehicles={filteredVehicles}
            favorites={favorites}
            currentBidFor={currentBidFor}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onOpenVehicle={setSelectedVehicle}
            onFavorite={toggleFavorite}
            onSell={() => setTab('sell')}
          />
        ) : null}

        {tab === 'sell' ? (
          <SellExperience
            draft={sellDraft}
            draftSaved={draftSaved}
            onUpdate={updateDraft}
            onPreview={previewListing}
            onSave={saveDraft}
          />
        ) : null}

        {tab === 'activity' ? (
          <ActivityExperience
            favorites={favorites}
            myBids={myBids}
            draftSaved={draftSaved}
            onBrowse={() => setTab('buy')}
            onSell={() => setTab('sell')}
            onOpenVehicle={setSelectedVehicle}
          />
        ) : null}
      </View>

      <VehicleDetailModal
        vehicle={selectedVehicle}
        currentBid={selectedVehicle ? currentBidFor(selectedVehicle) : 0}
        isFavorite={Boolean(selectedVehicle && favorites.includes(selectedVehicle.id))}
        onClose={() => setSelectedVehicle(null)}
        onFavorite={() => selectedVehicle && toggleFavorite(selectedVehicle.id)}
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

function PremiumHeader({
  tab,
  onBack,
  onActivity,
}: {
  tab: ExchangeTab;
  onBack: () => void;
  onActivity: () => void;
}) {
  const title = tab === 'sell' ? 'Sell with confidence' : tab === 'activity' ? 'My Exchange' : 'Exchange';
  const subtitle = tab === 'sell' ? 'Get the market working for you' : tab === 'activity' ? 'Track your deals in one place' : 'Commercial vehicles. Curated better.';

  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="arrow-left" size={21} color="#FFFFFF" />
      </Pressable>

      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>

      <Pressable onPress={onActivity} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="heart-outline" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function NavTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: 'compass-outline' | 'sale' | 'gavel';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.navTab, active && styles.navTabActive, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={active ? '#0B1320' : '#7A8698'} />
      <Text style={[styles.navTabText, active && styles.navTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BuyExperience({
  query,
  category,
  vehicles,
  favorites,
  currentBidFor,
  onQueryChange,
  onCategoryChange,
  onOpenVehicle,
  onFavorite,
  onSell,
}: {
  query: string;
  category: VehicleCategory;
  vehicles: MarketplaceVehicle[];
  favorites: string[];
  currentBidFor: (vehicle: MarketplaceVehicle) => number;
  onQueryChange: (value: string) => void;
  onCategoryChange: (category: VehicleCategory) => void;
  onOpenVehicle: (vehicle: MarketplaceVehicle) => void;
  onFavorite: (id: string) => void;
  onSell: () => void;
}) {
  const featured = marketplaceSeed.slice(0, 3);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.buyContent} showsVerticalScrollIndicator={false}>
      <View style={styles.discoveryHero}>
        <View style={styles.heroOrbA} />
        <View style={styles.heroOrbB} />

        <View style={styles.discoveryTopline}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE MARKET</Text>
          </View>
          <View style={styles.marketMetric}>
            <Text style={styles.marketMetricValue}>86</Text>
            <Text style={styles.marketMetricLabel}>verified vehicles</Text>
          </View>
        </View>

        <Text style={styles.discoveryTitle}>Find the machine that moves your business.</Text>
        <Text style={styles.discoverySubtitle}>Verified commercial vehicles, live market pricing and managed transactions.</Text>

        <View style={styles.heroSearch}>
          <MaterialCommunityIcons name="magnify" size={20} color="#59657A" />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search make, model, city or category"
            placeholderTextColor="#8B95A6"
            style={styles.heroSearchInput}
          />
          {query ? (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9EA7B7" />
            </Pressable>
          ) : (
            <View style={styles.filterKey}>
              <MaterialCommunityIcons name="tune-variant" size={15} color="#0B1320" />
            </View>
          )}
        </View>
      </View>

      <View style={styles.quickStrip}>
        <QuickValue icon="shield-check" label="Verified" value="InsureIT checked" />
        <QuickDivider />
        <QuickValue icon="chart-line" label="Market driven" value="Live bidding" />
        <QuickDivider />
        <QuickValue icon="account-lock-outline" label="Private" value="Managed connect" />
      </View>

      <SectionHeading title="Browse by category" action="View all" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
        {categories.map((item) => (
          <Pressable
            key={item}
            onPress={() => onCategoryChange(item)}
            style={({ pressed }) => [
              styles.categoryCard,
              category === item && styles.categoryCardActive,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.categoryIconBox, category === item && styles.categoryIconBoxActive]}>
              <MaterialCommunityIcons
                name={item === 'All' ? 'apps' : categoryIcon(item)}
                size={21}
                color={category === item ? '#FFFFFF' : '#5B5FF9'}
              />
            </View>
            <Text style={[styles.categoryCardText, category === item && styles.categoryCardTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeading title="Featured now" action="Live inventory" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRail}>
        {featured.map((vehicle) => (
          <FeaturedCard
            key={vehicle.id}
            vehicle={vehicle}
            currentBid={currentBidFor(vehicle)}
            favorite={favorites.includes(vehicle.id)}
            onOpen={() => onOpenVehicle(vehicle)}
            onFavorite={() => onFavorite(vehicle.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.sellBanner}>
        <View style={styles.sellBannerIcon}>
          <MaterialCommunityIcons name="cash-multiple" size={25} color="#0B1320" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sellBannerEyebrow}>SELL SMARTER</Text>
          <Text style={styles.sellBannerTitle}>Let verified buyers compete for your vehicle.</Text>
          <Text style={styles.sellBannerCopy}>List once. Compare offers. Stay in control.</Text>
        </View>
        <Pressable onPress={onSell} style={({ pressed }) => [styles.sellBannerButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-top-right" size={18} color="#0B1320" />
        </Pressable>
      </View>

      <SectionHeading
        title={category === 'All' ? 'All vehicles' : category}
        action={`${vehicles.length} results`}
      />

      <View style={styles.inventoryList}>
        {vehicles.map((vehicle) => (
          <InventoryCard
            key={vehicle.id}
            vehicle={vehicle}
            currentBid={currentBidFor(vehicle)}
            favorite={favorites.includes(vehicle.id)}
            onOpen={() => onOpenVehicle(vehicle)}
            onFavorite={() => onFavorite(vehicle.id)}
          />
        ))}
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="magnify" size={28} color="#59657A" />
          </View>
          <Text style={styles.emptyTitle}>No exact matches</Text>
          <Text style={styles.emptyCopy}>Try another model, category or location.</Text>
        </View>
      ) : null}

      <View style={styles.promiseCard}>
        <Text style={styles.promiseEyebrow}>THE INSUREIT STANDARD</Text>
        <Text style={styles.promiseTitle}>More confidence in every kilometre.</Text>
        <View style={styles.promiseGrid}>
          <PromiseItem icon="account-check-outline" title="Verified seller" />
          <PromiseItem icon="clipboard-check-outline" title="Condition insight" />
          <PromiseItem icon="file-document-check-outline" title="Document support" />
          <PromiseItem icon="shield-lock-outline" title="Managed transaction" />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickValue({
  icon,
  label,
  value,
}: {
  icon: 'shield-check' | 'chart-line' | 'account-lock-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.quickValue}>
      <MaterialCommunityIcons name={icon} size={17} color="#5B5FF9" />
      <View>
        <Text style={styles.quickValueLabel}>{label}</Text>
        <Text style={styles.quickValueText}>{value}</Text>
      </View>
    </View>
  );
}

function QuickDivider() {
  return <View style={styles.quickDivider} />;
}

function SectionHeading({ title, action }: { title: string; action: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionHeadingTitle}>{title}</Text>
      <Text style={styles.sectionHeadingAction}>{action}</Text>
    </View>
  );
}

function FeaturedCard({
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
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.featuredCard, { backgroundColor: vehicle.tint }, pressed && styles.cardPressed]}>
      <View style={styles.featuredCardTop}>
        <View style={[styles.signalBadge, { backgroundColor: vehicle.accent }]}>
          <Text style={styles.signalBadgeText}>{vehicle.badge}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          style={({ pressed }) => [styles.floatingFavorite, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={19} color={favorite ? '#E04361' : '#263245'} />
        </Pressable>
      </View>

      <View style={styles.featuredImageWrap}>
        <Image source={vehicle.image} resizeMode="contain" style={styles.featuredImage} />
      </View>

      <View style={styles.featuredBody}>
        <Text numberOfLines={1} style={styles.featuredTitle}>{vehicle.title}</Text>
        <Text style={styles.featuredMeta}>{vehicle.year} • {formatKm(vehicle.km)} • {vehicle.location}</Text>

        <View style={styles.featuredPriceRow}>
          <View>
            <Text style={styles.priceOverline}>CURRENT BID</Text>
            <Text style={styles.featuredPrice}>{formatCompactCurrency(currentBid)}</Text>
          </View>
          <View style={styles.featuredBidCount}>
            <MaterialCommunityIcons name="gavel" size={14} color="#59657A" />
            <Text style={styles.featuredBidCountText}>{vehicle.bids} bids</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function InventoryCard({
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
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.inventoryCard, pressed && styles.cardPressed]}>
      <View style={[styles.inventoryImagePane, { backgroundColor: vehicle.tint }]}>
        <Image source={vehicle.image} resizeMode="contain" style={styles.inventoryImage} />
        {vehicle.inspected ? (
          <View style={styles.scoreBadge}>
            <MaterialCommunityIcons name="shield-check" size={12} color="#FFFFFF" />
            <Text style={styles.scoreBadgeText}>{vehicle.score}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.inventoryBody}>
        <View style={styles.inventoryTitleRow}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.inventoryTitle}>{vehicle.title}</Text>
            <Text style={styles.inventoryMeta}>{vehicle.year} • {formatKm(vehicle.km)}</Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onFavorite();
            }}
            hitSlop={8}
          >
            <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={19} color={favorite ? '#E04361' : '#9AA3B3'} />
          </Pressable>
        </View>

        <View style={styles.inventoryLocation}>
          <MaterialCommunityIcons name="map-marker-outline" size={13} color="#7A8698" />
          <Text style={styles.inventoryLocationText}>{vehicle.location}</Text>
        </View>

        <View style={styles.inventoryRule} />

        <View style={styles.inventoryBottom}>
          <View>
            <Text style={styles.priceOverline}>ASKING</Text>
            <Text style={styles.inventoryAsking}>{formatCompactCurrency(vehicle.askingPrice)}</Text>
          </View>
          <View style={styles.inventoryBidBlock}>
            <Text style={styles.inventoryLive}>LIVE BID</Text>
            <Text style={styles.inventoryBid}>{formatCompactCurrency(currentBid)}</Text>
            <Text style={styles.inventoryEnd}>{vehicle.ending} left</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PromiseItem({
  icon,
  title,
}: {
  icon: 'account-check-outline' | 'clipboard-check-outline' | 'file-document-check-outline' | 'shield-lock-outline';
  title: string;
}) {
  return (
    <View style={styles.promiseItem}>
      <View style={styles.promiseIcon}>
        <MaterialCommunityIcons name={icon} size={19} color="#FFFFFF" />
      </View>
      <Text style={styles.promiseItemText}>{title}</Text>
    </View>
  );
}

function SellExperience({
  draft,
  draftSaved,
  onUpdate,
  onPreview,
  onSave,
}: {
  draft: SellDraft;
  draftSaved: boolean;
  onUpdate: <K extends keyof SellDraft>(key: K, value: SellDraft[K]) => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.sellContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.sellHero}>
        <View style={styles.sellHeroGlow} />
        <View style={styles.sellHeroCopy}>
          <Text style={styles.sellHeroEyebrow}>SELL ON EXCHANGE</Text>
          <Text style={styles.sellHeroTitle}>Your vehicle. The right buyers. A better price.</Text>
          <Text style={styles.sellHeroSubtitle}>Create your listing in minutes and let qualified buyers compete.</Text>
        </View>
        <Image source={truckOrange} resizeMode="contain" style={styles.sellHeroImage} />
      </View>

      <View style={styles.sellBenefits}>
        <SellBenefit icon="account-group-outline" title="Verified buyers" />
        <SellBenefit icon="gavel" title="Live offers" />
        <SellBenefit icon="shield-lock-outline" title="Private contact" />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Create your listing</Text>
          <Text style={styles.progressMeta}>Step 1 of 4</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelActive}>Vehicle</Text>
          <Text style={styles.progressLabel}>Condition</Text>
          <Text style={styles.progressLabel}>Photos</Text>
          <Text style={styles.progressLabel}>Price</Text>
        </View>
      </View>

      <View style={styles.sellFormCard}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>Vehicle identity</Text>
            <Text style={styles.formSubtitle}>Start with the basic details</Text>
          </View>
          <View style={styles.autoFillChip}>
            <MaterialCommunityIcons name="auto-fix" size={14} color="#5B5FF9" />
            <Text style={styles.autoFillChipText}>Smart fill</Text>
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
          placeholder="Tata 407 Gold SFC"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sellCategoryRail}>
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
              <MaterialCommunityIcons name={categoryIcon(item)} size={16} color={draft.category === item ? '#FFFFFF' : '#48566C'} />
              <Text style={[styles.sellCategoryText, draft.category === item && styles.sellCategoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sellFormCard}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>Show it honestly</Text>
            <Text style={styles.formSubtitle}>Clear photos build buyer confidence</Text>
          </View>
          <MaterialCommunityIcons name="camera-outline" size={20} color="#5B5FF9" />
        </View>

        <View style={styles.photoGrid}>
          {['Front', 'Rear', 'Left', 'Right', 'Cabin', 'Odometer'].map((label, index) => (
            <View key={label} style={[styles.photoSlot, index === 0 && styles.photoSlotPrimary]}>
              <View style={styles.photoIcon}>
                <MaterialCommunityIcons name="camera-plus-outline" size={20} color={index === 0 ? '#FFFFFF' : '#59657A'} />
              </View>
              <Text style={[styles.photoLabel, index === 0 && styles.photoLabelPrimary]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sellFormCard}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>Price strategy</Text>
            <Text style={styles.formSubtitle}>Set your expectation. Let the market respond.</Text>
          </View>
          <MaterialCommunityIcons name="chart-line" size={21} color="#16A67A" />
        </View>

        <FormField
          label="Expected price"
          value={draft.askingPrice}
          onChangeText={(value) => onUpdate('askingPrice', value.replace(/\D/g, ''))}
          placeholder="840000"
          keyboardType="number-pad"
          prefix="₹"
        />

        <View style={styles.biddingChoice}>
          <View style={styles.biddingChoiceIcon}>
            <MaterialCommunityIcons name="gavel" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.biddingChoiceTitle}>Open bidding</Text>
            <Text style={styles.biddingChoiceCopy}>Receive competing offers while you keep final approval.</Text>
          </View>
          <MaterialCommunityIcons name="check-circle" size={20} color="#16A67A" />
        </View>
      </View>

      <View style={styles.sellerShield}>
        <View style={styles.sellerShieldIcon}>
          <MaterialCommunityIcons name="shield-lock" size={23} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sellerShieldTitle}>You stay in control</Text>
          <Text style={styles.sellerShieldCopy}>Your phone number stays private until a qualified connection is approved through InsureIT.</Text>
        </View>
      </View>

      <View style={styles.sellActions}>
        <Pressable onPress={onSave} style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name={draftSaved ? 'check' : 'bookmark-outline'} size={17} color="#0B1320" />
          <Text style={styles.softButtonText}>{draftSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>

        <Pressable onPress={onPreview} style={({ pressed }) => [styles.darkButton, pressed && styles.darkButtonPressed]}>
          <Text style={styles.darkButtonText}>Preview listing</Text>
          <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SellBenefit({
  icon,
  title,
}: {
  icon: 'account-group-outline' | 'gavel' | 'shield-lock-outline';
  title: string;
}) {
  return (
    <View style={styles.sellBenefit}>
      <MaterialCommunityIcons name={icon} size={18} color="#5B5FF9" />
      <Text style={styles.sellBenefitText}>{title}</Text>
    </View>
  );
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
        <TextInput {...props} placeholderTextColor="#A0A9B8" style={[styles.fieldInput, prefix ? styles.fieldInputWithPrefix : null]} />
      </View>
    </View>
  );
}

function ActivityExperience({
  favorites,
  myBids,
  draftSaved,
  onBrowse,
  onSell,
  onOpenVehicle,
}: {
  favorites: string[];
  myBids: { vehicle: MarketplaceVehicle; amount: number }[];
  draftSaved: boolean;
  onBrowse: () => void;
  onSell: () => void;
  onOpenVehicle: (vehicle: MarketplaceVehicle) => void;
}) {
  const savedVehicles = marketplaceSeed.filter((vehicle) => favorites.includes(vehicle.id));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.activityContent} showsVerticalScrollIndicator={false}>
      <View style={styles.activityHero}>
        <View>
          <Text style={styles.activityEyebrow}>YOUR MARKETPLACE</Text>
          <Text style={styles.activityTitle}>Everything in motion.</Text>
          <Text style={styles.activitySubtitle}>Saved vehicles, bids and selling activity — one clear view.</Text>
        </View>
        <View style={styles.activityStatRow}>
          <ActivityStat value={String(savedVehicles.length)} label="Saved" />
          <ActivityStat value={String(myBids.length)} label="Bids" />
          <ActivityStat value={draftSaved ? '1' : '0'} label="Listings" />
        </View>
      </View>

      <ActivitySection
        title="Live bids"
        subtitle="Your active purchase activity"
        empty={!myBids.length}
        emptyIcon="gavel"
        emptyText="No active bids yet"
        emptyAction="Explore vehicles"
        onEmptyAction={onBrowse}
      >
        {myBids.map(({ vehicle, amount }) => (
          <Pressable key={vehicle.id} onPress={() => onOpenVehicle(vehicle)} style={({ pressed }) => [styles.activityVehicleRow, pressed && styles.cardPressed]}>
            <View style={[styles.activityThumb, { backgroundColor: vehicle.tint }]}>
              <Image source={vehicle.image} resizeMode="contain" style={styles.activityThumbImage} />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.activityVehicleTitle}>{vehicle.title}</Text>
              <Text style={styles.activityVehicleMeta}>{vehicle.location} • {vehicle.ending} left</Text>
            </View>
            <View style={styles.activityAmountWrap}>
              <Text style={styles.activityAmount}>{formatCompactCurrency(amount)}</Text>
              <View style={styles.leadingPill}><Text style={styles.leadingPillText}>LEADING</Text></View>
            </View>
          </Pressable>
        ))}
      </ActivitySection>

      <ActivitySection
        title="Saved vehicles"
        subtitle="Shortlist and compare"
        empty={!savedVehicles.length}
        emptyIcon="heart-outline"
        emptyText="Save vehicles you want to revisit"
        emptyAction="Browse inventory"
        onEmptyAction={onBrowse}
      >
        {savedVehicles.map((vehicle) => (
          <Pressable key={vehicle.id} onPress={() => onOpenVehicle(vehicle)} style={({ pressed }) => [styles.activityVehicleRow, pressed && styles.cardPressed]}>
            <View style={[styles.activityThumb, { backgroundColor: vehicle.tint }]}>
              <Image source={vehicle.image} resizeMode="contain" style={styles.activityThumbImage} />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.activityVehicleTitle}>{vehicle.title}</Text>
              <Text style={styles.activityVehicleMeta}>{vehicle.year} • {formatKm(vehicle.km)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color="#A0A9B8" />
          </Pressable>
        ))}
      </ActivitySection>

      <ActivitySection
        title="Selling"
        subtitle="Your listings and offers"
        empty={!draftSaved}
        emptyIcon="sale"
        emptyText="Ready to sell your vehicle?"
        emptyAction="Create a listing"
        onEmptyAction={onSell}
      >
        {draftSaved ? (
          <Pressable onPress={onSell} style={({ pressed }) => [styles.activityVehicleRow, pressed && styles.cardPressed]}>
            <View style={[styles.activityThumb, { backgroundColor: '#ECECFF' }]}>
              <Image source={truckBlue} resizeMode="contain" style={styles.activityThumbImage} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.activityVehicleTitle}>Vehicle listing</Text>
              <Text style={styles.activityVehicleMeta}>Saved • Continue when ready</Text>
            </View>
            <View style={styles.savedPill}><Text style={styles.savedPillText}>SAVED</Text></View>
          </Pressable>
        ) : null}
      </ActivitySection>

      <View style={styles.marketSupport}>
        <View style={styles.marketSupportIcon}>
          <MaterialCommunityIcons name="headset" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.marketSupportTitle}>Need help with a deal?</Text>
          <Text style={styles.marketSupportCopy}>Our Exchange team can support inspection, paperwork and buyer-seller coordination.</Text>
        </View>
        <MaterialCommunityIcons name="arrow-top-right" size={19} color="#FFFFFF" />
      </View>
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

function ActivitySection({
  title,
  subtitle,
  empty,
  emptyIcon,
  emptyText,
  emptyAction,
  onEmptyAction,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyIcon: 'gavel' | 'heart-outline' | 'sale';
  emptyText: string;
  emptyAction: string;
  onEmptyAction: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.activitySection}>
      <View style={styles.activitySectionHeader}>
        <View>
          <Text style={styles.activitySectionTitle}>{title}</Text>
          <Text style={styles.activitySectionSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {empty ? (
        <View style={styles.activityEmpty}>
          <View style={styles.activityEmptyIcon}>
            <MaterialCommunityIcons name={emptyIcon} size={22} color="#5B5FF9" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.activityEmptyText}>{emptyText}</Text>
            <Pressable onPress={onEmptyAction}><Text style={styles.activityEmptyAction}>{emptyAction}</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.activityRows}>{children}</View>
      )}
    </View>
  );
}

function VehicleDetailModal({
  vehicle,
  currentBid,
  isFavorite,
  onClose,
  onFavorite,
  onPlaceBid,
}: {
  vehicle: MarketplaceVehicle | null;
  currentBid: number;
  isFavorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
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
          <Pressable onPress={onClose} style={({ pressed }) => [styles.detailHeaderAction, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="arrow-left" size={21} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Vehicle detail</Text>
          <Pressable onPress={onFavorite} style={({ pressed }) => [styles.detailHeaderAction, pressed && styles.pressed]}>
            <MaterialCommunityIcons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#FF6A82' : '#FFFFFF'} />
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.detailHero, { backgroundColor: vehicle.tint }]}>
            <View style={[styles.detailAccent, { backgroundColor: vehicle.accent }]} />
            <View style={styles.detailHeroBadge}>
              <MaterialCommunityIcons name="shield-check" size={13} color="#FFFFFF" />
              <Text style={styles.detailHeroBadgeText}>{vehicle.verified ? 'VERIFIED' : 'LISTED'}</Text>
            </View>
            <Image source={vehicle.image} resizeMode="contain" style={styles.detailHeroImage} />
            {vehicle.inspected ? (
              <View style={styles.detailScore}>
                <Text style={styles.detailScoreValue}>{vehicle.score}</Text>
                <Text style={styles.detailScoreLabel}>INSUREIT SCORE</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.detailIntro}>
            <Text style={styles.detailTitle}>{vehicle.title}</Text>
            <Text style={styles.detailMeta}>{vehicle.year} • {formatKm(vehicle.km)} • {vehicle.fuel} • {vehicle.ownership}</Text>
            <View style={styles.detailLocation}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color="#788497" />
              <Text style={styles.detailLocationText}>{vehicle.location}</Text>
            </View>
          </View>

          <View style={styles.marketPriceCard}>
            <View style={styles.marketPriceColumn}>
              <Text style={styles.priceOverline}>ASKING PRICE</Text>
              <Text style={styles.marketAsking}>{formatCompactCurrency(vehicle.askingPrice)}</Text>
            </View>
            <View style={styles.marketPriceLine} />
            <View style={styles.marketPriceColumn}>
              <Text style={styles.livePriceOverline}>LIVE BID</Text>
              <Text style={styles.marketBid}>{formatCompactCurrency(currentBid)}</Text>
              <Text style={styles.marketBidMeta}>{vehicle.bids} bids • {vehicle.ending} left</Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionEyebrow}>CONFIDENCE</Text>
            <Text style={styles.detailSectionTitle}>What we know</Text>
            <View style={styles.confidenceGrid}>
              <ConfidenceItem icon="account-check-outline" title="Seller" value="Verified" positive />
              <ConfidenceItem icon="file-document-check-outline" title="Documents" value="Checked" positive />
              <ConfidenceItem icon="clipboard-check-outline" title="Inspection" value={vehicle.inspected ? 'Completed' : 'Available'} positive={vehicle.inspected} />
              <ConfidenceItem icon="shield-car" title="Vehicle score" value={vehicle.inspected ? `${vehicle.score}/100` : 'Pending'} positive={vehicle.inspected} />
            </View>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionEyebrow}>OVERVIEW</Text>
            <Text style={styles.detailSectionTitle}>Key details</Text>
            <View style={styles.overviewList}>
              <OverviewRow label="Registration" value={vehicle.registration} />
              <OverviewRow label="Ownership" value={vehicle.ownership} />
              <OverviewRow label="Tyres" value={vehicle.tyres} />
              <OverviewRow label="Permit" value={vehicle.permit} />
              <OverviewRow label="Finance" value={vehicle.finance} last />
            </View>
          </View>

          <View style={styles.privateConnect}>
            <View style={styles.privateConnectIcon}>
              <MaterialCommunityIcons name="account-lock-outline" size={23} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.privateConnectTitle}>Private by design</Text>
              <Text style={styles.privateConnectCopy}>Seller contact stays protected. InsureIT coordinates the connection once both sides are ready.</Text>
            </View>
          </View>

          <View style={styles.bidPanel}>
            <View style={styles.bidPanelHeader}>
              <View>
                <Text style={styles.detailSectionEyebrow}>YOUR OFFER</Text>
                <Text style={styles.bidPanelTitle}>Bid with confidence</Text>
              </View>
              <Text style={styles.bidMinimum}>Min. {formatCompactCurrency(minimumBid)}</Text>
            </View>

            <View style={styles.bidAdjuster}>
              <Pressable onPress={() => setBidAmount(Math.max(minimumBid, shownBid - 10000))} style={styles.bidAdjustAction}>
                <MaterialCommunityIcons name="minus" size={20} color="#0B1320" />
              </Pressable>
              <View style={styles.bidAdjustCenter}>
                <Text style={styles.bidAdjustLabel}>YOUR BID</Text>
                <Text style={styles.bidAdjustValue}>{formatCompactCurrency(shownBid)}</Text>
              </View>
              <Pressable onPress={() => setBidAmount(shownBid + 10000)} style={styles.bidAdjustAction}>
                <MaterialCommunityIcons name="plus" size={20} color="#0B1320" />
              </Pressable>
            </View>

            <Pressable onPress={() => onPlaceBid(vehicle, shownBid)} style={({ pressed }) => [styles.detailPrimaryButton, pressed && styles.darkButtonPressed]}>
              <MaterialCommunityIcons name="gavel" size={18} color="#FFFFFF" />
              <Text style={styles.detailPrimaryButtonText}>Place bid</Text>
            </Pressable>

            <Pressable
              onPress={() => Alert.alert('Request sent', 'An Exchange advisor will coordinate the next step with the seller.')}
              style={({ pressed }) => [styles.detailSecondaryButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="phone-in-talk-outline" size={17} color="#0B1320" />
              <Text style={styles.detailSecondaryButtonText}>Request a managed callback</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ConfidenceItem({
  icon,
  title,
  value,
  positive,
}: {
  icon: 'account-check-outline' | 'file-document-check-outline' | 'clipboard-check-outline' | 'shield-car';
  title: string;
  value: string;
  positive: boolean;
}) {
  return (
    <View style={styles.confidenceItem}>
      <View style={[styles.confidenceIcon, positive ? styles.confidenceIconPositive : styles.confidenceIconNeutral]}>
        <MaterialCommunityIcons name={icon} size={18} color={positive ? '#0B6E53' : '#93620C'} />
      </View>
      <Text style={styles.confidenceTitle}>{title}</Text>
      <Text style={styles.confidenceValue}>{value}</Text>
    </View>
  );
}

function OverviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.overviewRow, last && styles.overviewRowLast]}>
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.previewSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.previewSheetHeader}>
            <View>
              <Text style={styles.previewSheetEyebrow}>LISTING PREVIEW</Text>
              <Text style={styles.previewSheetTitle}>Ready to stand out.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <MaterialCommunityIcons name="close" size={19} color="#0B1320" />
            </Pressable>
          </View>

          <View style={styles.previewListingCard}>
            <View style={styles.previewListingVisual}>
              <View style={styles.previewListingBadge}><Text style={styles.previewListingBadgeText}>VERIFIED SELLER</Text></View>
              <Image source={truckBlue} resizeMode="contain" style={styles.previewListingImage} />
            </View>
            <View style={styles.previewListingBody}>
              <Text style={styles.previewListingTitle}>{draft.makeModel || 'Commercial vehicle'}</Text>
              <Text style={styles.previewListingMeta}>{draft.year || 'Year'} • {km ? formatKm(km) : 'KM pending'} • {draft.category}</Text>
              <View style={styles.previewRegistration}>
                <MaterialCommunityIcons name="identifier" size={14} color="#7A8698" />
                <Text style={styles.previewRegistrationText}>{draft.registration || 'Registration pending'}</Text>
              </View>
              <View style={styles.inventoryRule} />
              <Text style={styles.priceOverline}>ASKING PRICE</Text>
              <Text style={styles.previewListingPrice}>{price ? formatCompactCurrency(price) : 'Add price'}</Text>
            </View>
          </View>

          <View style={styles.previewPrivacy}>
            <MaterialCommunityIcons name="shield-lock-outline" size={19} color="#5B5FF9" />
            <Text style={styles.previewPrivacyText}>Your contact details remain private in the public listing.</Text>
          </View>

          <View style={styles.previewActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}>
              <Text style={styles.softButtonText}>Edit</Text>
            </Pressable>
            <Pressable onPress={onSave} style={({ pressed }) => [styles.darkButton, pressed && styles.darkButtonPressed]}>
              <Text style={styles.darkButtonText}>Save listing</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F8' },
  shell: { flex: 1, backgroundColor: '#F4F5F8' },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },

  header: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07111F',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111D2E',
    borderWidth: 1,
    borderColor: '#202D40',
  },
  headerCopy: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.1 },
  headerSubtitle: { marginTop: 3, color: '#8E9AAF', fontSize: 10.2, fontWeight: '700' },

  navBar: {
    height: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#07111F',
    borderBottomWidth: 1,
    borderBottomColor: '#1B2636',
  },
  navTab: {
    flex: 1,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navTabActive: { backgroundColor: '#FFFFFF' },
  navTabText: { color: '#7A8698', fontSize: 11.5, fontWeight: '800' },
  navTabTextActive: { color: '#0B1320' },

  buyContent: { paddingBottom: 34 },
  discoveryHero: {
    margin: 14,
    minHeight: 240,
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: '#101A2B',
  },
  heroOrbA: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -74,
    top: -82,
    backgroundColor: '#5B5FF9',
    opacity: 0.9,
  },
  heroOrbB: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: 12,
    bottom: -84,
    backgroundColor: '#16C79A',
    opacity: 0.35,
  },
  discoveryTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#35E5A7' },
  livePillText: { color: '#DDE6F4', fontSize: 9.2, fontWeight: '900', letterSpacing: 0.8 },
  marketMetric: { alignItems: 'flex-end' },
  marketMetricValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  marketMetricLabel: { color: '#A9B4C5', fontSize: 8.8, fontWeight: '700' },
  discoveryTitle: { marginTop: 24, maxWidth: 285, color: '#FFFFFF', fontSize: 29, lineHeight: 33, fontWeight: '900' },
  discoverySubtitle: { marginTop: 10, maxWidth: 300, color: '#AEB9CA', fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  heroSearch: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  heroSearchInput: { flex: 1, color: '#0B1320', fontSize: 12.5, fontWeight: '700', paddingVertical: 0 },
  filterKey: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF0F5' },

  quickStrip: {
    marginHorizontal: 14,
    marginBottom: 4,
    minHeight: 66,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E8EE',
  },
  quickValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickValueLabel: { color: '#273348', fontSize: 9.5, fontWeight: '900' },
  quickValueText: { marginTop: 1, color: '#8B95A6', fontSize: 8.3, fontWeight: '700' },
  quickDivider: { width: 1, height: 30, backgroundColor: '#E9ECF1', marginHorizontal: 4 },

  sectionHeading: { marginTop: 22, marginBottom: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeadingTitle: { color: '#0B1320', fontSize: 17, fontWeight: '900' },
  sectionHeadingAction: { color: '#68758A', fontSize: 10.3, fontWeight: '800' },

  categoryRail: { paddingHorizontal: 14, gap: 9 },
  categoryCard: {
    width: 78,
    minHeight: 78,
    borderRadius: 19,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6ED',
  },
  categoryCardActive: { backgroundColor: '#0B1320', borderColor: '#0B1320' },
  categoryIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECECFF' },
  categoryIconBoxActive: { backgroundColor: '#5B5FF9' },
  categoryCardText: { color: '#536076', fontSize: 9.8, fontWeight: '800' },
  categoryCardTextActive: { color: '#FFFFFF' },

  featuredRail: { paddingHorizontal: 14, gap: 12 },
  featuredCard: { width: 270, minHeight: 276, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  featuredCardTop: { position: 'absolute', zIndex: 2, left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signalBadge: { height: 25, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center' },
  signalBadgeText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  floatingFavorite: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)' },
  featuredImageWrap: { height: 148, alignItems: 'center', justifyContent: 'center' },
  featuredImage: { width: '82%', height: '82%' },
  featuredBody: { flex: 1, padding: 14, backgroundColor: '#FFFFFF' },
  featuredTitle: { color: '#0B1320', fontSize: 15, fontWeight: '900' },
  featuredMeta: { marginTop: 5, color: '#7A8698', fontSize: 9.8, fontWeight: '700' },
  featuredPriceRow: { marginTop: 13, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceOverline: { color: '#949EAE', fontSize: 8.6, fontWeight: '900', letterSpacing: 0.6 },
  featuredPrice: { marginTop: 3, color: '#0B1320', fontSize: 19, fontWeight: '900' },
  featuredBidCount: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 27, borderRadius: 13, backgroundColor: '#F1F3F7' },
  featuredBidCountText: { color: '#59657A', fontSize: 9.4, fontWeight: '800' },

  sellBanner: {
    marginHorizontal: 14,
    marginTop: 22,
    minHeight: 98,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#DDF9EF',
  },
  sellBannerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sellBannerEyebrow: { color: '#0A6D52', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  sellBannerTitle: { marginTop: 3, color: '#0B1320', fontSize: 13.5, lineHeight: 17, fontWeight: '900' },
  sellBannerCopy: { marginTop: 3, color: '#5F746D', fontSize: 9.5, fontWeight: '700' },
  sellBannerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  inventoryList: { paddingHorizontal: 14, gap: 12 },
  inventoryCard: {
    minHeight: 152,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E7ED',
  },
  inventoryImagePane: { width: 126, alignItems: 'center', justifyContent: 'center' },
  inventoryImage: { width: '86%', height: '76%' },
  scoreBadge: { position: 'absolute', left: 9, top: 9, height: 25, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0B6E53' },
  scoreBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  inventoryBody: { flex: 1, padding: 12 },
  inventoryTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  inventoryTitle: { color: '#0B1320', fontSize: 13.5, fontWeight: '900' },
  inventoryMeta: { marginTop: 3, color: '#7A8698', fontSize: 9.4, fontWeight: '700' },
  inventoryLocation: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  inventoryLocationText: { color: '#7A8698', fontSize: 9.2, fontWeight: '700' },
  inventoryRule: { height: 1, backgroundColor: '#ECEEF2', marginVertical: 9 },
  inventoryBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  inventoryAsking: { marginTop: 2, color: '#0B1320', fontSize: 14.5, fontWeight: '900' },
  inventoryBidBlock: { alignItems: 'flex-end' },
  inventoryLive: { color: '#0A8B67', fontSize: 8.3, fontWeight: '900', letterSpacing: 0.5 },
  inventoryBid: { marginTop: 2, color: '#0A8B67', fontSize: 13.5, fontWeight: '900' },
  inventoryEnd: { marginTop: 1, color: '#9AA3B2', fontSize: 7.9, fontWeight: '700' },

  emptyState: { marginHorizontal: 14, padding: 30, borderRadius: 22, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF0F5' },
  emptyTitle: { marginTop: 10, color: '#0B1320', fontSize: 14, fontWeight: '900' },
  emptyCopy: { marginTop: 4, color: '#7A8698', fontSize: 10.5, fontWeight: '700' },

  promiseCard: { marginHorizontal: 14, marginTop: 22, borderRadius: 24, padding: 18, backgroundColor: '#101A2B' },
  promiseEyebrow: { color: '#8A8EFF', fontSize: 8.7, fontWeight: '900', letterSpacing: 0.8 },
  promiseTitle: { marginTop: 6, maxWidth: 250, color: '#FFFFFF', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  promiseGrid: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  promiseItem: { width: '48%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B5FF9' },
  promiseItemText: { flex: 1, color: '#D8E0EC', fontSize: 9.8, lineHeight: 13, fontWeight: '800' },

  sellContent: { padding: 14, paddingBottom: 34 },
  sellHero: { minHeight: 190, borderRadius: 26, padding: 18, overflow: 'hidden', backgroundColor: '#101A2B', flexDirection: 'row' },
  sellHeroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -65, top: -40, backgroundColor: '#F48A2C', opacity: 0.85 },
  sellHeroCopy: { flex: 1, zIndex: 2 },
  sellHeroEyebrow: { color: '#FFB979', fontSize: 8.8, fontWeight: '900', letterSpacing: 0.8 },
  sellHeroTitle: { marginTop: 9, color: '#FFFFFF', fontSize: 23, lineHeight: 27, fontWeight: '900', maxWidth: 235 },
  sellHeroSubtitle: { marginTop: 9, color: '#B3BECE', fontSize: 10.5, lineHeight: 15, fontWeight: '600', maxWidth: 240 },
  sellHeroImage: { position: 'absolute', right: -14, bottom: -4, width: 150, height: 105, opacity: 0.95 },

  sellBenefits: { marginTop: 10, flexDirection: 'row', gap: 8 },
  sellBenefit: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7ED' },
  sellBenefitText: { color: '#536076', fontSize: 8.8, fontWeight: '800' },

  progressCard: { marginTop: 12, borderRadius: 20, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { color: '#0B1320', fontSize: 13.5, fontWeight: '900' },
  progressMeta: { color: '#7A8698', fontSize: 9.2, fontWeight: '800' },
  progressTrack: { marginTop: 12, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#ECEFF3' },
  progressFill: { width: '25%', height: '100%', borderRadius: 3, backgroundColor: '#5B5FF9' },
  progressLabels: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#9AA3B2', fontSize: 8.3, fontWeight: '800' },
  progressLabelActive: { color: '#5B5FF9', fontSize: 8.3, fontWeight: '900' },

  sellFormCard: { marginTop: 12, borderRadius: 22, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  formTitle: { color: '#0B1320', fontSize: 14.5, fontWeight: '900' },
  formSubtitle: { marginTop: 3, color: '#8A95A6', fontSize: 9.5, fontWeight: '700' },
  autoFillChip: { height: 28, paddingHorizontal: 9, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECECFF' },
  autoFillChipText: { color: '#5B5FF9', fontSize: 8.8, fontWeight: '900' },

  fieldWrap: { marginTop: 14 },
  fieldLabel: { marginBottom: 6, color: '#49566A', fontSize: 10.2, fontWeight: '800' },
  fieldShell: { minHeight: 49, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E1E5EB' },
  fieldPrefix: { paddingLeft: 13, color: '#0B1320', fontSize: 15, fontWeight: '900' },
  fieldInput: { flex: 1, minHeight: 47, paddingHorizontal: 13, color: '#0B1320', fontSize: 12.5, fontWeight: '700' },
  fieldInputWithPrefix: { paddingLeft: 6 },
  twoColumn: { flexDirection: 'row', gap: 10 },

  sellCategoryRail: { gap: 7 },
  sellCategoryChip: { height: 36, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E2E6EC' },
  sellCategoryChipActive: { backgroundColor: '#0B1320', borderColor: '#0B1320' },
  sellCategoryText: { color: '#536076', fontSize: 9.4, fontWeight: '800' },
  sellCategoryTextActive: { color: '#FFFFFF' },

  photoGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoSlot: { width: '31%', aspectRatio: 1.16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F7F8FA', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D6DBE3' },
  photoSlotPrimary: { backgroundColor: '#5B5FF9', borderStyle: 'solid', borderColor: '#5B5FF9' },
  photoIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  photoLabel: { color: '#68758A', fontSize: 8.8, fontWeight: '800' },
  photoLabelPrimary: { color: '#FFFFFF' },

  biddingChoice: { marginTop: 12, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#EAF8F3' },
  biddingChoiceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A67A' },
  biddingChoiceTitle: { color: '#0B1320', fontSize: 11.3, fontWeight: '900' },
  biddingChoiceCopy: { marginTop: 2, color: '#62746E', fontSize: 9.2, lineHeight: 13, fontWeight: '600' },

  sellerShield: { marginTop: 12, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECECFF' },
  sellerShieldIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B5FF9' },
  sellerShieldTitle: { color: '#22255E', fontSize: 11.5, fontWeight: '900' },
  sellerShieldCopy: { marginTop: 3, color: '#656999', fontSize: 9.4, lineHeight: 13, fontWeight: '600' },

  sellActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  softButton: { flex: 0.42, minHeight: 49, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE2E9' },
  softButtonText: { color: '#0B1320', fontSize: 11.5, fontWeight: '900' },
  darkButton: { flex: 1, minHeight: 49, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#0B1320' },
  darkButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  darkButtonText: { color: '#FFFFFF', fontSize: 11.8, fontWeight: '900' },

  activityContent: { padding: 14, paddingBottom: 34 },
  activityHero: { minHeight: 175, borderRadius: 26, padding: 18, backgroundColor: '#101A2B' },
  activityEyebrow: { color: '#8A8EFF', fontSize: 8.8, fontWeight: '900', letterSpacing: 0.8 },
  activityTitle: { marginTop: 6, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  activitySubtitle: { marginTop: 6, color: '#AEB8C8', fontSize: 10.5, lineHeight: 15, fontWeight: '600' },
  activityStatRow: { marginTop: 16, flexDirection: 'row', gap: 8 },
  activityStat: { flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: 'center', backgroundColor: '#172437', borderWidth: 1, borderColor: '#223149' },
  activityStatValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  activityStatLabel: { marginTop: 2, color: '#91A0B5', fontSize: 8.5, fontWeight: '800' },

  activitySection: { marginTop: 12, borderRadius: 22, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  activitySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activitySectionTitle: { color: '#0B1320', fontSize: 14, fontWeight: '900' },
  activitySectionSubtitle: { marginTop: 3, color: '#8A95A6', fontSize: 9.3, fontWeight: '700' },
  activityRows: { marginTop: 11, gap: 10 },
  activityVehicleRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityThumb: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityThumbImage: { width: '80%', height: '76%' },
  activityVehicleTitle: { color: '#0B1320', fontSize: 11.3, fontWeight: '900' },
  activityVehicleMeta: { marginTop: 3, color: '#7A8698', fontSize: 8.8, fontWeight: '700' },
  activityAmountWrap: { alignItems: 'flex-end' },
  activityAmount: { color: '#0B1320', fontSize: 11.5, fontWeight: '900' },
  leadingPill: { marginTop: 3, height: 20, borderRadius: 10, paddingHorizontal: 7, justifyContent: 'center', backgroundColor: '#DFF7EE' },
  leadingPillText: { color: '#0A7658', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.4 },
  savedPill: { height: 22, borderRadius: 11, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: '#ECECFF' },
  savedPillText: { color: '#5B5FF9', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.4 },
  activityEmpty: { marginTop: 11, minHeight: 68, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F8FA' },
  activityEmptyIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECECFF' },
  activityEmptyText: { color: '#5E6A7E', fontSize: 9.8, fontWeight: '700' },
  activityEmptyAction: { marginTop: 4, color: '#5B5FF9', fontSize: 9.6, fontWeight: '900' },

  marketSupport: { marginTop: 12, minHeight: 84, borderRadius: 22, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#5B5FF9' },
  marketSupportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  marketSupportTitle: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  marketSupportCopy: { marginTop: 3, color: '#DCDDFF', fontSize: 9.2, lineHeight: 13, fontWeight: '600' },

  detailSafe: { flex: 1, backgroundColor: '#F4F5F8' },
  detailHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#07111F' },
  detailHeaderAction: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111D2E', borderWidth: 1, borderColor: '#202D40' },
  detailHeaderTitle: { flex: 1, color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '900' },
  detailContent: { padding: 14, paddingBottom: 30 },
  detailHero: { height: 245, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  detailAccent: { position: 'absolute', width: 185, height: 185, borderRadius: 93, right: -65, top: -55, opacity: 0.85 },
  detailHeroBadge: { position: 'absolute', left: 14, top: 14, zIndex: 2, height: 27, paddingHorizontal: 9, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0B1320' },
  detailHeroBadgeText: { color: '#FFFFFF', fontSize: 8.3, fontWeight: '900', letterSpacing: 0.5 },
  detailHeroImage: { width: '82%', height: '77%' },
  detailScore: { position: 'absolute', right: 14, bottom: 14, width: 68, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  detailScoreValue: { color: '#0A7658', fontSize: 19, fontWeight: '900' },
  detailScoreLabel: { marginTop: 1, color: '#758195', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.4 },

  detailIntro: { marginTop: 16 },
  detailTitle: { color: '#0B1320', fontSize: 22, fontWeight: '900' },
  detailMeta: { marginTop: 5, color: '#667287', fontSize: 10.5, fontWeight: '700' },
  detailLocation: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLocationText: { color: '#788497', fontSize: 9.8, fontWeight: '700' },

  marketPriceCard: { marginTop: 14, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  marketPriceColumn: { flex: 1 },
  marketPriceLine: { width: 1, height: 50, backgroundColor: '#E5E8ED', marginHorizontal: 14 },
  marketAsking: { marginTop: 4, color: '#0B1320', fontSize: 20, fontWeight: '900' },
  livePriceOverline: { color: '#0A8B67', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  marketBid: { marginTop: 4, color: '#0A8B67', fontSize: 20, fontWeight: '900' },
  marketBidMeta: { marginTop: 2, color: '#8A95A6', fontSize: 8.2, fontWeight: '700' },

  detailSection: { marginTop: 12, borderRadius: 22, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  detailSectionEyebrow: { color: '#7F8999', fontSize: 8.2, fontWeight: '900', letterSpacing: 0.7 },
  detailSectionTitle: { marginTop: 4, color: '#0B1320', fontSize: 14.5, fontWeight: '900' },
  confidenceGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  confidenceItem: { width: '48%', minHeight: 76, borderRadius: 16, padding: 10, backgroundColor: '#F7F8FA' },
  confidenceIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confidenceIconPositive: { backgroundColor: '#E1F6EE' },
  confidenceIconNeutral: { backgroundColor: '#FFF4DA' },
  confidenceTitle: { marginTop: 7, color: '#7B8799', fontSize: 8.5, fontWeight: '800' },
  confidenceValue: { marginTop: 2, color: '#0B1320', fontSize: 10.5, fontWeight: '900' },

  overviewList: { marginTop: 10 },
  overviewRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#ECEEF2' },
  overviewRowLast: { borderBottomWidth: 0 },
  overviewLabel: { color: '#7A8698', fontSize: 9.5, fontWeight: '700' },
  overviewValue: { flex: 1, color: '#28364A', fontSize: 9.8, fontWeight: '800', textAlign: 'right' },

  privateConnect: { marginTop: 12, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECECFF' },
  privateConnectIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B5FF9' },
  privateConnectTitle: { color: '#23265C', fontSize: 11.3, fontWeight: '900' },
  privateConnectCopy: { marginTop: 3, color: '#666A96', fontSize: 9.3, lineHeight: 13, fontWeight: '600' },

  bidPanel: { marginTop: 12, borderRadius: 22, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  bidPanelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bidPanelTitle: { marginTop: 3, color: '#0B1320', fontSize: 15, fontWeight: '900' },
  bidMinimum: { color: '#7A8698', fontSize: 9.2, fontWeight: '800' },
  bidAdjuster: { marginTop: 13, minHeight: 62, borderRadius: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F7F9', borderWidth: 1, borderColor: '#E2E6EC' },
  bidAdjustAction: { width: 56, height: 60, alignItems: 'center', justifyContent: 'center' },
  bidAdjustCenter: { flex: 1, alignItems: 'center' },
  bidAdjustLabel: { color: '#949EAD', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.6 },
  bidAdjustValue: { marginTop: 2, color: '#0B1320', fontSize: 19, fontWeight: '900' },
  detailPrimaryButton: { marginTop: 10, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#0B1320' },
  detailPrimaryButtonText: { color: '#FFFFFF', fontSize: 11.8, fontWeight: '900' },
  detailSecondaryButton: { marginTop: 8, height: 47, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE2E9' },
  detailSecondaryButtonText: { color: '#0B1320', fontSize: 10.7, fontWeight: '900' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,10,18,0.58)' },
  sheetDismiss: { flex: 1 },
  previewSheet: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F4F5F8' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#C6CDD7', marginBottom: 13 },
  previewSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewSheetEyebrow: { color: '#5B5FF9', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  previewSheetTitle: { marginTop: 4, color: '#0B1320', fontSize: 19, fontWeight: '900' },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  previewListingCard: { marginTop: 13, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E7ED' },
  previewListingVisual: { height: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECECFF' },
  previewListingBadge: { position: 'absolute', left: 12, top: 12, height: 25, borderRadius: 12, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: '#0A7658' },
  previewListingBadgeText: { color: '#FFFFFF', fontSize: 7.9, fontWeight: '900', letterSpacing: 0.4 },
  previewListingImage: { width: '78%', height: '78%' },
  previewListingBody: { padding: 13 },
  previewListingTitle: { color: '#0B1320', fontSize: 15.5, fontWeight: '900' },
  previewListingMeta: { marginTop: 4, color: '#758195', fontSize: 9.7, fontWeight: '700' },
  previewRegistration: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewRegistrationText: { color: '#758195', fontSize: 9.3, fontWeight: '700' },
  previewListingPrice: { marginTop: 3, color: '#0B1320', fontSize: 18, fontWeight: '900' },

  previewPrivacy: { marginTop: 10, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECECFF' },
  previewPrivacyText: { flex: 1, color: '#60658F', fontSize: 9.6, fontWeight: '700' },
  previewActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
});
