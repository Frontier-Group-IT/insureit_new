import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSelectedCustomerContext } from '@/lib/customer-context';
import {
  getExchangeMarketplaceFeed,
  getExchangeListingDetail,
  placeExchangeBid,
  requestExchangeContact,
  toggleExchangeFavorite,
  type ExchangeFeedRow,
  type ExchangeListingDetail,
} from '@/lib/exchange';

type ExchangeFeedWithCover = ExchangeFeedRow & { cover_url: string | null };

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function km(value: number | null) {
  return value ? `${value.toLocaleString('en-IN')} km` : 'Odometer verified';
}

function ownership(value: number | null) {
  if (!value) return 'Ownership verified';
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th';
  return `${value}${suffix} owner`;
}

function displayDate(value: string | null | undefined) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiryState(value: string | null | undefined) {
  if (!value) return { label: 'Not available', ok: false };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { label: value, ok: false };
  const ok = parsed.getTime() >= Date.now();
  return { label: `${ok ? 'Valid till' : 'Expired'} ${displayDate(value)}`, ok };
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Please try again.';
}

function healthTone(ok: boolean) {
  return ok ? '#0D7C58' : '#A36A0A';
}

export default function ExchangeVehicleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string | string[] }>();
  const listingId = Array.isArray(params.listingId) ? params.listingId[0] : params.listingId;

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<ExchangeFeedWithCover | null>(null);
  const [healthDetail, setHealthDetail] = useState<ExchangeListingDetail | null>(null);
  const [similar, setSimilar] = useState<ExchangeFeedWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offerAmount, setOfferAmount] = useState(0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const minimumOffer = useMemo(() => {
    if (!vehicle || vehicle.selling_mode === 'fixed_price') return 0;
    if (vehicle.bid_count > 0) return Number(vehicle.current_bid) + Number(vehicle.min_bid_increment || 10000);
    if (vehicle.selling_mode === 'managed_auction') return Math.max(Number(vehicle.asking_price), Number(vehicle.min_bid_increment || 10000));
    return Math.max(Number(vehicle.asking_price) - 50000, Number(vehicle.min_bid_increment || 10000));
  }, [vehicle]);

  const shownOffer = Math.max(offerAmount, minimumOffer);

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
      const context = await getSelectedCustomerContext();
      if (!context) throw new Error('No active customer account is selected.');
      setCustomerId(context.customer_id);

      const rows = await getExchangeMarketplaceFeed({ limit: 100 }) as ExchangeFeedWithCover[];
      const selected = rows.find((row) => row.listing_id === listingId) ?? null;
      if (!selected) throw new Error('This Exchange listing is no longer available.');

      setVehicle(selected);
      try {
        const detail = await getExchangeListingDetail(selected.listing_id);
        setHealthDetail(detail);
        setActiveMediaIndex(0);
      } catch {
        // Preview environments can temporarily run against production before the
        // new detail RPC is deployed. Keep the core listing usable in that case.
        setHealthDetail(null);
      }
      setSimilar(
        rows
          .filter((row) => row.listing_id !== selected.listing_id && row.category === selected.category)
          .slice(0, 4),
      );
      setOfferAmount((current) => current || (
        selected.selling_mode === 'fixed_price'
          ? 0
          : selected.bid_count > 0
            ? Number(selected.current_bid) + Number(selected.min_bid_increment || 10000)
            : selected.selling_mode === 'managed_auction'
              ? Math.max(Number(selected.asking_price), Number(selected.min_bid_increment || 10000))
              : Math.max(Number(selected.asking_price) - 50000, Number(selected.min_bid_increment || 10000))
      ));
    } catch (nextError) {
      setError(errorText(nextError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function toggleFavorite() {
    if (!vehicle || !customerId || busy) return;
    setBusy(true);
    try {
      const added = await toggleExchangeFavorite(vehicle.listing_id, customerId);
      setVehicle((current) => current ? { ...current, is_favorite: added } : current);
    } catch (nextError) {
      Alert.alert('Could not update saved vehicle', errorText(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function submitOffer() {
    if (!vehicle || !customerId || busy) return;
    if (vehicle.selling_mode === 'fixed_price') {
      Alert.alert('Fixed price listing', 'This vehicle is listed at a fixed price. Request a managed callback to continue.');
      return;
    }
    if (shownOffer < minimumOffer) {
      Alert.alert('Increase your offer', `The next offer starts at ${money(minimumOffer)}.`);
      return;
    }

    Alert.alert(
      vehicle.selling_mode === 'managed_auction' ? 'Confirm your bid' : 'Confirm your offer',
      `${money(shownOffer)} for ${vehicle.title}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await placeExchangeBid(vehicle.listing_id, customerId, shownOffer);
                await load(true);
                Alert.alert(vehicle.selling_mode === 'managed_auction' ? 'Bid placed' : 'Offer submitted', 'Your amount has been recorded securely.');
              } catch (nextError) {
                Alert.alert('Could not submit offer', errorText(nextError));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function requestCallback() {
    if (!vehicle || !customerId || busy) return;
    setBusy(true);
    try {
      await requestExchangeContact(vehicle.listing_id, customerId, 'managed_callback');
      Alert.alert('Callback requested', 'InsureIT will coordinate the connection without exposing private contact details.');
    } catch (nextError) {
      Alert.alert('Could not request callback', errorText(nextError));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !vehicle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerState}>
          <View style={styles.stateIcon}><MaterialCommunityIcons name="truck-outline" size={28} color="#164BB8" /></View>
          <Text style={styles.stateTitle}>Opening vehicle</Text>
          <Text style={styles.stateCopy}>Loading the latest Exchange details.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle || error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.circleButton}>
            <MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" />
          </Pressable>
          <Text style={styles.topBarTitle}>Vehicle details</Text>
          <View style={styles.circleButtonSpacer} />
        </View>
        <View style={styles.centerState}>
          <View style={styles.stateIcon}><MaterialCommunityIcons name="alert-circle-outline" size={28} color="#A36A0A" /></View>
          <Text style={styles.stateTitle}>Vehicle unavailable</Text>
          <Text style={styles.stateCopy}>{error ?? 'Please try again.'}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const galleryPhotos = (healthDetail?.media ?? []).filter((item) => item.media_type === 'photo' && item.signed_url);
  const activeGalleryPhoto = galleryPhotos[activeMediaIndex]?.signed_url ?? vehicle.cover_url;
  const location = [vehicle.city, vehicle.state].filter(Boolean).join(', ') || 'Location available on request';
  const fuel = vehicle.fuel_type || 'Fuel verified';
  const owner = ownership(vehicle.ownership_count);
  const hasLiveBidding = vehicle.selling_mode === 'managed_auction';
  const acceptsOffers = vehicle.selling_mode === 'open_bidding';
  const isFixedPrice = vehicle.selling_mode === 'fixed_price';
  const inspectionScore = Number(vehicle.inspection_score ?? 0);
  const fitness = expiryState(healthDetail?.fitness_expiry_date);
  const puc = expiryState(healthDetail?.puc_expiry_date);
  const roadTax = expiryState(healthDetail?.road_tax_expiry_date);
  const permitExpiry = expiryState(healthDetail?.national_permit_expiry_date ?? healthDetail?.local_permit_expiry_date);
  const insurance = expiryState(healthDetail?.insurance?.end_date);

  const insightRows = [
    vehicle.owner_verified ? 'Owner identity has been verified' : 'Owner verification is still in progress',
    vehicle.documents_verified ? 'Vehicle documents have been verified' : 'Document verification is still in progress',
    vehicle.inspected ? 'InsureIT inspection has been completed' : 'Physical inspection can be requested',
    vehicle.tyre_condition_percent !== null ? `Tyre condition recorded at ${vehicle.tyre_condition_percent}%` : 'Tyre condition has not been recorded yet',
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.circleButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" />
        </Pressable>
        <Text style={styles.topBarTitle}>Vehicle details</Text>
        <Pressable disabled={busy} onPress={() => void toggleFavorite()} style={styles.circleButton}>
          <MaterialCommunityIcons name={vehicle.is_favorite ? 'heart' : 'heart-outline'} size={20} color={vehicle.is_favorite ? '#D7385E' : '#0F1D33'} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.hero}>
          {activeGalleryPhoto ? (
            <Image source={{ uri: activeGalleryPhoto }} resizeMode="contain" style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <MaterialCommunityIcons name={vehicle.category === 'Bus' ? 'bus' : vehicle.category === 'Pickup' ? 'car-pickup' : 'truck-outline'} size={86} color="#5B6E88" />
              <Text style={styles.heroFallbackText}>Vehicle photos pending</Text>
            </View>
          )}
          <View style={styles.photoCount}>
            <MaterialCommunityIcons name="image-multiple-outline" size={13} color="#FFFFFF" />
            <Text style={styles.photoCountText}>{galleryPhotos.length ? `${Math.min(activeMediaIndex + 1, galleryPhotos.length)} / ${galleryPhotos.length}` : 'Photos'}</Text>
          </View>
          {vehicle.inspected ? (
            <View style={styles.inspectedBadge}><MaterialCommunityIcons name="shield-check" size={13} color="#0D7C58" /><Text style={styles.inspectedBadgeText}>Inspected</Text></View>
          ) : null}
        </View>

        {galleryPhotos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRail}>
            {galleryPhotos.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setActiveMediaIndex(index)}
                style={[styles.galleryThumbWrap, activeMediaIndex === index && styles.galleryThumbActive]}
              >
                <Image source={{ uri: item.signed_url! }} resizeMode="cover" style={styles.galleryThumb} />
                {item.label ? <Text numberOfLines={1} style={styles.galleryLabel}>{item.label}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.identity}>
          <Text style={styles.title}>{vehicle.year ? `${vehicle.year} ` : ''}{vehicle.title}</Text>
          <Text style={styles.meta}>{km(vehicle.odometer_km)} • {fuel} • {owner}</Text>
          <View style={styles.locationRow}><MaterialCommunityIcons name="map-marker-outline" size={14} color="#758296" /><Text style={styles.locationText}>{location}</Text></View>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceMain}>
            <View>
              <Text style={styles.eyebrow}>ASKING PRICE</Text>
              <Text style={styles.price}>{money(Number(vehicle.asking_price))}</Text>
            </View>
            <Pressable
              onPress={() => router.push({
                pathname: '/customer/exchange/finance',
                params: {
                  listingId: vehicle.listing_id,
                  title: vehicle.title,
                  price: String(vehicle.asking_price),
                },
              })}
              style={styles.financeButton}
            >
              <MaterialCommunityIcons name="calculator-variant-outline" size={15} color="#164BB8" />
              <Text style={styles.financeButtonText}>EMI</Text>
            </Pressable>
          </View>
          <View style={styles.priceSignal}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#0D7C58" />
            <View>
              <Text style={styles.priceSignalTitle}>{vehicle.documents_verified ? 'Verified listing' : 'Verification in progress'}</Text>
              <Text style={styles.priceSignalCopy}>Market valuation comes in Phase 3</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>INSUREIT INSIGHT</Text>
          <Text style={styles.sectionTitle}>{vehicle.inspected && inspectionScore >= 8 ? 'Strong vehicle profile' : 'What we know so far'}</Text>
          <Text style={styles.sectionCopy}>This summary uses verified Exchange data only. It does not estimate condition or market value where data is missing.</Text>
          <View style={styles.insightList}>
            {insightRows.map((row, index) => {
              const positive = index === 0 ? vehicle.owner_verified : index === 1 ? vehicle.documents_verified : index === 2 ? vehicle.inspected : vehicle.tyre_condition_percent !== null;
              return (
                <View key={row} style={styles.insightRow}>
                  <MaterialCommunityIcons name={positive ? 'check-circle' : 'clock-outline'} size={16} color={healthTone(positive)} />
                  <Text style={styles.insightText}>{row}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionEyebrow}>COMMERCIAL VEHICLE</Text>
              <Text style={styles.sectionTitle}>Key specifications</Text>
            </View>
            <MaterialCommunityIcons name="truck-cargo-container" size={24} color="#164BB8" />
          </View>
          <View style={styles.specGrid}>
            <Spec label="Category" value={vehicle.category} icon="truck-outline" />
            <Spec label="Year" value={vehicle.year ? String(vehicle.year) : 'Verified'} icon="calendar-blank-outline" />
            <Spec label="Odometer" value={km(vehicle.odometer_km)} icon="speedometer" />
            <Spec label="Fuel" value={fuel} icon="fuel" />
            <Spec label="Ownership" value={owner} icon="account-outline" />
            <Spec label="Registration" value={vehicle.masked_registration || 'Masked'} icon="card-account-details-outline" />
            {healthDetail?.gvw_kg ? <Spec label="GVW" value={`${Number(healthDetail.gvw_kg).toLocaleString('en-IN')} kg`} icon="weight-kilogram" /> : null}
            {healthDetail?.body_type ? <Spec label="Body type" value={healthDetail.body_type} icon="truck-cargo-container" /> : null}
            {healthDetail?.wheel_base_mm ? <Spec label="Wheelbase" value={`${Number(healthDetail.wheel_base_mm).toLocaleString('en-IN')} mm`} icon="ruler" /> : null}
            {healthDetail?.emission_norm ? <Spec label="Emission" value={healthDetail.emission_norm} icon="leaf" /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionEyebrow}>VEHICLE HEALTH</Text>
              <Text style={styles.sectionTitle}>Trust & verification</Text>
            </View>
            {vehicle.inspected ? (
              <View style={styles.scoreBubble}>
                <Text style={styles.scoreValue}>{inspectionScore || '✓'}</Text>
                <Text style={styles.scoreLabel}>{inspectionScore ? '/10' : 'DONE'}</Text>
              </View>
            ) : null}
          </View>
          <HealthRow label="Owner identity" value={vehicle.owner_verified ? 'Verified' : 'In review'} ok={vehicle.owner_verified} />
          <HealthRow label="RC / source verification" value={healthDetail?.authbridge_verified ? `Verified ${healthDetail.authbridge_last_verified_at ? displayDate(healthDetail.authbridge_last_verified_at) : ''}`.trim() : (healthDetail?.registration_status || 'Not verified')} ok={Boolean(healthDetail?.authbridge_verified)} />
          <HealthRow label="Insurance" value={healthDetail?.insurance?.end_date ? `${healthDetail.insurance.insurer_name ? healthDetail.insurance.insurer_name + ' • ' : ''}${insurance.label}` : 'No linked policy validity found'} ok={insurance.ok} />
          <HealthRow label="Fitness" value={fitness.label} ok={fitness.ok} />
          <HealthRow label="PUC" value={puc.label} ok={puc.ok} />
          <HealthRow label="Road tax" value={roadTax.label} ok={roadTax.ok} />
          <HealthRow label="Permit" value={healthDetail ? `${healthDetail.permit_type || 'Permit'} • ${permitExpiry.label}` : (vehicle.permit_summary || 'Not available')} ok={permitExpiry.ok || Boolean(vehicle.permit_summary)} />
          <HealthRow label="Blacklist" value={healthDetail?.blacklist_status || 'Not available'} ok={Boolean(healthDetail?.blacklist_status && !/black|blocked|yes|true/i.test(healthDetail.blacklist_status))} />
          <HealthRow label="Finance" value={healthDetail?.financed === true ? `Financed${healthDetail.financer_name ? ` • ${healthDetail.financer_name}` : ''}` : healthDetail?.financed === false ? 'No finance recorded' : (vehicle.finance_summary || 'Not available')} ok={healthDetail?.financed === false} />
          <HealthRow label="Inspection" value={vehicle.inspected ? 'Completed' : 'Available'} ok={vehicle.inspected} />
          <HealthRow label="Tyres" value={vehicle.tyre_condition_percent === null ? 'Not recorded' : `${vehicle.tyre_condition_percent}% condition`} ok={vehicle.tyre_condition_percent !== null} last />
          <Pressable
            onPress={() => router.push({ pathname: '/customer/exchange/health', params: { listingId: vehicle.listing_id, title: vehicle.title } })}
            style={({ pressed }) => [styles.healthReportButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="clipboard-pulse-outline" size={17} color="#164BB8" />
            <Text style={styles.healthReportButtonText}>View full Vehicle Health Report</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#164BB8" />
          </Pressable>
        </View>

        <View style={styles.sellerCard}>
          <View style={styles.sellerIcon}><MaterialCommunityIcons name="account-check-outline" size={24} color="#164BB8" /></View>
          <View style={styles.flex}>
            <View style={styles.sellerTitleRow}>
              <Text style={styles.sellerTitle}>{vehicle.owner_verified ? 'Verified vehicle owner' : 'Vehicle owner'}</Text>
              {vehicle.owner_verified ? <View style={styles.verifiedPill}><Text style={styles.verifiedPillText}>VERIFIED</Text></View> : null}
            </View>
            <Text style={styles.sellerCopy}>Private contact details remain protected. InsureIT coordinates contact after your request.</Text>
          </View>
        </View>

        <View style={styles.offerSection}>
          <Text style={styles.sectionEyebrow}>{hasLiveBidding ? 'MANAGED AUCTION' : acceptsOffers ? 'MAKE AN OFFER' : 'FIXED PRICE'}</Text>
          <Text style={styles.sectionTitle}>
            {hasLiveBidding ? 'Compete through Exchange' : acceptsOffers ? 'Start a private commercial offer' : 'Interested in this vehicle?'}
          </Text>
          <Text style={styles.sectionCopy}>
            {hasLiveBidding
              ? `Current bid ${money(Number(vehicle.current_bid))} • ${vehicle.bid_count} bids recorded`
              : acceptsOffers
                ? 'Your offer is recorded securely and the seller can review it through Exchange.'
                : `The seller has listed this vehicle at ${money(Number(vehicle.asking_price))}. Request a managed callback to continue.`}
          </Text>

          {!isFixedPrice ? (
            <>
              <View style={styles.offerAdjuster}>
                <Pressable onPress={() => setOfferAmount(Math.max(minimumOffer, shownOffer - Number(vehicle.min_bid_increment || 10000)))} style={styles.adjustButton}>
                  <MaterialCommunityIcons name="minus" size={20} color="#0F1D33" />
                </Pressable>
                <View style={styles.offerCenter}>
                  <Text style={styles.offerLabel}>YOUR {hasLiveBidding ? 'BID' : 'OFFER'}</Text>
                  <Text style={styles.offerValue}>{money(shownOffer)}</Text>
                </View>
                <Pressable onPress={() => setOfferAmount(shownOffer + Number(vehicle.min_bid_increment || 10000))} style={styles.adjustButton}>
                  <MaterialCommunityIcons name="plus" size={20} color="#0F1D33" />
                </Pressable>
              </View>

              <Pressable disabled={busy} onPress={() => void submitOffer()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>
                <MaterialCommunityIcons name={hasLiveBidding ? 'gavel' : 'handshake-outline'} size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{hasLiveBidding ? 'Place bid' : 'Submit offer'}</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable disabled={busy} onPress={() => void requestCallback()} style={({ pressed }) => [isFixedPrice ? styles.primaryButton : styles.secondaryButton, pressed && styles.pressed, busy && styles.disabled]}>
            <MaterialCommunityIcons name="phone-in-talk-outline" size={17} color={isFixedPrice ? '#FFFFFF' : '#164BB8'} />
            <Text style={isFixedPrice ? styles.primaryButtonText : styles.secondaryButtonText}>{isFixedPrice ? 'Request seller callback' : 'Request managed callback'}</Text>
          </Pressable>
        </View>

        {similar.length > 0 ? (
          <View style={styles.similarSection}>
            <Text style={styles.sectionTitle}>Similar vehicles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRail}>
              {similar.map((row) => (
                <Pressable
                  key={row.listing_id}
                  onPress={() => router.replace({ pathname: '/customer/exchange/[listingId]', params: { listingId: row.listing_id } })}
                  style={styles.similarCard}
                >
                  <View style={styles.similarImageWrap}>
                    {row.cover_url ? <Image source={{ uri: row.cover_url }} resizeMode="contain" style={styles.similarImage} /> : <MaterialCommunityIcons name="truck-outline" size={40} color="#6D7B8E" />}
                  </View>
                  <Text numberOfLines={1} style={styles.similarTitle}>{row.year ? `${row.year} ` : ''}{row.title}</Text>
                  <Text style={styles.similarMeta}>{km(row.odometer_km)}</Text>
                  <Text style={styles.similarPrice}>{money(Number(row.asking_price))}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.stickyBar}>
        <Pressable disabled={busy} onPress={() => void requestCallback()} style={isFixedPrice ? styles.stickyPrimary : styles.stickySecondary}>
          <MaterialCommunityIcons name="phone-outline" size={18} color={isFixedPrice ? '#FFFFFF' : '#164BB8'} />
          <Text style={isFixedPrice ? styles.stickyPrimaryText : styles.stickySecondaryText}>{isFixedPrice ? 'Request callback' : 'Callback'}</Text>
        </Pressable>
        {!isFixedPrice ? (
          <Pressable disabled={busy} onPress={() => void submitOffer()} style={styles.stickyPrimary}>
            <Text style={styles.stickyPrimaryText}>{hasLiveBidding ? 'Place bid' : 'Make offer'}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Spec({ label, value, icon }: { label: string; value: string; icon: 'truck-outline' | 'calendar-blank-outline' | 'speedometer' | 'fuel' | 'account-outline' | 'card-account-details-outline' | 'weight-kilogram' | 'truck-cargo-container' | 'ruler' | 'leaf' }) {
  return (
    <View style={styles.spec}>
      <View style={styles.specIcon}><MaterialCommunityIcons name={icon} size={18} color="#164BB8" /></View>
      <Text style={styles.specLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.specValue}>{value}</Text>
    </View>
  );
}

function HealthRow({ label, value, ok, last = false }: { label: string; value: string; ok: boolean; last?: boolean }) {
  return (
    <View style={[styles.healthRow, last && styles.healthRowLast]}>
      <View style={styles.healthLabelWrap}>
        <MaterialCommunityIcons name={ok ? 'check-circle' : 'clock-outline'} size={16} color={healthTone(ok)} />
        <Text style={styles.healthLabel}>{label}</Text>
      </View>
      <Text style={[styles.healthValue, { color: healthTone(ok) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  content: { paddingBottom: 102 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },

  topBar: { minHeight: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E7EBF0' },
  circleButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', borderWidth: 1, borderColor: '#E3E7EC' },
  circleButtonSpacer: { width: 40, height: 40 },
  topBarTitle: { flex: 1, textAlign: 'center', color: '#0F1D33', fontSize: 14, fontWeight: '900' },

  centerState: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  stateIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  stateTitle: { marginTop: 12, color: '#0F1D33', fontSize: 15, fontWeight: '900' },
  stateCopy: { marginTop: 5, color: '#7C899B', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  retryButton: { marginTop: 14, height: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  retryText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },

  hero: { height: 270, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F5' },
  heroImage: { width: '94%', height: '92%' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroFallbackText: { marginTop: 8, color: '#768397', fontSize: 9.5, fontWeight: '800' },
  photoCount: { position: 'absolute', right: 12, bottom: 12, height: 28, borderRadius: 14, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,29,51,0.84)' },
  photoCountText: { color: '#FFFFFF', fontSize: 8.2, fontWeight: '900' },
  inspectedBadge: { position: 'absolute', left: 12, top: 12, height: 28, borderRadius: 14, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F6EE' },
  inspectedBadgeText: { color: '#0D7C58', fontSize: 8, fontWeight: '900' },
  galleryRail: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 2, gap: 8, backgroundColor: '#F7F8FA' },
  galleryThumbWrap: { width: 78, borderRadius: 12, padding: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  galleryThumbActive: { borderColor: '#164BB8', borderWidth: 2, padding: 2 },
  galleryThumb: { width: '100%', height: 54, borderRadius: 8, backgroundColor: '#EEF1F4' },
  galleryLabel: { marginTop: 3, paddingHorizontal: 2, paddingBottom: 2, color: '#748195', fontSize: 6.8, fontWeight: '800', textAlign: 'center' },

  identity: { paddingHorizontal: 16, paddingTop: 17 },
  title: { color: '#0F1D33', fontSize: 21, lineHeight: 26, fontWeight: '900' },
  meta: { marginTop: 6, color: '#69778B', fontSize: 10, fontWeight: '700' },
  locationRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: '#758296', fontSize: 9.5, fontWeight: '700' },

  priceCard: { marginHorizontal: 14, marginTop: 15, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  priceMain: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: '#8A96A7', fontSize: 7.7, fontWeight: '900', letterSpacing: 0.7 },
  price: { color: '#0F1D33', fontSize: 23, fontWeight: '900' },
  financeButton: { height: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C7D8F3' },
  financeButtonText: { color: '#164BB8', fontSize: 7.8, fontWeight: '900' },
  priceSignal: { marginTop: 12, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECF8F3' },
  priceSignalTitle: { color: '#0D6D50', fontSize: 9.5, fontWeight: '900' },
  priceSignalCopy: { marginTop: 2, color: '#658076', fontSize: 7.8, fontWeight: '700' },

  section: { marginHorizontal: 14, marginTop: 12, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  sectionEyebrow: { color: '#164BB8', fontSize: 7.6, fontWeight: '900', letterSpacing: 0.8 },
  sectionTitle: { marginTop: 4, color: '#0F1D33', fontSize: 14.5, fontWeight: '900' },
  sectionCopy: { marginTop: 5, color: '#758296', fontSize: 9, lineHeight: 13, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  insightList: { marginTop: 12, gap: 9 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  insightText: { flex: 1, color: '#405068', fontSize: 9.2, lineHeight: 13, fontWeight: '700' },

  specGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spec: { width: '48.6%', minHeight: 88, borderRadius: 15, padding: 10, backgroundColor: '#F7F8FA' },
  specIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  specLabel: { marginTop: 7, color: '#8793A4', fontSize: 7.6, fontWeight: '800' },
  specValue: { marginTop: 2, color: '#25344A', fontSize: 9.6, lineHeight: 12.5, fontWeight: '900' },

  scoreBubble: { minWidth: 52, height: 46, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F6EE' },
  scoreValue: { color: '#0D7C58', fontSize: 14, fontWeight: '900' },
  scoreLabel: { color: '#5F8175', fontSize: 6.5, fontWeight: '900' },
  healthRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F4' },
  healthRowLast: { borderBottomWidth: 0 },
  healthReportButton: { marginTop: 10, height: 44, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D2E1F8' },
  healthReportButtonText: { flex: 1, color: '#164BB8', fontSize: 8.8, fontWeight: '900' },
  healthLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthLabel: { color: '#405068', fontSize: 9.2, fontWeight: '800' },
  healthValue: { flex: 1, textAlign: 'right', fontSize: 8.7, fontWeight: '900' },

  sellerCard: { marginHorizontal: 14, marginTop: 12, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D7E4FA' },
  sellerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sellerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerTitle: { color: '#0F1D33', fontSize: 10.5, fontWeight: '900' },
  verifiedPill: { height: 20, borderRadius: 10, paddingHorizontal: 7, justifyContent: 'center', backgroundColor: '#DDEFE7' },
  verifiedPillText: { color: '#0D7C58', fontSize: 6.7, fontWeight: '900' },
  sellerCopy: { marginTop: 4, color: '#66758A', fontSize: 8.6, lineHeight: 12, fontWeight: '700' },

  offerSection: { marginHorizontal: 14, marginTop: 12, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  offerAdjuster: { marginTop: 13, minHeight: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FA', borderWidth: 1, borderColor: '#E0E5EC' },
  adjustButton: { width: 58, height: 62, alignItems: 'center', justifyContent: 'center' },
  offerCenter: { flex: 1, alignItems: 'center' },
  offerLabel: { color: '#8995A5', fontSize: 7.4, fontWeight: '900', letterSpacing: 0.6 },
  offerValue: { marginTop: 2, color: '#0F1D33', fontSize: 19, fontWeight: '900' },
  primaryButton: { marginTop: 10, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#164BB8' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10.8, fontWeight: '900' },
  secondaryButton: { marginTop: 8, height: 46, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D8EF' },
  secondaryButtonText: { color: '#164BB8', fontSize: 9.8, fontWeight: '900' },

  similarSection: { marginTop: 20, paddingHorizontal: 14 },
  similarRail: { paddingTop: 10, paddingRight: 14, gap: 9 },
  similarCard: { width: 180, borderRadius: 17, padding: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  similarImageWrap: { height: 88, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  similarImage: { width: '90%', height: '86%' },
  similarTitle: { marginTop: 8, color: '#0F1D33', fontSize: 9.5, fontWeight: '900' },
  similarMeta: { marginTop: 3, color: '#7B8797', fontSize: 7.8, fontWeight: '700' },
  similarPrice: { marginTop: 6, color: '#0F1D33', fontSize: 11.5, fontWeight: '900' },

  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 72, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E5EC' },
  stickySecondary: { width: 112, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFD1EC' },
  stickySecondaryText: { color: '#164BB8', fontSize: 9.5, fontWeight: '900' },
  stickyPrimary: { flex: 1, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  stickyPrimaryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
});

