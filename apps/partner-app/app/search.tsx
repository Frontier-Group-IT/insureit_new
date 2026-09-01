import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { listPartnerClaims, type PartnerClaimRow } from '@/lib/claims';
import { listPartnerCustomers, type PartnerCustomerRow } from '@/lib/customers';
import { listPartnerPolicies, type PartnerPolicyRow } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';

let savedUniversalQuery = '';

type SearchResults = {
  customers: PartnerCustomerRow[];
  policies: PartnerPolicyRow[];
  claims: PartnerClaimRow[];
};

const EMPTY_RESULTS: SearchResults = { customers: [], policies: [], claims: [] };

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState(savedUniversalQuery);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [partialError, setPartialError] = useState('');
  const requestIdRef = useRef(0);

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

  const hasResults = results.customers.length + results.policies.length + results.claims.length > 0;
  const ready = debouncedQuery.trim().length >= 2;

  return (
    <PartnerScreen
      eyebrow="SEARCH"
      title="Find across your business"
      action={<PartnerIconButton icon="close" label="Close search" onPress={() => router.back()} />}
    >
      <PartnerSearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Customer, policy, claim, vehicle or insurer"
      />

      {partialError ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="warning" message={partialError + ' Available results are shown below.'} />
        </View>
      ) : null}

      {!ready ? (
        <PartnerStateView state="empty" icon="search-outline" title="Search your authorized records" message="Enter at least 2 characters." />
      ) : loading && !hasResults ? (
        <PartnerStateView state="loading" title="Searching your business" />
      ) : !hasResults ? (
        <PartnerStateView
          state="empty"
          icon="search-outline"
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
                  icon="people-outline"
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
                  icon="document-text-outline"
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
                  icon="shield-outline"
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
      <View style={styles.section}>{children}</View>
    </>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: 'people-outline' | 'document-text-outline' | 'shield-outline';
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Open ' + title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}><Ionicons name={icon} size={18} color={partnerTheme.colors.brand} /></View>
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {badge}
        </View>
        <Text numberOfLines={1} style={styles.subtitle}>{subtitle || 'Record'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#9CA6B5" />
    </Pressable>
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

const styles = StyleSheet.create({
  feedback: { marginTop: 9 },
  section: {
    overflow: 'hidden',
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  body: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  subtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  refreshing: { marginTop: 10, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  pressed: { backgroundColor: partnerTheme.colors.surfaceMuted },
});
