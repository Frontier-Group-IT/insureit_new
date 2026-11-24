import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import {
  getPartnerRenewalSummary,
  listPartnerRenewals,
  type PartnerRenewalBucket,
  type PartnerRenewalMode,
  type PartnerRenewalRow,
  type PartnerRenewalSummary,
} from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type DueDateSort = 'asc' | 'desc';

type SummarySelection = {
  eyebrow: string;
  premium: number | string;
  count: number;
};

const PAGE_SIZE = 10;
let savedRenewalMode: PartnerRenewalMode = 'expiring';
let savedRenewalQuery = '';

export default function RenewalsScreen() {
  const router = useRouter();
  const motion = useRenewalMotion();
  const [tabWidth, setTabWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const sortAnchorRef = useRef<View>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });
  const { cacheScopeKey } = usePartnerSession();
  const [mode, setMode] = useState<PartnerRenewalMode>(savedRenewalMode);
  const [bucket, setBucket] = useState<PartnerRenewalBucket>(savedRenewalMode === 'expired' ? 'overdue' : 'all');
  const [query, setQuery] = useState(savedRenewalQuery);
  const [sortDirection, setSortDirection] = useState<DueDateSort>('asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [requestedLimit, setRequestedLimit] = useState(PAGE_SIZE);
  const [loadMoreFeedback, setLoadMoreFeedback] = useState(false);
  const loadMoreStartedAt = useRef(0);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setRequestedLimit(PAGE_SIZE);
    setLoadMoreFeedback(false);
  }, [mode, bucket, debouncedSearch]);

  useEffect(() => {
    savedRenewalMode = mode;
    savedRenewalQuery = query;
  }, [mode, query]);

  const fetchSummary = useCallback(() => getPartnerRenewalSummary(), []);
  const summary = usePartnerQuery<PartnerRenewalSummary>({
    scopeKey: cacheScopeKey,
    key: 'renewals:summary',
    fetcher: fetchSummary,
    staleTimeMs: 90_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerRenewals({ mode, bucket, search: debouncedSearch, limit, offset });
    return { rows: nextRows, total: nextRows[0]?.total_count ?? 0 };
  }, [bucket, debouncedSearch, mode]);

  const collection = usePartnerPageQuery<PartnerRenewalRow>({
    scopeKey: cacheScopeKey,
    key: `renewals:list:${mode}:${bucket}:${debouncedSearch || 'all'}:limit:${visibleLimit}`,
    pageSize: visibleLimit,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const sortedRows = useMemo(() => [...collection.rows].sort((a, b) => {
    const aTime = expirySortValue(a.end_date, sortDirection);
    const bTime = expirySortValue(b.end_date, sortDirection);
    return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
  }), [collection.rows, sortDirection]);

  useEffect(() => {
    if (!loadMoreFeedback) return;
    const reachedRequestedSize = collection.rows.length >= requestedLimit ||
      (collection.total > 0 && collection.rows.length >= collection.total);
    if ((collection.loading || collection.changingPage || !reachedRequestedSize) && !collection.error) return;
    const elapsed = Date.now() - loadMoreStartedAt.current;
    const timer = setTimeout(() => setLoadMoreFeedback(false), Math.max(0, 600 - elapsed));
    return () => clearTimeout(timer);
  }, [collection.rows.length, collection.total, collection.loading, collection.changingPage, collection.error, loadMoreFeedback, requestedLimit]);

  const selectedSummary = useMemo(
    () => resolveSummarySelection(summary.data, mode, bucket),
    [bucket, mode, summary.data],
  );

  const indicator = useRef(new Animated.Value(mode === 'expired' ? 1 : 0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(indicator, { toValue: mode === 'expired' ? 1 : 0, duration: motion ? 240 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start(); return () => a.stop();
  }, [mode, motion, indicator]);
  useEffect(() => {
    const a = Animated.timing(arrow, { toValue: sortOpen ? 1 : 0, duration: motion ? 180 : 0, useNativeDriver: true });
    a.start(); return () => a.stop();
  }, [sortOpen, motion, arrow]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const selectMode = (nextMode: PartnerRenewalMode) => {
    if (nextMode !== mode) renewalHaptic();
    setMode(nextMode);
    setBucket(nextMode === 'expired' ? 'overdue' : 'all');
    setSortOpen(false);
  };

  const selectBucket = (nextBucket: PartnerRenewalBucket) => {
    setMode(nextBucket === 'overdue' ? 'expired' : 'expiring');
    setBucket(nextBucket);
    setSortOpen(false);
  };

  const toggleSort = () => {
    if (sortOpen) {
      setSortOpen(false);
      return;
    }
    sortAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setSortMenuPosition({ top: y + height + 4, left: Math.max(12, Math.min(x + width - 148, windowWidth - 160)) });
      setSortOpen(true);
    });
  };

  const selectSort = (direction: DueDateSort) => {
    if (direction !== sortDirection) renewalHaptic();
    setSortDirection(direction);
    setSortOpen(false);
  };

  const header = (
    <View>
      {summary.loading && !summary.data ? null : (
        <RenewalEnter enabled={motion} delay={0}>
        <View style={styles.summaryPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${mode === 'expired' ? 'all overdue' : 'all next 30 day'} renewal policies`}
            onPress={() => selectBucket(mode === 'expired' ? 'overdue' : 'all')}
            style={({ pressed }) => [styles.summaryLead, pressed && styles.summaryPressed]}
          >
            <View style={styles.summaryMain}>
              <RenewalShine enabled={motion}><Image source={PartnerAssets.actions.quickRenewals} style={styles.summaryArtwork} resizeMode="contain" /></RenewalShine>
              <View style={styles.summaryText}>
                <Text style={styles.summaryEyebrow}>{selectedSummary.eyebrow}</Text>
                <RenewalPremium value={selectedSummary.premium} enabled={motion} />
              </View>
            </View>
            <RenewalEnter enabled={motion} spring delay={90}><View style={styles.summaryCountBadge}>
              <Text style={styles.summaryCount} numberOfLines={1}>Policies {selectedSummary.count}</Text>
            </View></RenewalEnter>
          </Pressable>
          <View style={styles.summaryDivider} />
        </View></RenewalEnter>
      )}

      {(collection.stale || summary.stale) ? (
        <View style={styles.banner}>
          <PartnerBanner tone="warning" title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'} message={`Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`} />
        </View>
      ) : null}

      <RenewalEnter enabled={motion} delay={65}><View style={styles.modeTabs} onLayout={event => setTabWidth(event.nativeEvent.layout.width)}>
        <ModeTab label="Upcoming" count={summary.data?.due_30_count ?? null} active={mode === 'expiring'} motion={motion} onPress={() => selectMode('expiring')} />
        <ModeTab label="Overdue" count={summary.data?.overdue_count ?? null} active={mode === 'expired'} motion={motion} danger onPress={() => selectMode('expired')} />
        <Animated.View pointerEvents="none" style={[styles.slidingUnderline, { width: tabWidth / 2, transform: [{ translateX: indicator.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth / 2] }) }] }]} />
      </View></RenewalEnter>

      <RenewalEnter enabled={motion} delay={120}><View style={styles.searchRow}>
        <View style={styles.searchGrow}>
          <PartnerSearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search policy, customer or insurer..."
            leadingIconVariant="blue3d"
            containerStyle={styles.searchField}
            renewalMotion={motion}
          />
        </View>
      </View></RenewalEnter>

      <RenewalEnter enabled={motion} delay={165}><View style={styles.opportunitiesHeader}>
        <View style={styles.opportunitiesLeft}>
          <View style={styles.listIcon}><Image source={PartnerAssets.actions.quickPolicyIntake} style={styles.listArtwork} resizeMode="contain" /></View>
          <View>
            <Text style={styles.opportunitiesTitle}>{mode === 'expired' ? 'OVERDUE POLICIES' : 'RENEWAL OPPORTUNITIES'}</Text>
            <Text style={styles.opportunitiesMeta}>{collection.loading && !collection.rows.length ? 'Loading…' : `${collection.rows.length} policies · ${collection.total} total`}</Text>
          </View>
        </View>
        <View ref={sortAnchorRef} collapsable={false} style={styles.sortArea}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort renewals by due date" accessibilityHint="Opens sorting options above renewal records" accessibilityState={{ expanded: sortOpen }} onPress={toggleSort} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
            <Text style={styles.sortText}>Due Date</Text>
            <Animated.View style={{ transform: [{ rotate: arrow.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><Ionicons name="chevron-down" size={14} color="#42516A" /></Animated.View>
          </Pressable>
        </View>
      </View></RenewalEnter>

      {collection.error && collection.rows.length && !collection.stale ? <View style={styles.inlineBanner}><PartnerBanner tone="warning" message={collection.error} /></View> : null}
    </View>
  );

  const empty = (
    <View style={styles.emptyCard}>
      {collection.loading ? (
        <RenewalLoadingRows motion={motion} />
      ) : collection.error ? (
        <PartnerStateView state="error" title="Renewals could not be loaded" message={collection.error} actionLabel="Try again" onAction={() => void refreshAll()} />
      ) : (
        <>
          <RenewalEnter enabled={motion} spring><Image source={PartnerAssets.emptyStates.noRenewals} style={styles.emptyArtwork} resizeMode="contain" /></RenewalEnter>
          <Text style={styles.emptyTitle}>{mode === 'expiring' ? 'No policies in this renewal window' : 'No overdue policies found'}</Text>
          <Text style={styles.emptyMessage}>The queue is derived from your authorized policy book{`\n`}and policy expiry dates.</Text>
        </>
      )}
    </View>
  );

  const isLoadingMore = loadMoreFeedback || collection.loading || collection.changingPage;
  const footer = collection.rows.length > 0 && collection.rows.length < collection.total ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isLoadingMore ? 'Loading more policies' : 'Load More Policies'}
      accessibilityState={{ disabled: isLoadingMore, busy: isLoadingMore }}
      disabled={isLoadingMore}
      onPress={() => {
        const nextLimit = visibleLimit + PAGE_SIZE;
        loadMoreStartedAt.current = Date.now();
        setRequestedLimit(nextLimit);
        setLoadMoreFeedback(true);
        setVisibleLimit(nextLimit);
      }}
      style={({ pressed }) => [styles.loadMoreButton, isLoadingMore && styles.loadMoreButtonLoading, pressed && !isLoadingMore && styles.pressed]}
    >
      {isLoadingMore ? <><ActivityIndicator size="small" color="#FFFFFF" /><Text style={styles.loadMoreTextLoading}>Loading more policies…</Text></> :
        <><Text style={styles.loadMoreText}>Load More Policies</Text><Ionicons name="chevron-down" size={16} color="#3156B8" /></>}
    </Pressable>
  ) : null;

  return (
    <>
      <PartnerListScreen
      title="Renewal Work Queue"
      onBack={() => router.back()}
      showArtwork={false}
      navyStatusBar
      whiteCanvas
      bottomNavigation={<PartnerCaseBottomNavigation activeTab="Policies" />}
      topBar={<View style={styles.referenceHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Image source={PartnerAssets.actions.quickRenewals} style={styles.headerArtwork} resizeMode="contain" />
        <Text style={styles.referenceTitle} numberOfLines={1}>Renewal Work Queue</Text>
      </View>}
      data={sortedRows}
      keyExtractor={(row) => row.policy_id}
      renderItem={({ item, index }) => (
        <View style={[styles.recordCard, index === sortedRows.length - 1 && styles.recordCardLast]}>
          <RenewalEnter enabled={motion} delay={Math.min(index, 7) * 35} replayKey={`${mode}:${debouncedSearch}:${sortDirection}:${index}`} direction={mode === 'expired' ? -1 : 1}><RenewalCard row={item} motion={motion} onOpenPolicy={() => router.push(`/policy/${item.policy_id}` as never)} /></RenewalEnter>
        </View>
      )}
      header={header}
      empty={empty}
      footer={footer}
      refreshing={collection.refreshing || summary.refreshing}
      onRefresh={() => void refreshAll()}
      ItemSeparatorComponent={() => <View style={styles.recordDivider} />}
      />
      <Modal visible={sortOpen} transparent animationType={motion ? "fade" : "none"} statusBarTranslucent onRequestClose={() => setSortOpen(false)}>
        <View style={styles.sortOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close sort options" onPress={() => setSortOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sortMenu, { top: sortMenuPosition.top, left: sortMenuPosition.left }]}><RenewalEnter enabled={motion} spring>
            <Pressable accessibilityRole="button" accessibilityLabel="Earliest due date first" onPress={() => selectSort('asc')} style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}>
              <Text style={[styles.sortOptionText, sortDirection === 'asc' && styles.sortOptionTextActive]}>Earliest first</Text>
              {sortDirection === 'asc' ? <Ionicons name="checkmark" size={15} color={partnerTheme.colors.brand} /> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Latest due date first" onPress={() => selectSort('desc')} style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}>
              <Text style={[styles.sortOptionText, sortDirection === 'desc' && styles.sortOptionTextActive]}>Latest first</Text>
              {sortDirection === 'desc' ? <Ionicons name="checkmark" size={15} color={partnerTheme.colors.brand} /> : null}
            </Pressable>
          </RenewalEnter></View>
        </View>
      </Modal>
    </>
  );
}


function renewalHaptic() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
}

function useRenewalMotion() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const pref = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive && !changed) setReduced(value); }).catch(() => {});
    return () => { alive = false; app.remove(); pref.remove(); };
  }, []);
  return focused && foreground && !reduced;
}

function RenewalEnter({ children, enabled, delay = 0, spring = false, replayKey = '', direction }: { children: ReactNode; enabled: boolean; delay?: number; spring?: boolean; replayKey?: string; direction?: number }) {
  const progress = useRef(new Animated.Value(1)).current;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) { progress.setValue(1); return; }
    if (last.current === replayKey) return;
    last.current = replayKey;
    progress.setValue(0);
    const a = spring
      ? Animated.spring(progress, { toValue: 1, delay, speed: 18, bounciness: 3, useNativeDriver: true })
      : Animated.timing(progress, { toValue: 1, delay, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => { a.stop(); progress.setValue(1); };
  }, [enabled, delay, spring, replayKey, progress]);
  return <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [spring ? 0 : 7, 0] }) }, { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [direction ? direction * 5 : 0, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [spring ? 0.94 : 1, 1] }) }] }}>{children}</Animated.View>;
}

function useRenewalPulse(enabled: boolean, duration: number) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) { progress.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start(); return () => { loop.stop(); progress.setValue(0); };
  }, [enabled, duration, progress]);
  return progress;
}

function RenewalShine({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const shine = useRef(new Animated.Value(0)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!enabled || played.current) return;
    played.current = true;
    const a = Animated.timing(shine, { toValue: 1, delay: 280, duration: 650, useNativeDriver: true, isInteraction: false });
    a.start(); return () => { a.stop(); shine.setValue(1); };
  }, [enabled, shine]);
  return <View style={styles.shineClip}>{children}{enabled ? <Animated.View pointerEvents="none" style={[styles.shineStripe, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-12, 44] }) }, { rotate: '18deg' }] }]} /> : null}</View>;
}

function RenewalPremium({ value, enabled }: { value: number | string; enabled: boolean }) {
  const amount = Number(value);
  const target = Number.isFinite(amount) ? amount : 0;
  const [shown, setShown] = useState(target);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) { setShown(target); return; }
    if (previous.current === target) return;
    const start = previous.current ?? 0;
    previous.current = target;
    const progress = new Animated.Value(start);
    const id = progress.addListener(({ value: current }) => setShown(current));
    const a = Animated.timing(progress, { toValue: target, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start(({ finished }) => { if (finished) setShown(target); });
    return () => { progress.removeListener(id); a.stop(); setShown(target); };
  }, [target, enabled]);
  return <Text style={styles.summaryPremium} accessibilityLabel={`Net Premium - ${formatWholeRupees(target)}`}>Net Premium - {formatWholeRupees(enabled ? shown : target)}</Text>;
}

function renewalBadgeColors(days: number) {
  if (days < 0) return { background: '#991B1B', foreground: '#FFFFFF' };
  if (days === 0) return { background: '#DC2626', foreground: '#FFFFFF' };
  if (days <= 2) return { background: '#FEE2E2', foreground: '#B91C1C' };
  if (days <= 7) return { background: '#FFEDD5', foreground: '#C2410C' };
  if (days <= 20) return { background: '#FFF4E3', foreground: '#94611C' };
  return { background: '#E9F2FF', foreground: '#1558B0' };
}

function formatWholeRupees(value: number | string): string {
  const amount = Number(value);
  return formatIndianCurrency(Number.isFinite(amount) ? Math.trunc(amount) : 0);
}

function ModeTab({ label, count, active, danger = false, motion, onPress }: { label: string; count: number | null; active: boolean; danger?: boolean; motion: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.modeTab}><Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>{count !== null ? <RenewalEnter enabled={motion} spring replayKey={String(count)}><View style={[styles.tabBadge, danger ? styles.tabBadgeDanger : styles.tabBadgeBlue]}><Text style={[styles.tabBadgeText, danger ? styles.tabBadgeDangerText : styles.tabBadgeBlueText]}>{count}</Text></View></RenewalEnter> : null}</Pressable>;
}

function RenewalLoadingRows({ motion }: { motion: boolean }) {
  const glow = useRenewalPulse(motion, 900);
  return (
    <Animated.View style={[styles.loadingRows, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }]} accessibilityRole="progressbar" accessibilityLabel="Loading renewal opportunities">
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.loadingRow} importantForAccessibility="no-hide-descendants">
          <View style={styles.loadingLogo} />
          <View style={styles.loadingText}>
            <View style={styles.loadingName} />
            <View style={styles.loadingPolicy} />
            <View style={styles.loadingPremium} />
          </View>
          <View style={styles.loadingBadge} />
        </View>
      ))}
    </Animated.View>
  );
}

function resolveSummarySelection(data: PartnerRenewalSummary | null | undefined, mode: PartnerRenewalMode, bucket: PartnerRenewalBucket): SummarySelection {
  if (bucket === '0_7') return { eyebrow: 'DUE IN 0 – 7 DAYS', premium: data?.due_0_7_premium ?? 0, count: data?.due_0_7_count ?? 0 };
  if (bucket === '8_15') return { eyebrow: 'DUE IN 8 – 15 DAYS', premium: data?.due_8_15_premium ?? 0, count: data?.due_8_15_count ?? 0 };
  if (bucket === '16_30') return { eyebrow: 'DUE IN 16 – 30 DAYS', premium: data?.due_16_30_premium ?? 0, count: data?.due_16_30_count ?? 0 };
  if (bucket === 'overdue' || mode === 'expired') return { eyebrow: 'OVERDUE', premium: data?.overdue_premium ?? 0, count: data?.overdue_count ?? 0 };
  return { eyebrow: 'NEXT 30 DAYS', premium: data?.due_30_premium ?? 0, count: data?.due_30_count ?? 0 };
}

function RenewalCard({ row, motion, onOpenPolicy }: { row: PartnerRenewalRow; motion: boolean; onOpenPolicy: () => void }) {
  const days = daysUntil(row.end_date);
  const expired = days < 0;
  const colors = renewalBadgeColors(days);
  const pulse = useRenewalPulse(motion && days >= 0 && days <= 2, 1250);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open renewal policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`} onPress={onOpenPolicy} style={({ pressed }) => [styles.renewalRow, pressed && styles.pressed]}>
      <View style={styles.renewalArtwork}><PartnerInsurerLogo name={row.insurer_name} fallback={PartnerAssets.actions.renewals} style={styles.renewalArtworkImage} /></View>
      <View style={styles.renewalCopy}>
        <Text numberOfLines={1} style={styles.renewalName}>{row.customer_name}</Text>
        <Text numberOfLines={1} style={styles.renewalPolicy}>{row.policy_no || row.policy_code || 'Policy'}</Text>
        <Text style={styles.renewalPremium}>{formatIndianCurrency(row.net_premium)}</Text>
      </View>
      <Animated.View style={[styles.renewalBadge, { backgroundColor: colors.background, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>
        {expired ? <Ionicons name="time-outline" color={colors.foreground} size={13} /> : null}
        <Text style={[styles.renewalBadgeText, { color: colors.foreground }]}>{renewalLabel(row.end_date)}</Text>
      </Animated.View>
    </Pressable>
  );
}

function expirySortValue(value: string | null, direction: DueDateSort) {
  if (!value) return direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? (direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER) : parsed;
}
function daysUntil(value: string | null) { if (!value) return 9999; const end = new Date(`${value}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); return Math.ceil((end.getTime() - today.getTime()) / 86400000); }
function renewalLabel(value: string | null) { const days = daysUntil(value); if (days === 9999) return 'No expiry'; if (days < 0) return `${Math.abs(days)}d overdue`; if (days === 0) return 'Due today'; return `${days}d left`; }
function renewalTone(value: string | null): 'warning' | 'info' { return daysUntil(value) <= 7 ? 'warning' : 'info'; }
function formatUpdatedAt(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

const styles = StyleSheet.create({
  loadMoreButton: { minHeight: 46, marginTop: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#EDF2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadMoreButtonLoading: { backgroundColor: '#3156B8' },
  loadMoreText: { color: '#3156B8', fontSize: 11, fontWeight: '800' },
  loadMoreTextLoading: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  referenceHeader: { minHeight: 64, marginHorizontal: -partnerTheme.spacing.lg, marginBottom: 0, paddingHorizontal: 14, backgroundColor: '#071E49', flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAction: { width: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerArtwork: { width: 36, height: 36 },
  summaryArtwork: { width: 37, height: 37 },
  listArtwork: { width: 31, height: 31 },
  referenceTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  summaryPanel: { marginTop: 0, marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#FFFFFF' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#D9E2EE', marginHorizontal: 14 },
  summaryLead: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryPressed: { opacity: 0.72 },
  summaryMain: { flexDirection: 'row', flex: 1, minWidth: 0, alignItems: 'center', gap: 10 },
  summaryText: { flex: 1, minWidth: 0, gap: 5 },
  summaryEyebrow: { color: '#172A48', fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.2 },
  summaryPremium: { color: '#53677F', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  summaryCountBadge: { flexShrink: 0, minHeight: 28, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16, backgroundColor: '#E9F2FF', alignItems: 'center', justifyContent: 'center' },
  summaryCount: { color: '#1558B0', fontSize: 11, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  banner: { marginTop: 9 }, inlineBanner: { marginBottom: 8 },
  modeTabs: { marginTop: 0, flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: '#D5E3F2' },
  modeTab: { flex: 1, minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 5, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  slidingUnderline: { position: 'absolute', bottom: 0, left: 0, height: 3, backgroundColor: '#0877EB' }, modeLabel: { color: '#29344B', fontSize: 12, fontWeight: '700' }, modeLabelActive: { color: '#111B31' },
  tabBadge: { minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tabBadgeBlue: { backgroundColor: '#EAF0FF' }, tabBadgeDanger: { backgroundColor: '#FFE9E9' },
  tabBadgeText: { fontSize: 10, fontWeight: '800' }, tabBadgeBlueText: { color: '#0877EB' }, tabBadgeDangerText: { color: '#EF4444' },
  searchRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' }, searchGrow: { flex: 1 },
  searchField: { borderColor: '#D8E0EB', backgroundColor: '#FFFFFF' },
  opportunitiesHeader: { marginTop: 14, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', borderColor: '#E4E9F1', borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, opportunitiesLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  listIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  opportunitiesTitle: { color: '#17233B', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.25 }, opportunitiesMeta: { marginTop: 1, color: '#7A8598', fontSize: 9 },
  sortArea: { flexDirection: 'row', alignItems: 'center' }, sortButton: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F1' }, sortText: { color: '#263249', fontSize: 10, fontWeight: '700' },
  sortOverlay: { flex: 1, justifyContent: 'flex-start' },
  sortMenu: { position: 'absolute', width: 148, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F1', shadowColor: '#0C2856', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 15 },
  sortOption: { minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sortOptionPressed: { backgroundColor: '#F6F8FC' }, sortOptionText: { color: '#42516A', fontSize: 10.5, fontWeight: '600' }, sortOptionTextActive: { color: partnerTheme.colors.brand, fontWeight: '800' },
  emptyCard: { minHeight: 205, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderWidth: 1, borderTopWidth: 0, borderColor: '#E4E9F1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  loadingRows: { width: '100%', gap: 0 },
  loadingRow: { minHeight: 66, paddingHorizontal: 0, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E9F1' },
  loadingLogo: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EDEFF3' },
  loadingText: { flex: 1, gap: 5 },
  loadingName: { width: '62%', height: 8, borderRadius: 4, backgroundColor: '#EDEFF3' },
  loadingPolicy: { width: '82%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  loadingPremium: { width: '49%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  loadingBadge: { width: 49, height: 23, borderRadius: 9, backgroundColor: '#EDEFF3' },
  emptyArtwork: { width: 122, height: 82, marginBottom: 8 }, emptyTitle: { color: '#101A31', fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'center' }, emptyMessage: { marginTop: 7, color: '#69758A', fontSize: 10, lineHeight: 17, textAlign: 'center' },
  recordCard: { backgroundColor: '#FFFFFF', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E4E9F1' },
  recordCardLast: { borderBottomWidth: 1, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' },
  recordDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E4E9F1' },
  renewalArtwork: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, renewalArtworkImage: { width: 32, height: 32 },
  renewalRow: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  renewalCopy: { flex: 1, minWidth: 0, gap: 2 },
  renewalName: { color: '#102B53', fontWeight: '800', fontSize: 12 },
  renewalPolicy: { color: '#7B879B', fontSize: 10.5 },
  renewalPremium: { color: '#142A4A', fontWeight: '800', fontSize: 12 },
  renewalBadge: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 },
  badgeOverdue: { backgroundColor: '#FFEBEB' }, badgeUpcoming: { backgroundColor: '#FFF4E3' },
  renewalBadgeText: { fontSize: 10, fontWeight: '800' }, badgeOverdueText: { color: '#BF2929' }, badgeUpcomingText: { color: '#94611C' },
  shineClip: { width: 37, height: 37, overflow: 'hidden' },
  shineStripe: { position: 'absolute', top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(255,255,255,0.42)' },
  pressed: { opacity: 0.65 },
});