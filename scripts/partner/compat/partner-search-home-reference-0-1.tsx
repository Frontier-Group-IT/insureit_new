import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ImageSourcePropType,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerOperationalRow } from '@/components/ui/partner-operational-row';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { listPartnerClaims, type PartnerClaimRow } from '@/lib/claims';
import { listPartnerCustomers, type PartnerCustomerRow } from '@/lib/customers';
import { PartnerAssets } from '@/lib/partner-assets';
import { listPartnerPolicies, type PartnerPolicyRow } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerSession } from '@/providers/partner-session-provider';

let savedUniversalQuery = '';

type SearchResults = {
  customers: PartnerCustomerRow[];
  policies: PartnerPolicyRow[];
  claims: PartnerClaimRow[];
};

const EMPTY_RESULTS: SearchResults = { customers: [], policies: [], claims: [] };

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const { context } = usePartnerSession();
  const incomingQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const [query, setQuery] = useState(() => incomingQuery?.trim() || savedUniversalQuery);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [partialError, setPartialError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!incomingQuery?.trim()) return;
    setQuery(incomingQuery.trim());
  }, [incomingQuery]);

  useEffect(() => {
    savedUniversalQuery = query;
  }, [query]);

  useEffect(() => {
    const search = debouncedQuery.trim();
    const requestId = ++requestIdRef.current;

    if (search.length < 2) {
      setLoading(false);
      setPartialError('');
      setResults(EMPTY_RESULTS);
      return;
    }

    setLoading(true);
    setPartialError('');

    void Promise.allSettled([
      listPartnerCustomers({ search, limit: 6, offset: 0 }),
      listPartnerPolicies({ search, limit: 6, offset: 0, lifecycle: 'all' }),
      listPartnerClaims({ search, limit: 6, offset: 0, state: 'all' }),
    ]).then(([customers, policies, claims]) => {
      if (requestId !== requestIdRef.current) return;

      const failed = [customers, policies, claims].filter((result) => result.status === 'rejected').length;
      setResults({
        customers: customers.status === 'fulfilled' ? customers.value : [],
        policies: policies.status === 'fulfilled' ? policies.value : [],
        claims: claims.status === 'fulfilled' ? claims.value : [],
      });
      setPartialError(failed ? String(failed) + ' search section' + (failed === 1 ? '' : 's') + ' could not be refreshed.' : '');
      setLoading(false);
    });
  }, [debouncedQuery]);

  if (!context) return null;

  const { identity } = context;
  const displayName = identity.display_name.trim() || 'Partner';
  const hasResults = results.customers.length + results.policies.length + results.claims.length > 0;
  const ready = debouncedQuery.trim().length >= 2;

  const submitSearch = () => {
    if (query.trim().length < 2) return;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            source={require('../assets/figma-dashboard/hero-banner.jpg')}
            style={styles.heroBackdrop}
            resizeMode="cover"
          />
          <View style={styles.heroBackdropShade} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroBrand}>
              <Image
                source={require('../assets/insureit-partner-official.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
              <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
                <Text style={styles.heroBrandInsureit}>insureit</Text>
                <Text style={styles.heroBrandPartner}>Partner</Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View recent activity"
                onPress={() => router.push('/activity')}
                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
              >
                <Feather name="clock" size={17} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={({ pressed }) => [styles.heroAvatar, pressed && styles.pressed]}
              >
                <Text style={styles.heroAvatarText}>{initials(identity.display_name)}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heroGreeting}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={styles.heroGreetingText}
            >
              {dayGreeting()} {displayName}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.searchShell}>
            <Feather name="search" size={21} color={partnerTheme.colors.brandStrong} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              placeholder="Search customer, vehicle number or policy number..."
              placeholderTextColor="#7E8BA1"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
              accessibilityLabel="Search customers, vehicles and policies"
            />
            {query.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                hitSlop={8}
              >
                <Feather name="x-circle" size={18} color="#9AA7B8" />
              </Pressable>
            ) : null}
            <View style={styles.searchDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show search results"
              onPress={submitSearch}
              disabled={query.trim().length < 2}
              style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}
            >
              <Text style={[styles.searchActionText, query.trim().length < 2 && styles.searchActionDisabled]}>Search</Text>
              <Feather
                name="chevron-right"
                size={15}
                color={query.trim().length < 2 ? '#B6BFCC' : partnerTheme.colors.brand}
              />
            </Pressable>
          </View>

          <View style={styles.results}>
            {partialError ? (
              <View style={styles.feedback}>
                <PartnerBanner tone="warning" message={partialError + ' Available results are shown below.'} />
              </View>
            ) : null}

            {!ready ? (
              <PartnerStateView
                state="empty"
                asset={PartnerAssets.navigation.search}
                title="Search your authorized records"
                message="Enter at least 2 characters."
              />
            ) : loading && !hasResults ? (
              <PartnerStateView state="loading" title="Searching your business" />
            ) : !hasResults ? (
              <PartnerStateView
                state="empty"
                asset={PartnerAssets.emptyStates.noSearchResults}
                title="No matching records"
                message="Try a customer name, mobile, policy number, vehicle number, claim number or insurer."
              />
            ) : (
              <>
                {results.customers.length ? (
                  <SearchSection title="Customers" count={results.customers.length}>
                    {results.customers.map((row) => (
                      <ResultRow
                        key={row.customer_id}
                        asset={PartnerAssets.navigation.customers}
                        title={row.customer_name}
                        subtitle={[row.customer_code, row.phone, row.city].filter(Boolean).join(' · ') || 'Customer record'}
                        onPress={() => router.push(('/customer/' + row.customer_id) as never)}
                      />
                    ))}
                  </SearchSection>
                ) : null}

                {results.policies.length ? (
                  <SearchSection title="Policies" count={results.policies.length}>
                    {results.policies.map((row) => (
                      <ResultRow
                        key={row.policy_id}
                        asset={PartnerAssets.navigation.policies}
                        title={row.policy_no || row.policy_code || 'Policy'}
                        subtitle={[row.customer_name, row.vehicle_no || row.insurer_name].filter(Boolean).join(' · ')}
                        badge={<PartnerStatusBadge label={humanize(row.lifecycle_status)} tone={policyTone(row.lifecycle_status)} />}
                        onPress={() => router.push(('/policy/' + row.policy_id) as never)}
                      />
                    ))}
                  </SearchSection>
                ) : null}

                {results.claims.length ? (
                  <SearchSection title="Claims" count={results.claims.length}>
                    {results.claims.map((row) => (
                      <ResultRow
                        key={row.claim_id}
                        asset={row.claim_state === 'completed' ? PartnerAssets.status.verified : PartnerAssets.navigation.claims}
                        title={row.claim_no || row.insurer_claim_no || 'Claim'}
                        subtitle={[row.customer_name, row.vehicle_no || row.policy_no].filter(Boolean).join(' · ')}
                        badge={<PartnerStatusBadge label={humanize(row.current_status || row.claim_state)} tone={row.claim_state === 'completed' ? 'success' : 'warning'} />}
                        onPress={() => router.push(('/claim/' + row.claim_id) as never)}
                      />
                    ))}
                  </SearchSection>
                ) : null}

                {loading ? <Text style={styles.refreshing}>Refreshing results…</Text> : null}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SearchSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <>
      <PartnerSectionHeader title={title} meta={String(count) + ' shown'} />
      <View>{children}</View>
    </>
  );
}

function ResultRow({
  asset,
  title,
  subtitle,
  badge,
  onPress,
}: {
  asset: ImageSourcePropType;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onPress: () => void;
}) {
  return (
    <PartnerOperationalRow
      title={title}
      subtitle={subtitle || 'Record'}
      status={badge}
      leading={
        <View style={styles.artwork}>
          <Image source={asset} style={styles.artworkImage} resizeMode="contain" />
        </View>
      }
      onPress={onPress}
      accessibilityLabel={'Open ' + title}
      dense
    />
  );
}

function policyTone(value: PartnerPolicyRow['lifecycle_status']): 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'expired') return 'danger';
  if (value === 'expiring') return 'warning';
  if (value === 'upcoming') return 'info';
  return 'success';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IP';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  scroll: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { paddingBottom: 104 },
  pressed: { opacity: 0.78 },

  hero: { height: 158, overflow: 'hidden', backgroundColor: '#0757AE', paddingTop: 30 },
  heroBackdrop: { position: 'absolute', left: '-6%', top: -8, width: '112%', height: 182, opacity: 0.70, transform: [{ scale: 0.92 }] },
  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,42,93,0.03)' },
  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },
  heroBrandCopy: { paddingTop: 1 },
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroIconButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,58,120,0.34)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)' },
  heroAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },
  heroAvatarText: { color: '#144E98', fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  heroGreeting: { zIndex: 2, position: 'absolute', left: 16, right: 82, bottom: 24 },
  heroGreetingText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: -0.04, textShadowColor: 'rgba(0,0,0,0.20)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  body: { marginTop: -10, paddingHorizontal: 16 },
  searchShell: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, color: partnerTheme.colors.ink, fontSize: 11.5, lineHeight: 16 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: '#E0E6EF' },
  searchAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 1 },
  searchActionText: { color: partnerTheme.colors.brand, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  searchActionDisabled: { color: '#B6BFCC' },

  results: { marginTop: 10 },
  feedback: { marginBottom: 8 },
  artwork: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  artworkImage: { width: 32, height: 32 },
  refreshing: { marginTop: 8, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
