import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
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
  const incomingQuery = searchParam(params.q);
  const [query, setQuery] = useState(incomingQuery || savedUniversalQuery);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [partialError, setPartialError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    savedUniversalQuery = query;
  }, [query]);

  useEffect(() => {
    if (incomingQuery) setQuery(incomingQuery);
  }, [incomingQuery]);

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

  const hasResults = results.customers.length + results.policies.length + results.claims.length > 0;
  const ready = debouncedQuery.trim().length >= 2;
  if (!context) return null;

  const displayName = context.identity.display_name;

  return (
    <PartnerScreen
      eyebrow="INSUREIT PARTNER"
      title={greeting(displayName)}
      action={
        <View style={styles.headerActions}>
          <PartnerIconButton
            icon="time-outline"
            label="View recent activity"
            onPress={() => router.push('/activity')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.avatarTouch, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(displayName)}</Text>
            </View>
          </Pressable>
        </View>
      }
      heroSearch={{
        value: query,
        onChangeText: setQuery,
        onClear: () => setQuery(''),
        placeholder: 'Search customer, vehicle number or policy no.',
      }}
    >

      {partialError ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="warning" message={partialError + ' Available results are shown below.'} />
        </View>
      ) : null}

      {!ready ? (
        <PartnerStateView state="empty" asset={PartnerAssets.navigation.search} title="Search your authorized records" message="Enter at least 2 characters." />
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
    </PartnerScreen>
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

function searchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value?.trim() ?? '';
}

function greeting(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || 'Partner';
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${prefix}, ${firstName}`;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
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

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarTouch: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  pressed: { opacity: 0.76 },
  feedback: { marginTop: 8 },
  artwork: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkImage: { width: 32, height: 32 },
  refreshing: {
    marginTop: 8,
    color: partnerTheme.colors.inkMuted,
    textAlign: 'center',
    ...partnerTheme.typography.meta,
  },
});
