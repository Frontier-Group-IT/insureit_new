import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ImageSourcePropType,
  type ScrollViewProps,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerRotatingSearchPlaceholder } from '@/components/ui/partner-search-field';
import { PartnerTopBar } from '@/components/ui/partner-top-bar';
import { getPartnerUnreadActivityCount } from '@/lib/engagement';
import { partnerTheme } from '@/lib/theme';
import { usePartnerNetwork } from '@/providers/partner-network-provider';
import { usePartnerSearch } from '@/providers/partner-search-provider';

const PartnerStickyContext = createContext(false);
export const usePartnerStickyVisible = () => useContext(PartnerStickyContext);

export function PartnerScreen({
  title,
  eyebrow,
  subtitle,
  onBack,
  backDisabled,
  artwork,
  action,
  hideTopBar,
  children,
  scrollProps,
  heroSearch,
  homeMotionScrollY,
  stickyHeading,
  stickyControls,
  stickyHeaderNavy = false,
  stickyStartY = 100,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  artwork?: ImageSourcePropType;
  action?: ReactNode;
  hideTopBar?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  /** Retained for existing callers; all PartnerScreen pages now reset on focus. */
  resetScrollOnFocus?: boolean;
  /** Optional native-driven parallax on Home only; does not alter other tabs. */
  homeMotionScrollY?: Animated.Value;
  stickyHeading?: string;
  stickyControls?: ReactNode;
  stickyHeaderNavy?: boolean;
  stickyStartY?: number;
  heroSearch?: {
    value: string;
    onChangeText: (value: string) => void;
    onSubmit?: () => void;
    onClear?: () => void;
    placeholder?: string;
  };
}>) {
  const { isOffline } = usePartnerNetwork();
  const router = useRouter();
  const isFocused = useIsFocused();
  const safeAreaInsets = useSafeAreaInsets();
  const sharedSearch = usePartnerSearch();
  const isHomeHero = eyebrow === 'INSUREIT PARTNER' && !onBack;
  const heroSearchValue = heroSearch?.value ?? sharedSearch.query;
  const setHeroSearchValue = heroSearch?.onChangeText ?? sharedSearch.setQuery;
  const hasHeroSearchValue = heroSearchValue.trim().length > 0;
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [homeSearchFocused, setHomeSearchFocused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const latestScrollY = useRef(0);
  const [showFixedHeader, setShowFixedHeader] = useState(false);
  const updateFixedHeader = (y: number) => {
    if (!stickyHeading && !isHomeHero) return;
    const next = y >= (isHomeHero ? 42 : stickyStartY);
    setShowFixedHeader((previous) => previous === next ? previous : next);
  };

  useFocusEffect(useCallback(() => {
    if (!isHomeHero) return undefined;

    let cancelled = false;
    void getPartnerUnreadActivityCount(100)
      .then((count) => {
        if (!cancelled) setUnreadActivityCount(count);
      })
      .catch(() => {
        if (!cancelled) setUnreadActivityCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [isHomeHero]));

  // Reset the main vertical scroll position whenever this screen regains focus.
  // React Navigation retains tab screens, so an explicit reset is required.
  useFocusEffect(useCallback(() => {
    const reset = () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      latestScrollY.current = 0;
      homeMotionScrollY?.setValue(0);
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [homeMotionScrollY]));

  const submitHomeSearch = () => {
    if (heroSearch?.onSubmit) {
      heroSearch.onSubmit();
      return;
    }

    const query = heroSearchValue.trim();
    if (!query) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query)}` as never);
  };

  const clearHeroSearch = () => {
    if (heroSearch?.onClear) {
      heroSearch.onClear();
      return;
    }
    setHeroSearchValue('');
  };

  const homeSearchControl = (
            <View style={styles.homeSearchCard}>
              <Ionicons name="search-outline" size={22} color="#3E269B" />
              {!homeSearchFocused && !heroSearchValue ? (
                <PartnerRotatingSearchPlaceholder
                  placeholders={['Search customer name...', 'Search vehicle number...', 'Search policy number...']}
                  containerStyle={{ position: 'absolute', left: 42, right: 74, top: 0, bottom: 0, height: '100%', justifyContent: 'center' }}
                  textStyle={{ fontSize: 12, color: '#8B95A8' }}
                />
              ) : null}
              <TextInput
                value={heroSearchValue}
                onFocus={() => setHomeSearchFocused(true)}
                onBlur={() => setHomeSearchFocused(false)}
                onChangeText={setHeroSearchValue}
                onSubmitEditing={submitHomeSearch}
                placeholder={!homeSearchFocused && !heroSearchValue ? '' : (heroSearch?.placeholder ?? 'Search customer, vehicle number or policy no.')}
                placeholderTextColor="#8B95A8"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.homeSearchInput}
                accessibilityLabel="Search customer, vehicle number or policy number"
              />
              {heroSearchValue ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  onPress={clearHeroSearch}
                  style={({ pressed }) => [styles.homeSearchClear, pressed && styles.homeSearchPressed]}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#A3ABBA" />
                </Pressable>
              ) : null}
              <View style={styles.homeSearchDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search"
                hitSlop={8}
                onPress={submitHomeSearch}
                style={({ pressed }) => [styles.homeSearchAction, pressed && styles.homeSearchPressed]}
              >
                <Text style={[styles.homeSearchActionText, hasHeroSearchValue && styles.homeSearchActionTextActive]}>Search</Text>
                <Ionicons name="chevron-forward" size={17} color={hasHeroSearchValue ? '#1765C1' : '#A3ABBA'} />
              </Pressable>
            </View>
  );

  return (
    <PartnerStickyContext.Provider value={showFixedHeader}>
    {isFocused ? <StatusBar style={showFixedHeader && stickyHeaderNavy ? 'light' : 'dark'} /> : null}
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.ScrollView
        ref={scrollRef}
        {...scrollProps}
        scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        onScroll={homeMotionScrollY
          ? Animated.event([{ nativeEvent: { contentOffset: { y: homeMotionScrollY } } }], {
              useNativeDriver: true,
              listener: (event) => {
                const y = (event as { nativeEvent: { contentOffset: { y: number } } }).nativeEvent.contentOffset.y;
                latestScrollY.current = y;
                updateFixedHeader(y);
                scrollProps?.onScroll?.(event as Parameters<NonNullable<ScrollViewProps['onScroll']>>[0]);
              },
            })
          : (event) => {
              latestScrollY.current = event.nativeEvent.contentOffset.y;
              updateFixedHeader(latestScrollY.current);
              scrollProps?.onScroll?.(event);
            }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        stickyHeaderIndices={undefined}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
      >
        {!hideTopBar && isHomeHero ? (
          <View style={styles.homeHeroWrap}>
            <Animated.View style={[styles.homeHero, homeMotionScrollY ? {
              transform: [{ translateY: homeMotionScrollY.interpolate({
                inputRange: [0, 140], outputRange: [0, -22], extrapolate: 'clamp',
              }) }],
            } : null]}>
              <Image
                source={require('../assets/figma-dashboard/hero-banner.jpg')}
                style={styles.homeHeroImage}
                resizeMode="cover"
              />
              <View pointerEvents="none" style={styles.homeHeroShade} />

              <View style={styles.homeHeroTopRow}>
                <View style={styles.homeBrand} accessibilityLabel="INSUREIT Partner">
                  <Image
                    source={require('../assets/insureit-partner-official.png')}
                    style={styles.homeBrandLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.homeBrandCopy}>
                    <Text style={styles.homeBrandName}>insureit</Text>
                    <Text style={styles.homeBrandPartner}>Partner</Text>
                  </View>
                </View>
                <View style={styles.homeHeroActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={unreadActivityCount ? `View recent activity, ${unreadActivityCount} unread` : 'View recent activity'}
                    onPress={() => router.push('/activity')}
                    style={({ pressed }) => [styles.homeHeroIconButton, pressed && styles.homeSearchPressed]}
                  >
                    <Feather name="bell" size={20} color="#FFFFFF" />
                    {unreadActivityCount > 0 ? (
                      <View style={styles.homeHeroBellBadge}>
                        <Text style={styles.homeHeroBellBadgeText}>
                          {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open profile"
                    onPress={() => router.push('/profile')}
                    style={({ pressed }) => [styles.homeHeroAvatar, pressed && styles.homeSearchPressed]}
                  >
                    <Text style={styles.homeHeroAvatarText}>{homeInitials(title)}</Text>
                  </Pressable>
                </View>
              </View>

              <Text numberOfLines={1} style={styles.homeHeroGreeting}>
                {title}
              </Text>
            </Animated.View>

          </View>
        ) : null}
        {!hideTopBar && isHomeHero ? (
          <View style={styles.homeStickySearchWrap}>
            {showFixedHeader ? <View style={styles.homeSearchPlaceholder} /> : homeSearchControl}
          </View>
        ) : null}
        {!hideTopBar && !isHomeHero ? (
          <PartnerTopBar
            title={title}
            eyebrow={eyebrow}
            subtitle={subtitle}
            onBack={onBack}
            backDisabled={backDisabled}
            artwork={artwork}
            action={action}
          />
        ) : null}

        {isOffline ? (
          <View style={styles.networkBanner}>
            <PartnerBanner
              tone="warning"
              title="You're offline"
              message="Available cached information remains visible. Reconnect to refresh or submit changes."
            />
          </View>
        ) : null}
        {children}
      </Animated.ScrollView>
      </SafeAreaView>
      {showFixedHeader && safeAreaInsets.top > 0 ? <View pointerEvents="none" style={[styles.stickyStatusBarShield, stickyHeaderNavy && styles.navyStickyBackground, { height: safeAreaInsets.top }]} /> : null}
      {showFixedHeader && (isHomeHero || (stickyHeading && stickyControls)) ? (
        <View style={[styles.fixedWhiteHeader, stickyHeaderNavy && styles.navyStickyBackground, { top: safeAreaInsets.top }]} pointerEvents="box-none">
          <Text numberOfLines={1} style={[styles.fixedWhiteHeading, stickyHeaderNavy && styles.navyStickyHeading]}>{isHomeHero ? title : stickyHeading}</Text>
          {isHomeHero ? homeSearchControl : stickyControls}
        </View>
      ) : null}
    </View>
    </PartnerStickyContext.Provider>
  );
}

function homeInitials(title: string) {
  const name = title.replace(/^Good\s+(Morning|Afternoon|Evening)\s+/i, '').trim();
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IP';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  content: {
    flexGrow: 1,
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
  stickyStatusBarShield: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', zIndex: 61 },
  fixedWhiteHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 60, backgroundColor: "#FFFFFF", paddingTop: 12, paddingBottom: 10, paddingHorizontal: 10 },
  fixedWhiteHeading: { color: "#153F88", fontSize: 15, lineHeight: 18, fontWeight: "400", marginLeft: 8, marginBottom: 12 },
  navyStickyBackground: { backgroundColor: '#082657' },
  navyStickyHeading: { color: '#FFFFFF' },
  networkBanner: { marginBottom: partnerTheme.spacing.sm },

  homeHeroWrap: {
    position: 'relative',
    marginHorizontal: -partnerTheme.spacing.lg,
    marginBottom: 0,
  },
  homeSearchPlaceholder: { height: 61 },
  homeStickySearchWrap: {
    marginTop: -26,
    marginBottom: 9,
    marginHorizontal: -partnerTheme.spacing.lg,
    height: 61,
    paddingHorizontal: 10,
    backgroundColor: "#F5F7FB",
    // The overlapping search should not create an elevated iOS touch plane
    // over business controls lower in the same scrolling screen.
    zIndex: Platform.OS === 'ios' ? 0 : 10,
    elevation: Platform.OS === 'ios' ? 0 : 5,
  },
  homeHero: {
    height: 174,
    overflow: 'hidden',
    backgroundColor: '#0755A8',
  },
  homeHeroImage: {
    position: 'absolute',
    left: '-5%',
    top: -6,
    width: '110%',
    height: 194,
    opacity: 0.7,
    transform: [{ scale: 1 }],
  },
  homeHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 49, 105, 0.02)',
  },
  homeHeroTopRow: {
    zIndex: 3,
    position: 'absolute',
    top: 30,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '60%',
  },
  homeBrandLogo: {
    width: 30,
    height: 35,
    tintColor: '#FFFFFF',
  },
  homeBrandCopy: {
    justifyContent: 'center',
  },
  homeBrandName: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.08,
  },
  homeBrandPartner: {
    color: '#F5AB2E',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.08,
  },
  homeHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  homeHeroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,33,78,0.72)',
    borderWidth: 1.25,
    borderColor: '#FFFFFF',
  },
  homeHeroBellBadge: {
    position: 'absolute',
    top: -9,
    right: -10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53445',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#7A1020',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  homeHeroBellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  homeHeroAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#001B42',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  homeHeroAvatarText: {
    color: partnerTheme.colors.brandStrong,
    ...partnerTheme.typography.label,
  },
  homeHeroGreeting: {
    zIndex: 3,
    position: 'absolute',
    left: 15,
    bottom: 39,
    maxWidth: '80%',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(3, 41, 88, 0.46)',
    color: '#FFFFFF',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: Platform.OS === 'ios' ? '400' : '700',
    letterSpacing: -0.02,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  homeSearchCard: {
    height: 52,
    paddingLeft: 13,
    paddingRight: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE6F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#173B6C',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  homeSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingVertical: 0,
    color: partnerTheme.colors.ink,
    fontSize: 11.5,
  },
  homeSearchClear: {
    width: 24,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeSearchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: '#CFD9E8',
  },
  homeSearchAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingLeft: 1,
  },
  homeSearchPressed: { opacity: 0.76 },
  homeSearchActionText: {
    color: '#9DA6B6',
    fontSize: 10.5,
    fontWeight: Platform.OS === 'ios' ? '400' : '600',
  },
  homeSearchActionTextActive: {
    color: '#1765C1',
    fontWeight: Platform.OS === 'ios' ? '400' : '800',
  },
});
