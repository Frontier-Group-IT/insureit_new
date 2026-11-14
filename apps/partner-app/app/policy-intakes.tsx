import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { listPartnerPolicyIntakesPage, type PartnerPolicyIntake, type PartnerIntakeFilter, type PartnerIntakeCounts } from '@/lib/policy-intakes';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';
import { partnerTheme } from '@/lib/theme';
import { PartnerAssets } from '@/lib/partner-assets';

type IntakeFilter = PartnerIntakeFilter;

const FILTERS: Array<{ key: IntakeFilter; label: string }> = [
  { key: 'action_required', label: 'Action Required' },
  { key: 'in_review', label: 'In Review' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const EMPTY_SUBMISSION_COPY: Record<IntakeFilter, { title: string; message: string; icon: 'checkmark-done-outline' | 'time-outline' | 'sync-outline' | 'checkmark-circle-outline' | 'copy-outline' | 'close-circle-outline' | 'document-text-outline' }> = {
  action_required: { title: 'No action required', message: "You're all caught up! No submissions need your attention.", icon: 'checkmark-done-outline' },
  in_review: { title: 'No submissions in review', message: 'Submissions awaiting review will appear here.', icon: 'time-outline' },
  processing: { title: 'Nothing processing right now', message: 'Processing submissions will appear here.', icon: 'sync-outline' },
  completed: { title: 'No completed submissions yet', message: 'Completed submissions will appear here.', icon: 'checkmark-circle-outline' },
  duplicate: { title: 'No duplicate submissions', message: 'Duplicate submissions will appear here.', icon: 'copy-outline' },
  rejected: { title: 'No rejected submissions', message: 'Rejected submissions will appear here.', icon: 'close-circle-outline' },
  all: { title: 'No policy submissions yet', message: 'Create an intake when you have a policy copy to submit.', icon: 'document-text-outline' },
};

export default function PolicyIntakesScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  const mainScrollRef = useRef<ScrollView>(null);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => { if (mounted) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useFocusEffect(useCallback(() => {
    const reset = () => mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<IntakeFilter>('action_required');
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [counts, setCounts] = useState<PartnerIntakeCounts>({ action_required: 0, in_review: 0, processing: 0, completed: 0, duplicate: 0, rejected: 0, all: 0 });
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const requestGeneration = useRef(0);
  const pageLoadingRef = useRef(false);

  const load = useCallback(async (manual = false, background = false) => {
    const generation = ++requestGeneration.current;
    if (manual) setRefreshing(true);
    else if (!background) setLoading(true);
    setError('');
    setPageError('');
    pageLoadingRef.current = false;
    if (!manual && !background) setRows([]);
    try {
      const page = await listPartnerPolicyIntakesPage(0, filter, debouncedQuery, true);
      if (generation !== requestGeneration.current) return;
      setRows(page.intakes);
      if (page.counts) setCounts(page.counts);
      setTotal(page.total);
      setNextOffset(page.intakes.length);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : 'Policy Intakes could not be loaded.');
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [filter, debouncedQuery]);

  const loadMore = useCallback(async () => {
    if (pageLoadingRef.current || loading || refreshing || nextOffset >= total) return;
    pageLoadingRef.current = true;
    setLoadingMore(true);
    setPageError('');
    const generation = requestGeneration.current;
    try {
      const page = await listPartnerPolicyIntakesPage(nextOffset, filter, debouncedQuery, false);
      if (generation !== requestGeneration.current) return;
      if (!page.intakes.length && nextOffset < (page.total ?? 0)) {
        throw new Error('More submissions could not be loaded. Try again.');
      }
      setRows((previous) => {
        const ids = new Set(previous.map((row) => row.id));
        return [...previous, ...page.intakes.filter((row) => !ids.has(row.id))];
      });
      setNextOffset(nextOffset + page.intakes.length);
      setTotal(page.total);
    } catch (cause) {
      if (generation === requestGeneration.current) {
        setPageError(cause instanceof Error ? cause.message : 'More submissions could not be loaded.');
      }
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
      if (generation === requestGeneration.current) pageLoadingRef.current = false;
    }
  }, [loading, refreshing, nextOffset, total, filter, debouncedQuery]);

  useFocusEffect(useCallback(() => {
    void load(false);
    const refreshInterval = setInterval(() => void load(false, true), 60_000);
    return () => {
      clearInterval(refreshInterval);
      requestGeneration.current += 1;
    };
  }, [load]));

  // The API has already applied the selected status and search to the full authorized dataset.
  const visibleRows = rows;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerOrbLarge} />
        <View style={styles.headerOrbSmall} />
        <View style={styles.titleIcon}><Ionicons name="document-text" size={21} color="#FFFFFF" /></View>
        <View style={styles.titleCopy}>
          <Text style={styles.eyebrow}>POLICY INTAKE</Text>
          <Text style={styles.title}>My Submissions</Text>
        </View>
        {canPartnerAccess(context, 'create_policy_intakes', 'edit') ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Create new policy intake" onPress={() => router.push('/policy-intake-new')} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={17} color="#FFFFFF" />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
        ) : null}
      </View>

      <View style={styles.searchBand}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Ionicons name="search-outline" size={17} color="#8A98AC" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search by PIR number, customer, insurer or source"
            placeholderTextColor="#9AA5B5"
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={17} color="#A3ADBB" /></Pressable> : null}
        </View>
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filtersContent}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <MotionFilterChip key={item.key} active={active} reduceMotion={reduceMotion} onPress={() => setFilter(item.key)} label={item.label} count={counts[item.key]} />
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all Policy Intake statuses"
          onPress={() => setShowAllStatuses(true)}
          style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
        >
          <Ionicons name="list" size={17} color="#0860C8" />
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>

      <Modal
        visible={showAllStatuses}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllStatuses(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close status selection"
            onPress={() => setShowAllStatuses(false)}
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select status</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close status selection"
                onPress={() => setShowAllStatuses(false)}
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={20} color="#53647D" />
              </Pressable>
            </View>
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    setFilter(item.key);
                    setShowAllStatuses(false);
                  }}
                  style={({ pressed }) => [styles.sheetOption, selected && styles.sheetOptionSelected, pressed && styles.pressed]}
                >
                  <View style={[styles.sheetRadio, selected && styles.sheetRadioSelected]}>
                    {selected ? <View style={styles.sheetRadioDot} /> : null}
                  </View>
                  <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}>{item.label}</Text>
                  <Text style={styles.sheetOptionCount}>{counts[item.key]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={mainScrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, !loading && !error && visibleRows.length === 0 && styles.emptyContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={partnerTheme.colors.brand} colors={[partnerTheme.colors.brand]} />}
      >
        {loading && !rows.length ? (
          <PolicyIntakeSkeletonList />
        ) : error && !rows.length ? (
          <PartnerStateView state="error" title="Policy Intakes unavailable" message={error} actionLabel="Try again" onAction={() => void load(true)} />
        ) : visibleRows.length ? (
          <>
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            {visibleRows.map((row, index) => (
              <MotionCard key={row.id} index={index} reduceMotion={reduceMotion}>
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={`Open Policy Intake ${row.intake_number}. ${statusLabel(row)}`}
                onPress={() => router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } })}
                style={({ pressed }) => [styles.card, cardStatusBorder(row), pressed && styles.pressedCard, pressed && styles.cardPressScale]}
              >
                <View style={styles.rowTop}>
                  <IntakeRecordLogo row={row} />
                  <View style={styles.identity}>
                    <View style={styles.intakeNumberRow}>
                      <Text numberOfLines={1} style={styles.number}>{field(row, 'policy_number') || 'Policy pending'}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.customer}>{[row.customer_mobile, field(row, 'insured_name') || field(row, 'customer_name') || field(row, 'name_of_insured')].filter(Boolean).join(' · ')}</Text>
                    <Text numberOfLines={1} style={styles.metaLine}>{`${row.lead_source_name || 'Lead source unavailable'} (${row.submitted_by_name?.trim() || 'Submitter unavailable'})`}</Text>
                  </View>
                  <View style={styles.statusStack}>
                    <StatusZoomPulse enabled={row.status === 'completed' || row.status === 'ready_for_review' || row.status === 'in_review' || row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')} reduceMotion={reduceMotion}>
                    {row.status === 'ready_for_review' || row.status === 'in_review' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open Policy Intake ${row.intake_number}. ${statusLabel(row)}`}
                        onPress={(event) => {
                          event.stopPropagation();
                          router.push({ pathname: '/policy-intakes/[id]', params: { id: row.id } });
                        }}
                        style={({ pressed }) => [
                          styles.openStatusButton,
                          row.status === 'ready_for_review' ? styles.openStatusReady : styles.openStatusInReview,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.openStatusText}>{statusLabel(row)}</Text>
                        <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
                      </Pressable>
                    ) : (
                      statusTone(row) === 'warning' ? (
                        <Text
                          accessibilityRole="text"
                          accessibilityLabel={statusLabel(row)}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={styles.actionRequiredBadge}
                        >
                          {statusLabel(row)}
                        </Text>
                      ) : (
                        <PartnerStatusBadge label={statusLabel(row)} tone={statusTone(row)} />
                      )
                    )}
                    </StatusZoomPulse>
                    {row.ocr_status === 'failed' && (row.status === 'processing' || row.status === 'needs_attention') ? (
                      <View style={styles.ocrWarning} accessibilityLabel="OCR extraction failed">
                        <Ionicons name="alert-circle-outline" size={11} color="#B66B0B" />
                        <Text style={styles.ocrWarningText}>OCR failed</Text>
                      </View>
                    ) : null}
                    <Text style={styles.updatedDate}>{formatDate(row.updated_at || row.created_at)}</Text>
                  </View>
                </View>

                {filter === 'all' ? <IntakeProgress row={row} reduceMotion={reduceMotion} /> : null}

                {row.attention_reason ? (
                  <View style={styles.attention}>
                    <Ionicons name="alert-circle-outline" size={16} color="#B66B0B" />
                    <Text numberOfLines={2} style={styles.attentionText}>{row.attention_reason}</Text>
                  </View>
                ) : null}

              </Pressable>
              </MotionCard>
            ))}
          </>
        ) : (
          <View style={styles.compactEmpty} accessibilityLiveRegion="polite">
            <Image
              source={debouncedQuery ? PartnerAssets.emptyStates.noSearchResults : PartnerAssets.emptyStates.noPolicies}
              style={styles.emptyIllustrationImage}
              resizeMode="contain"
              accessibilityLabel={debouncedQuery ? 'No search results illustration' : 'No policy submissions illustration'}
            />
            <Text style={styles.compactEmptyTitle}>
              {debouncedQuery ? 'No matching submissions' : EMPTY_SUBMISSION_COPY[filter].title}
            </Text>
            <Text style={styles.compactEmptyMessage}>
              {debouncedQuery ? 'Try a different search term or filter.' : EMPTY_SUBMISSION_COPY[filter].message}
            </Text>
            {!debouncedQuery && filter === 'all' && canPartnerAccess(context, 'create_policy_intakes', 'edit') ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create first policy intake"
                onPress={() => router.push('/policy-intake-new')}
                style={({ pressed }) => [styles.emptyCreateButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={15} color="#3156B8" />
                <Text style={styles.emptyCreateText}>Create first intake</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {visibleRows.length > 0 && nextOffset < total ? (
          <View style={styles.pagination}>
            {pageError ? <Text style={styles.pageError}>{pageError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={loadingMore ? 'Loading more submissions' : pageError ? 'Retry loading more submissions' : 'Load More Submissions'}
              accessibilityState={{ disabled: loadingMore || loading || refreshing, busy: loadingMore }}
              disabled={loadingMore || loading || refreshing}
              onPress={() => void loadMore()}
              style={({ pressed }) => [
                styles.loadMoreButton,
                loadingMore && styles.loadMoreButtonLoading,
                pressed && !loadingMore && styles.pressed,
              ]}
            >
              {loadingMore ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loadMoreTextLoading}>Loading more submissions…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.loadMoreText}>{pageError ? 'Retry Load More' : 'Load More Submissions'}</Text>
                  <Feather name="chevron-down" size={13} color="#3156B8" />
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomNav}>
        <NavItem icon="home-outline" label="Home" onPress={() => router.push('/(tabs)' as never)} />
        <NavItem icon="briefcase-outline" label="Business" onPress={() => router.push('/(tabs)/business' as never)} />
        <NavItem icon="document-text" label="Policies" active onPress={() => router.push('/(tabs)/policies' as never)} />
        <NavItem icon="shield-checkmark-outline" label="Claims" onPress={() => router.push('/(tabs)/claims' as never)} />
        <NavItem icon="grid-outline" label="More" onPress={() => router.push('/(tabs)/more' as never)} />
      </View>
    </SafeAreaView>
  );
}

function MotionFilterChip({ active, reduceMotion, onPress, label, count }: { active: boolean; reduceMotion: boolean; onPress: () => void; label: string; count: number }) {
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    selection.stopAnimation();
    if (reduceMotion) selection.setValue(active ? 1 : 0);
    else Animated.timing(selection, { toValue: active ? 1 : 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => selection.stopAnimation();
  }, [active, reduceMotion, selection]);
  return (
    <Animated.View style={[styles.filterChip, {
      backgroundColor: selection.interpolate({ inputRange: [0, 1], outputRange: ['#F7F8FB', '#183864'] }),
      borderColor: selection.interpolate({ inputRange: [0, 1], outputRange: ['#E0E5ED', '#183864'] }),
    }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterChipPress, pressed && styles.pressed]}>
        <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
        <Text style={[styles.filterCount, active && styles.filterCountActive]}>({count})</Text>
      </Pressable>
    </Animated.View>
  );
}

// Keep the status pill compact. Only the three actionable/success states receive a
// gentle zoom for Ready, In Review, Completed and Action Required (including OCR failure); other badges and the timestamp never move.
function StatusZoomPulse({ enabled, reduceMotion, children }: { enabled: boolean; reduceMotion: boolean; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  useFocusEffect(useCallback(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!enabled || reduceMotion) return () => scale.setValue(1);
    const pulse = Animated.loop(Animated.sequence([
      Animated.delay(1350),
      Animated.timing(scale, { toValue: 1.045, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start();
    return () => { pulse.stop(); scale.stopAnimation(); scale.setValue(1); };
  }, [enabled, reduceMotion, scale]));
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function MotionCard({ index, reduceMotion, children }: { index: number; reduceMotion: boolean; children: ReactNode }) {
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const rise = useRef(new Animated.Value(reduceMotion ? 0 : 9)).current;
  useEffect(() => {
    entrance.stopAnimation(); rise.stopAnimation();
    if (reduceMotion) { entrance.setValue(1); rise.setValue(0); return; }
    entrance.setValue(0); rise.setValue(9);
    Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 260, delay: Math.min(index, 7) * 42, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 260, delay: Math.min(index, 7) * 42, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    return () => { entrance.stopAnimation(); rise.stopAnimation(); };
  }, [entrance, rise, reduceMotion, index]);
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: rise }] }}>{children}</Animated.View>;
}

function cardStatusBorder(row: PartnerPolicyIntake) {
  if (row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')) return styles.cardNeedsAttention;
  if (row.status === 'rejected') return styles.cardRejected;
  if (row.status === 'duplicate') return styles.cardDuplicate;
  if (row.status === 'completed') return styles.cardCompleted;
  if (row.status === 'in_review') return styles.cardInReview;
  return null;
}

function IntakeRecordLogo({ row }: { row: PartnerPolicyIntake }) {
  // Action Required takes precedence over insurer/manufacturer artwork so that
  // an OCR failure or reviewer attention is unmistakable in My Submissions.
  if (row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')) {
    return (
      <View style={[styles.rowArtwork, styles.rowArtworkAttention]}>
        <Image
          source={PartnerAssets.status.warning}
          accessibilityLabel="Action required warning icon"
          resizeMode="contain"
          style={styles.rowAttentionImage}
        />
      </View>
    );
  }
  const insurerName = field(row, 'insurer_name');
  const manufacturerName = field(row, 'vehicle_make');
  const manufacturerSource = getPartnerManufacturerLogoSource(manufacturerName);

  if (insurerName || manufacturerSource) {
    return (
      <View style={styles.rowArtwork}>
        <PartnerInsurerLogo
          name={insurerName || null}
          fallback={manufacturerSource}
          accessibilityLabel={insurerName ? `${insurerName} insurer` : `${manufacturerName || 'Vehicle'} manufacturer`}
          style={styles.rowArtworkImage}
        />
      </View>
    );
  }

  return (
    <View style={styles.rowArtwork}>
      <Ionicons name="document-text-outline" size={24} color="#4774A8" />
    </View>
  );
}

/** Compact loading placeholders matching My Submissions cards. */
function PolicyIntakeSkeletonList() {
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading Policy Intakes" accessibilityRole="progressbar">
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} style={styles.skeletonCard} importantForAccessibility="no-hide-descendants">
          <View style={styles.skeletonLogo} />
          <View style={styles.skeletonDetails}>
            <View style={styles.skeletonTitleLine} />
            <View style={styles.skeletonCustomerLine} />
            <View style={styles.skeletonSourceLine} />
          </View>
          <View style={styles.skeletonStatus} />
        </View>
      ))}
    </View>
  );
}

function IntakeProgress({ row, reduceMotion }: { row: PartnerPolicyIntake; reduceMotion: boolean }) {
  const manual = row.status === 'processing' && row.ocr_status === 'failed';
  const activeStep = row.status === 'completed' ? 4 : row.status === 'in_review' ? 3 : row.status === 'ready_for_review' || row.status === 'needs_attention' || manual ? 2 : 1;
  const rejected = row.status === 'rejected' || row.status === 'duplicate';
  const progressEntrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    progressEntrance.stopAnimation();
    if (reduceMotion) progressEntrance.setValue(1);
    else { progressEntrance.setValue(0); Animated.timing(progressEntrance, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }
    return () => progressEntrance.stopAnimation();
  }, [progressEntrance, reduceMotion]);
  return (
    <View style={styles.progressWrap}>
      {['Uploaded', 'RTO', 'Review', 'Done'].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        return (
          <View key={label} style={styles.progressStep}>
            <View style={styles.progressLineWrap}>
              <View style={[styles.progressDot, complete && styles.progressDotComplete, rejected && step === activeStep && styles.progressDotRejected]}>
                {complete && step < activeStep ? <Ionicons name="checkmark" size={9} color="#FFFFFF" /> : null}
              </View>
              {index < 3 ? <Animated.View style={[styles.progressLine, step < activeStep && !rejected && styles.progressLineComplete, step < activeStep && !rejected && { opacity: progressEntrance, transform: [{ scaleX: progressEntrance }] }]} /> : null}
            </View>
            <Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function NavItem({ icon, label, active = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><Ionicons name={icon} size={19} color={active ? '#633DF1' : '#60738F'} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>;
}

function field(row: PartnerPolicyIntake, key: string) { return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || ''; }

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Action Required';
  return ({ processing: 'Processing', ready_for_review: 'Ready', in_review: 'In Review', needs_attention: 'Action Required', completed: 'Completed', duplicate: 'Duplicate', rejected: 'Rejected' } as Record<string, string>)[row.status] || humanize(row.status);
}

function statusTone(row: PartnerPolicyIntake): 'success' | 'warning' | 'danger' | 'info' {
  if (row.status === 'completed') return 'success';
  if (row.status === 'rejected' || row.status === 'duplicate') return 'danger';
  if (row.status === 'needs_attention' || (row.status === 'processing' && row.ocr_status === 'failed')) return 'warning';
  return 'info';
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { height: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#0860C8' },
  headerOrbLarge: { position: 'absolute', right: -38, top: -52, width: 170, height: 130, borderRadius: 90, backgroundColor: '#0D74E3', opacity: 0.9 },
  headerOrbSmall: { position: 'absolute', right: 95, top: -25, width: 85, height: 85, borderRadius: 45, backgroundColor: '#096BD7', opacity: 0.8 },
  titleIcon: { width: 31, height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.16)' },
  titleCopy: { flex: 1 }, eyebrow: { color: '#D5E9FF', fontSize: 7.5, lineHeight: 9, letterSpacing: 0.85, fontWeight: '800' }, title: { marginTop: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontWeight: '800' },
  newButton: { minWidth: 65, height: 34, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#183864' }, newButtonText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  searchBand: { paddingHorizontal: 11, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', backgroundColor: '#0860C8' }, searchBox: { flex: 1, minHeight: 38, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'transparent' }, searchBoxFocused: { borderColor: '#B7D8FF', shadowColor: '#FFFFFF', shadowOpacity: 0.28, shadowRadius: 5, elevation: 2 }, searchInput: { flex: 1, paddingVertical: 0, color: '#1F314C', fontSize: 10.5, lineHeight: 14 },
  filtersWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE4EF', backgroundColor: '#FFFFFF' }, filterScroll: { flex: 1 }, seeAllButton: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingHorizontal: 12, marginRight: 9, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4EBF5', backgroundColor: '#FFFFFF', shadowColor: '#1B416C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 }, seeAllText: { color: '#0860C8', fontSize: 12, fontWeight: '700' }, filtersContent: { paddingHorizontal: 10, paddingVertical: 7, gap: 7 }, filterChip: { minHeight: 31, borderRadius: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E5ED' }, filterChipActive: { backgroundColor: '#183864', borderColor: '#183864' }, filterChipPress: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 31 }, filterLabel: { color: '#4D5D75', fontSize: 9.2, lineHeight: 12, fontWeight: '700' }, filterLabelActive: { color: '#FFFFFF' }, filterCount: { color: '#728099', fontSize: 8.5, lineHeight: 11, fontWeight: '700' }, filterCountActive: { color: '#DDEAFF' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' }, sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,23,45,0.46)' }, sheet: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF' }, sheetHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }, sheetTitle: { color: '#172B49', fontSize: 15, fontWeight: '800' }, sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, sheetOption: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E9F2', paddingHorizontal: 6 }, sheetOptionSelected: { backgroundColor: '#F1F6FF' }, sheetRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#A7B5C8', alignItems: 'center', justifyContent: 'center' }, sheetRadioSelected: { borderColor: '#3156B8' }, sheetRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3156B8' }, sheetOptionText: { flex: 1, color: '#34465E', fontSize: 12, fontWeight: '600' }, sheetOptionTextSelected: { color: '#193C79', fontWeight: '800' }, sheetOptionCount: { color: '#6C7B90', fontSize: 11, fontWeight: '700' },
  skeletonList: { gap: 8, paddingHorizontal: 3, paddingTop: 5, paddingBottom: 14 },
  skeletonCard: { height: 67, borderRadius: 12, borderWidth: 1, borderColor: '#E3EAF3', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 11 },
  skeletonLogo: { height: 40, width: 40, borderRadius: 8, backgroundColor: '#EDEFF3' },
  skeletonDetails: { flex: 1, justifyContent: 'center', gap: 6 },
  skeletonTitleLine: { width: '62%', height: 8, borderRadius: 4, backgroundColor: '#EDEFF3' },
  skeletonCustomerLine: { width: '82%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonSourceLine: { width: '68%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonStatus: { height: 24, width: 54, borderRadius: 7, backgroundColor: '#EDEFF3' },
  emptyContent: { flexGrow: 1 },
  compactEmpty: { flex: 1, minHeight: 250, marginHorizontal: 8, paddingHorizontal: 18, paddingVertical: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIllustrationImage: { width: 180, height: 180, maxWidth: '100%', marginBottom: 2 },
  compactEmptyTitle: { color: '#1A3050', fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  compactEmptyMessage: { color: '#72809A', fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 280 },
  emptyCreateButton: { marginTop: 7, minHeight: 35, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#C7D9F8', backgroundColor: '#F0F5FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  emptyCreateText: { color: '#3156B8', fontSize: 11, fontWeight: '700' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 9, paddingTop: 9, paddingBottom: 12, gap: 8 },
  pagination: { paddingHorizontal: 6, paddingTop: 8, paddingBottom: 12, gap: 8 },
  pageError: { color: partnerTheme.colors.danger, fontSize: 11, textAlign: 'center' },
  loadMoreButton: { marginHorizontal: 12, marginTop: 5, minHeight: 36, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: '#F1F5FD' },
  loadMoreButtonLoading: { backgroundColor: '#3156B8' },
  loadMoreText: { color: '#3156B8', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  loadMoreTextLoading: { color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontWeight: '800' },
  inlineError: { marginBottom: 5, color: partnerTheme.colors.danger, textAlign: 'center', fontSize: 10 },
  card: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E7F0', shadowColor: '#0B2447', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, pressedCard: { opacity: 0.85 }, cardPressScale: { transform: [{ scale: 0.985 }] }, cardNeedsAttention: { borderColor: '#EBCB83' }, cardRejected: { borderColor: '#F0C5C5' }, cardDuplicate: { borderColor: '#CCD3DD' }, cardCompleted: { borderColor: '#B9DDCE' }, cardInReview: { borderColor: '#D2C7F9' }, rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, rowArtwork: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F7FC' }, rowArtworkImage: { width: 31, height: 31 }, rowArtworkAttention: { backgroundColor: 'transparent' }, rowAttentionImage: { width: 31, height: 31 }, actionRequiredBadge: { maxWidth: 92, alignSelf: 'flex-end', overflow: 'hidden', borderRadius: 14, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: partnerTheme.colors.warningSoft, color: '#9A5B12', fontSize: 8, lineHeight: 11, fontWeight: '800', textAlign: 'center' }, identity: { flex: 1, minWidth: 0 }, intakeNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, ocrWarning: { flexDirection: 'row', alignItems: 'center', gap: 2 }, ocrWarningText: { color: '#B66B0B', fontSize: 7.5, fontWeight: '700' }, statusStack: { maxWidth: 92, alignItems: 'flex-end', gap: 4 }, openStatusButton: { minHeight: 25, alignSelf: 'flex-end', paddingHorizontal: 7, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }, openStatusReady: { backgroundColor: '#1763C5' }, openStatusInReview: { backgroundColor: '#6746D8' }, openStatusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', lineHeight: 12 }, updatedDate: { color: '#7B8799', fontSize: 7, lineHeight: 9, textAlign: 'right' }, number: { color: '#1D2C45', fontSize: 11, lineHeight: 14, fontWeight: '800' }, customer: { marginTop: 2, color: '#687A92', fontSize: 8.5, lineHeight: 11 }, metaLine: { marginTop: 4, color: '#8290A3', fontSize: 8, lineHeight: 10.5 },
  progressWrap: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start' }, progressStep: { flex: 1, alignItems: 'center' }, progressLineWrap: { width: '100%', minHeight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, progressDot: { width: 10, height: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE2EC' }, progressDotComplete: { backgroundColor: '#6541F4' }, progressDotRejected: { backgroundColor: '#EA625C' }, progressLine: { position: 'absolute', left: '57%', width: '86%', height: 1.5, backgroundColor: '#DCE2EC' }, progressLineComplete: { backgroundColor: '#6541F4' }, progressLabel: { marginTop: 3, color: '#7D899B', fontSize: 7.5, lineHeight: 10, fontWeight: '500' }, progressLabelActive: { color: '#23344E', fontWeight: '600' },
  attention: { marginTop: 8, minHeight: 28, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3DF' }, attentionText: { flex: 1, color: '#9B5C10', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },
  bottomNav: { height: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE3EC', backgroundColor: '#FFFFFF' }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIconWrap: { minWidth: 36, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconWrapActive: { backgroundColor: '#EEE9FF' }, navLabel: { marginTop: 1, color: '#60738F', fontSize: 7.5, lineHeight: 10, fontWeight: '600' }, navLabelActive: { color: '#633DF1', fontWeight: '800' }, pressed: { opacity: 0.7 },
});