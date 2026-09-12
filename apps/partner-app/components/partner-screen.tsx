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
  children,
  scrollProps,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  artwork?: ImageSourcePropType;
  action?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}>) {
  const { isOffline } = usePartnerNetwork();
  const router = useRouter();
  const [homeSearch, setHomeSearch] = useState('');
  const isHomeHero = eyebrow === 'INSUREIT PARTNER' && !onBack;

  const submitHomeSearch = () => {
    const query = homeSearch.trim();
    if (!query) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query)}` as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        {...scrollProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
      >
        {isHomeHero ? (
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
                  style={styles.homeHeroLogo}
                  resizeMode="contain"
                />
                <View style={styles.homeHeroActions}>{action}</View>
              </View>

              <Text numberOfLines={1} style={styles.homeHeroGreeting}>
                {title}
              </Text>
            </View>

            <View style={styles.homeSearchCard}>
              <Ionicons name="search-outline" size={21} color={partnerTheme.colors.brandStrong} />
              <TextInput
                value={homeSearch}
                onChangeText={setHomeSearch}
                onSubmitEditing={submitHomeSearch}
                placeholder="Search customer, vehicle number or policy no."
                placeholderTextColor="#8B95A8"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.homeSearchInput}
                accessibilityLabel="Search customer, vehicle number or policy number"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search"
                hitSlop={8}
                onPress={submitHomeSearch}
                style={({ pressed }) => [styles.homeSearchAction, pressed && styles.homeSearchPressed]}
              >
                <Text style={styles.homeSearchActionText}>Search</Text>
                <Ionicons name="chevron-forward" size={15} color="#A3ABBA" />
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
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
  networkBanner: { marginBottom: partnerTheme.spacing.sm },

  homeHeroWrap: {
    position: 'relative',
    marginHorizontal: -partnerTheme.spacing.lg,
    marginBottom: 42,
  },
  homeHero: {
    height: 204,
    overflow: 'hidden',
    backgroundColor: '#0755A8',
  },
  homeHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  homeHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 45, 96, 0.08)',
  },
  homeHeroTopRow: {
    position: 'absolute',
    top: 10,
    left: 18,
    right: 16,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeHeroLogo: {
    width: 142,
    height: 54,
  },
  homeHeroActions: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeHeroGreeting: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 22,
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  homeSearchCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: -31,
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DFEA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#102449',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  homeSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    paddingVertical: 0,
    color: partnerTheme.colors.ink,
    fontSize: 14,
  },
  homeSearchAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingLeft: 4,
  },
  homeSearchPressed: { opacity: 0.65 },
  homeSearchActionText: {
    color: '#A1A9B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
