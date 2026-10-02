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
import { Ionicons } from '@expo/vector-icons';
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
                <Image
                  source={require('../assets/insureit-partner-official.png')}
                  style={styles.homeBrandLogo}
                  resizeMode="contain"
                  accessibilityLabel="INSUREIT Partner"
                />
                <View style={styles.homeHeroActions}>{action}</View>
              </View>

              <Text numberOfLines={1} style={styles.homeHeroGreeting}>
                {title}
              </Text>
            </View>

            <View style={styles.homeSearchCard}>
              <Ionicons name="search-outline" size={24} color="#3E269B" />
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
    marginBottom: 40,
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
    position: 'absolute',
    top: 19,
    left: 17,
    right: 17,
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBrandLogo: {
    width: 112,
    height: 52,
  },
  homeHeroActions: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeHeroGreeting: {
    position: 'absolute',
    left: 19,
    right: 18,
    bottom: 27,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  homeSearchCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: -31,
    height: 58,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D7DFEA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#102449',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  homeSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingVertical: 0,
    color: partnerTheme.colors.ink,
    fontSize: 12.5,
  },
  homeSearchClear: {
    width: 26,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeSearchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: '#E4E8EF',
  },
  homeSearchAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingLeft: 1,
  },
  homeSearchPressed: { opacity: 0.65 },
  homeSearchActionText: {
    color: '#9DA6B6',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
