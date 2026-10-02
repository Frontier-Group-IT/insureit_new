import { useState, type PropsWithChildren, type ReactNode } from 'react';
import {
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerTopBar } from '@/components/ui/partner-top-bar';
import { partnerTheme } from '@/lib/theme';
import { usePartnerNetwork } from '@/providers/partner-network-provider';

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
  const [homeSearch, setHomeSearch] = useState('');
  const isHomeHero = eyebrow === 'INSUREIT PARTNER' && !onBack;
  const heroSearchValue = heroSearch?.value ?? homeSearch;
  const setHeroSearchValue = heroSearch?.onChangeText ?? setHomeSearch;

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        {...scrollProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
      >
        {hideTopBar ? null : isHomeHero ? (
          <View style={styles.homeHeroWrap}>
            <View style={styles.homeHero}>
              <Image
                source={require('../assets/figma-dashboard/hero-banner.jpg')}
                style={styles.homeHeroImage}
                resizeMode="cover"
              />
              <View style={styles.homeHeroShade} />

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
                    accessibilityLabel="View recent activity"
                    onPress={() => router.push('/activity')}
                    style={({ pressed }) => [styles.homeHeroIconButton, pressed && styles.homeSearchPressed]}
                  >
                    <Feather name="clock" size={17} color="#FFFFFF" />
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
            </View>

            <View style={styles.homeSearchCard}>
              <Ionicons name="search-outline" size={22} color="#3E269B" />
              <TextInput
                value={heroSearchValue}
                onChangeText={setHeroSearchValue}
                onSubmitEditing={submitHomeSearch}
                placeholder={heroSearch?.placeholder ?? 'Search customer, vehicle number or policy no.'}
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
                <Text style={styles.homeSearchActionText}>Search</Text>
                <Ionicons name="chevron-forward" size={17} color="#A3ABBA" />
              </Pressable>
            </View>
          </View>
        ) : (
          <PartnerTopBar
            title={title}
            eyebrow={eyebrow}
            subtitle={subtitle}
            onBack={onBack}
            backDisabled={backDisabled}
            artwork={artwork}
            action={action}
          />
        )}

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
      </ScrollView>
    </SafeAreaView>
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
  networkBanner: { marginBottom: partnerTheme.spacing.sm },

  homeHeroWrap: {
    position: 'relative',
    marginHorizontal: -partnerTheme.spacing.lg,
    marginBottom: 35,
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
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#001B42',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    left: 16,
    right: 16,
    bottom: 45,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: -0.04,
    textShadowColor: 'rgba(0,0,0,0.20)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  homeSearchCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: -26,
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
    fontWeight: '600',
  },
});
