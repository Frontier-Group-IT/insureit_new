import { formatAppDate } from '@/lib/indian-date';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerProfileAvatar } from '@/components/ui/partner-profile-avatar';
import { PartnerMotionBadge } from '@/components/ui/partner-motion-badge';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerPolicySummary,
  getPartnerPolicyPeriodCounts,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyBusinessLine,
  type PartnerPolicyPeriod,
  type PartnerPolicyPeriodCounts,
  type PartnerPolicyStatusFilter,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { PartnerAssets } from '@/lib/partner-assets';
import { canPartnerAccess, canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { partnerTheme } from '@/lib/theme';
import { getPartnerUnreadActivityCount } from '@/lib/engagement';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerNetwork } from '@/providers/partner-network-provider';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 10;
const businessLineOptions: {label:string;value:PartnerPolicyBusinessLine}[] = [
  {label:'All Policies',value:'all'},
  {label:'Motor',value:'motor'},
  {label:'Non Motor',value:'non motor'},
  {label:'Life',value:'life'},
  {label:'Health',value:'health'},
];
let savedPolicyQuery = '';
let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';
let savedPolicyPeriod: PartnerPolicyPeriod = 'all';
const sheetStatuses: {label:string;value:PartnerPolicyStatusFilter;lifecycle:PartnerPolicyLifecycle}[] = [
  {label:'All Policies',value:'all',lifecycle:'all'},
  {label:'Active',value:'active',lifecycle:'in_force'},
  {label:'Expired',value:'expired',lifecycle:'expired'},
  {label:'Due',value:'due',lifecycle:'expiring'},
];

export default function PoliciesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const safeAreaInsets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // SafeAreaView already offsets overlays when iOS reports a top inset.
  // Only fall back when older OTA runtimes report zero, avoiding double spacing.
  const verticalListRef = useRef<FlatList>(null);
  useFocusEffect(useCallback(() => {
    const reset = () => verticalListRef.current?.scrollToOffset({ offset: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const { cacheScopeKey, context, avatarUri } = usePartnerSession();
  const { isOffline } = usePartnerNetwork();
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [period, setPeriod] = useState<PartnerPolicyPeriod>(savedPolicyPeriod);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<PartnerPolicyPeriod>(savedPolicyPeriod);
  const [draftLifecycle, setDraftLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [businessLine, setBusinessLine] = useState<PartnerPolicyBusinessLine>('all');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [lineMenuPosition, setLineMenuPosition] = useState({top:300,left:88});
  const lineButtonRef = useRef<View>(null);
  const [statusMenuTop, setStatusMenuTop] = useState(180);
  const statusButtonRef = useRef<View>(null);
  const [query, setQuery] = useState(savedPolicyQuery);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [loadMoreFeedback, setLoadMoreFeedback] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState(PAGE_SIZE);
  const loadMoreStartedAt = useRef(0);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setUnreadActivityCount(0);
    void getPartnerUnreadActivityCount(100)
      .then((count) => { if (!cancelled) setUnreadActivityCount(count); })
      .catch(() => { if (!cancelled) setUnreadActivityCount(0); });
    return () => { cancelled = true; };
  }, [cacheScopeKey]));
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setRequestedLimit(PAGE_SIZE);
    setLoadMoreFeedback(false);
  }, [period, lifecycle, debouncedSearch, businessLine]);

  useEffect(() => {
    savedPolicyQuery = query;
    savedPolicyLifecycle = lifecycle;
    savedPolicyPeriod = period;
  }, [lifecycle, period, query]);

  const fetchSummary = useCallback(() => getPartnerPolicySummary(), []);
  const fetchPeriodCounts = useCallback(() => getPartnerPolicyPeriodCounts({businessLine,search:debouncedSearch}),[businessLine,debouncedSearch]);
  const periodCounts = usePartnerQuery<PartnerPolicyPeriodCounts>({
    scopeKey:cacheScopeKey,
    key:`policies:period-counts:${businessLine}:${debouncedSearch || 'all'}`,
    fetcher:fetchPeriodCounts,
    staleTimeMs:60_000,
  });
  const summary = usePartnerQuery<PartnerPolicySummary>({
    scopeKey: cacheScopeKey,
    key: 'policies:summary',
    fetcher: fetchSummary,
    staleTimeMs: 2 * 60_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerPolicies({
      lifecycle,
      businessLine,
      period,
      search: debouncedSearch,
      limit,
      offset,
    });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, lifecycle, businessLine, period]);

  const collection = usePartnerPageQuery<PartnerPolicyRow>({
    scopeKey: cacheScopeKey,
    // The requested limit is part of the cache identity. Without this, increasing
    // 10 -> 20 can reuse the cached 10-row "page 0" result and appear to do nothing.
    key: `policies:list:${period}:${lifecycle}:${businessLine}:${debouncedSearch || 'all'}:limit:${visibleLimit}`,
    pageSize: visibleLimit,
    fetchPage,
    staleTimeMs: 60_000,
  });

  useEffect(() => {
    if (!loadMoreFeedback) return;

    const reachedRequestedSize =
      collection.rows.length >= requestedLimit ||
      (collection.total > 0 && collection.rows.length >= collection.total);
    const finishedRequest = !collection.loading && !collection.changingPage && reachedRequestedSize;

    if (!finishedRequest && !collection.error) return;

    const elapsed = Date.now() - loadMoreStartedAt.current;
    const remaining = Math.max(0, 900 - elapsed);
    const timer = setTimeout(() => setLoadMoreFeedback(false), remaining);
    return () => clearTimeout(timer);
  }, [
    collection.changingPage,
    collection.error,
    collection.loading,
    collection.rows.length,
    collection.total,
    loadMoreFeedback,
    requestedLimit,
  ]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), periodCounts.refresh(), collection.refresh()]);
  }, [collection, summary, periodCounts]);

  const selectSummary = (filter: PartnerPolicyLifecycle) => {
    setStatusMenuOpen(false);
    setQuery('');
    setVisibleLimit(PAGE_SIZE);
    setLifecycle(filter);
  };
  const activePeriodCounts = periodCounts.data?.[period];
  const statusOptions: { label: string; filter: PartnerPolicyLifecycle; count: number | undefined }[] = [
    { label: 'Total Policies', filter: 'all', count: activePeriodCounts?.all },
    { label: 'Active Policies', filter: 'in_force', count: activePeriodCounts?.active },
    { label: 'Expiring Soon', filter: 'expiring', count: activePeriodCounts?.due },
    { label: 'Lapsed Policies', filter: 'expired', count: activePeriodCounts?.expired },
    { label: 'Upcoming', filter: 'upcoming', count: period==='all' ? summary.data?.upcoming_policies : undefined },
  ];
  const selectedStatus = statusOptions.find((option) => option.filter === lifecycle) ?? statusOptions[0];
  const formatStatusCount = (count: number | undefined) => count === undefined ? '—' : count.toLocaleString('en-IN');
  const openStatusMenu = () => {
    statusButtonRef.current?.measureInWindow((_x, y, _width, height) => {
      setStatusMenuTop(Math.max(8, Math.min(y + height + 5, windowHeight - 280)));
      setStatusMenuOpen(true);
    });
  };
  useEffect(() => {
    if (!isFocused) { setStatusMenuOpen(false); setLineMenuOpen(false); setSortSheetOpen(false); }
  }, [isFocused]);

  const openSortSheet = () => {
    setStatusMenuOpen(false);
    setLineMenuOpen(false);
    setDraftPeriod(period);
    setDraftLifecycle(lifecycle==='upcoming' ? 'all' : lifecycle);
    setSortSheetOpen(true);
  };
  const applySortSheet = () => {
    setSortSheetOpen(false);
    setPeriod(draftPeriod);
    setLifecycle(draftLifecycle);
    setVisibleLimit(PAGE_SIZE);
    setRequestedLimit(PAGE_SIZE);
    setLoadMoreFeedback(false);
    verticalListRef.current?.scrollToOffset({offset:0,animated:false});
  };
  const selectBusinessLine = (line: PartnerPolicyBusinessLine) => {
    setLineMenuOpen(false);
    setBusinessLine(line);
    setVisibleLimit(PAGE_SIZE);
    setRequestedLimit(PAGE_SIZE);
    setLoadMoreFeedback(false);
    verticalListRef.current?.scrollToOffset({offset:0,animated:false});
  };
  const openBusinessLineMenu = () => {
    setStatusMenuOpen(false);
    lineButtonRef.current?.measureInWindow((x,y,width,height) => {
      setLineMenuPosition({
        top:Math.max(8,Math.min(y+height+4,windowHeight-260)),
        left:Math.max(8,Math.min(x,windowWidth-218)),
      });
      setLineMenuOpen(true);
    });
  };
  const name = context?.identity.display_name || 'Partner';
  const quickActions = [
    ...(canPartnerAccess(context, 'view_policy_intakes') ? [{
      label: 'Policy Intake', image: require('../../assets/partner/quick-actions/policy-intake.png'),
      accessibilityLabel: 'Open Policy Intake', route: '/policy-intakes' as const,
    }] : []),
    ...(canPartnerAccess(context, 'create_policies', 'edit') ? [{
      label: 'Add Policy', image: require('../../assets/partner/quick-actions/add-policy.png'),
      accessibilityLabel: 'Add Policy, start a new blank policy', route: '/policy-new' as const,
    }] : []),
    ...(canPartnerAccessCaseRegister(context) ? [{
      label: 'Case Register', image: require('../../assets/partner/quick-actions/case-register.png'),
      accessibilityLabel: 'Open Case Register for Life and Health cases', route: '/life-health-cases' as const,
    }] : []),
    ...(context?.identity.actor_kind === 'employee' && canPartnerAccess(context, 'create_intermediary_application', 'edit') ? [{
      label: 'Add Partner', image: require('../../assets/partner/quick-actions/add-partner.png'),
      accessibilityLabel: 'Add Partner, submit Partner-only application', route: '/partner-new' as const,
    }] : []),
  ];


  // Keep the search/filter row visible once the list scrolls past the hero.
  // A same-size spacer preserves scroll position when the search docks.
  const [searchSticky, setSearchSticky] = useState(false);
  const searchTopY = useRef(Number.POSITIVE_INFINITY);
  const searchControls = (
      <View style={styles.searchRow}>
        <PartnerSearchField
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          suggestions={debouncedSearch.length >= 2 ? collection.rows.flatMap(r => [r.policy_no || "",r.policy_code || "",r.customer_name,r.vehicle_no || "",r.insurer_name || "",r.policy_product || ""]) : []}
          placeholder="Search customer, vehicle number or policy number..."
          placeholders={['Search customer...', 'Search vehicle number...', 'Search policy number...']}
          containerStyle={styles.searchField}
        />
        <Pressable
          ref={statusButtonRef}
          accessibilityRole="button"
          accessibilityLabel={`Choose policy status, ${selectedStatus.label}, ${formatStatusCount(selectedStatus.count)}`}
          accessibilityState={{ expanded: statusMenuOpen }}
          onPress={openStatusMenu}
          style={({ pressed }) => [styles.filterButton, pressed && styles.summaryChipPressed]}
        >
          <View style={styles.filterNameBadge}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.filterText}>
              {selectedStatus.label} ({formatStatusCount(selectedStatus.count)})
            </Text>
            <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

  );

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBrand}>
            <Ionicons name="shield-checkmark-outline" size={27} color="#153B72" accessibilityLabel="INSUREIT icon" />
            <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
              <Text style={styles.heroBrandInsureit}>insureit</Text>
              <Text style={styles.heroBrandPartner}>Partner</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unreadActivityCount ? `View recent activity, ${unreadActivityCount} unread` : "View recent activity"}
              onPress={() => router.push('/activity')}
              style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
            >
              <Feather name="bell" size={20} color="#153B72" />
              {unreadActivityCount > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unreadActivityCount > 99 ? "99+" : unreadActivityCount}</Text></View> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.heroAvatarTouch, pressed && styles.pressed]}
            >
              <PartnerProfileAvatar
                name={name}
                uri={avatarUri}
                size={35}
                backgroundColor="#FFFFFF"
                textColor={partnerTheme.colors.brandStrong}
                style={styles.heroAvatar}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroHeadingRow}>
          <Text style={styles.heroTitle}>Policies</Text>

        </View>
      </View>

      <View onLayout={(event) => { searchTopY.current = event.nativeEvent.layout.y; }}>
        {searchSticky ? <View style={styles.searchSpacer} /> : searchControls}
      </View>

      {quickActions.length > 0 ? (
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsHeading}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.route}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                onPress={() => router.push(action.route)}
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
              >
                <Image source={action.image} style={styles.quickActionImage} resizeMode="contain" />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.quickActionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.policyListHeadingSection}>
        <Pressable
          ref={lineButtonRef}
          accessibilityRole="button"
          accessibilityLabel={'Filter by business line, '+(businessLineOptions.find(x=>x.value===businessLine)?.label??'All Policies')}
          accessibilityState={{expanded:lineMenuOpen}}
          onPress={openBusinessLineMenu}
          style={({pressed})=>[styles.businessLineButton,pressed&&styles.summaryChipPressed]}>
          <Text style={styles.businessLineText} numberOfLines={1}>{businessLineOptions.find(x=>x.value===businessLine)?.label??'All Policies'}</Text>
          <Ionicons name="chevron-down" size={13} color="#17365D"/>
        </Pressable>
      </View>

      {isOffline || collection.stale || summary.stale ? (
        <View style={styles.feedback}>
          <PartnerBanner
            tone="warning"
            title={isOffline ? "You're offline" : 'Showing cached information'}
            message={isOffline
              ? 'Available cached information remains visible. Reconnect to refresh.'
              : `Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}



      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="warning" message={collection.error} />
        </View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding policies" />
  ) : collection.error ? (
    <PartnerStateView
      state="error"
      title="Policies could not be loaded"
      message={collection.error}
      actionLabel="Try again"
      onAction={() => void refreshAll()}
    />
  ) : (
    <PartnerStateView
      state="empty"
      asset={PartnerAssets.emptyStates.noPolicies}
      title="No policies found"
      message="Try another search term or policy lifecycle filter."
    />
  );

  const isLoadingMore = loadMoreFeedback || collection.loading || collection.changingPage;
  const footer = collection.rows.length && collection.rows.length < collection.total ? (
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
      style={({ pressed }) => [
        styles.loadMoreButton,
        isLoadingMore && styles.loadMoreButtonLoading,
        pressed && !isLoadingMore && styles.pressed,
      ]}
    >
      {isLoadingMore ? (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadMoreTextLoading}>Loading more policies…</Text>
        </>
      ) : (
        <>
          <Text style={styles.loadMoreText}>Load More Policies</Text>
          <Feather name="chevron-down" size={13} color="#3156B8" />
        </>
      )}
    </Pressable>
  ) : null;

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        ref={verticalListRef}
        data={collection.rows}
        keyExtractor={(row) => row.policy_id}
        renderItem={({ item }) => (
          <PolicyCard
            row={item}
            onPress={() => router.push(`/policy/${item.policy_id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        onScroll={(event) => {
          const shouldStick = event.nativeEvent.contentOffset.y >= searchTopY.current;
          setSearchSticky((current) => current === shouldStick ? current : shouldStick);
        }}
        scrollEventThrottle={16}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        refreshControl={(
          <RefreshControl
            refreshing={collection.refreshing || summary.refreshing}
            onRefresh={() => void refreshAll()}
            tintColor="#3156B8"
          />
        )}
        contentContainerStyle={[styles.content, !collection.rows.length && styles.contentEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
      </SafeAreaView>
      <Pressable accessibilityRole="button" accessibilityLabel="Sort by policy period and status"
        onPress={openSortSheet} style={({pressed})=>[styles.sortFloating,pressed&&styles.summaryChipPressed]}>
        <Feather name="sliders" size={14} color="#304778"/>
        <Text style={styles.sortFloatingText}>Sort by</Text>
      </Pressable>
      {isFocused ? <StatusBar style={searchSticky ? 'light' : 'dark'} /> : null}
      {searchSticky && safeAreaInsets.top > 0 ? <View pointerEvents="none" style={[styles.stickyStatusBarShield, { height: safeAreaInsets.top }]} /> : null}
      {searchSticky ? <View style={[styles.stickySearchOverlay, { top: safeAreaInsets.top }]} pointerEvents="box-none"><Text style={styles.stickyClaimsHeading}>Policies</Text>{searchControls}</View> : null}
      <Modal visible={lineMenuOpen} transparent animationType="fade" onRequestClose={()=>setLineMenuOpen(false)}>
        <View style={styles.statusMenuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close business line menu" onPress={()=>setLineMenuOpen(false)}/>
          <View style={[styles.businessLineMenu,lineMenuPosition]}>
            <Text style={styles.businessLineMenuTitle}>BUSINESS LINE</Text>
            {businessLineOptions.map(option=>{
              const selected=businessLine===option.value;
              return <Pressable key={option.value} accessibilityRole="button"
                accessibilityLabel={option.label} accessibilityState={{selected}}
                onPress={()=>selectBusinessLine(option.value)}
                style={({pressed})=>[styles.businessLineOption,selected&&styles.businessLineSelected,pressed&&styles.summaryChipPressed]}>
                <Text style={[styles.businessLineOptionText,selected&&styles.businessLineOptionSelectedText]}>{option.label}</Text>
                <Ionicons name={selected?'radio-button-on':'radio-button-off'} size={15} color={selected?'#17365D':'#CBD6E7'}/>
              </Pressable>;
            })}
          </View>
        </View>
      </Modal>
      <Modal visible={sortSheetOpen} transparent animationType="slide" onRequestClose={()=>setSortSheetOpen(false)}>
        <View style={styles.sortOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close sort by popup" onPress={()=>setSortSheetOpen(false)}/>
          <View style={[styles.sortSheet,{paddingBottom:Math.max(12,safeAreaInsets.bottom+7),maxHeight:windowHeight-36}]}>
            <View style={styles.sortSheetHeader}>
              <Text style={styles.sortSheetTitle}>Sort by</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close sort by popup" onPress={()=>setSortSheetOpen(false)} style={styles.sortSheetClose}>
                <Ionicons name="close" size={23} color="#586580"/>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sortSheetBody}>
              <View style={styles.sortSectionHeading}>
                <Feather name="calendar" size={20} color="#182557"/>
                <Text style={styles.sortSectionLabel}>Period</Text>
              </View>
              <View style={styles.sortPeriodRow}>
                {(['mtd','all'] as const).map(value=>{
                  const selected=draftPeriod===value;
                  return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value==='mtd'?'MTD':'All'}
                    accessibilityState={{selected}} onPress={()=>{setDraftPeriod(value);setDraftLifecycle('all');}}
                    style={({pressed})=>[styles.sortPeriodOption,selected&&styles.sortPeriodSelected,pressed&&styles.summaryChipPressed]}>
                    <View style={styles.sortPeriodContent}>
                      <Text style={[styles.sortPeriodText,selected&&styles.sortPeriodTextSelected]}>{value==='mtd'?'MTD':'All'}</Text>
                    </View>
                  </Pressable>;
                })}
              </View>
              <View style={styles.sortSectionDivider}/>
              <View style={styles.sortSectionHeading}>
                <Ionicons name="layers-outline" size={21} color="#182557"/>
                <Text style={styles.sortSectionLabel}>{draftPeriod==='mtd'?'MTD':'All'} Policy Status</Text>
              </View>
              <View style={styles.sortChoices}>
                {sheetStatuses.map(option=>{
                  const selected=draftLifecycle===option.lifecycle;
                  const count=periodCounts.data?.[draftPeriod]?.[option.value];
                  return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label}
                    accessibilityState={{selected}} onPress={()=>setDraftLifecycle(option.lifecycle)}
                    style={({pressed})=>[styles.sortChoice,selected&&styles.sortChoiceSelected,pressed&&styles.summaryChipPressed]}>
                    <Ionicons name={selected?'radio-button-on':'radio-button-off'} color={selected?'#4230B3':'#A3A9B1'} size={24}/>
                    <Text style={[styles.sortChoiceText,selected&&styles.sortChoiceTextSelected]}>{option.label}</Text>
                    <View style={[styles.sortChoiceCountBadge,
                      option.value==='all'?styles.sortCountPurple:
                      option.value==='active'?styles.sortCountGreen:
                      option.value==='expired'?styles.sortCountRed:styles.sortCountAmber]}>
                      <Text style={[styles.sortChoiceCount,
                        option.value==='all'?styles.sortCountPurpleText:
                        option.value==='active'?styles.sortCountGreenText:
                        option.value==='expired'?styles.sortCountRedText:styles.sortCountAmberText]}>
                        {count===undefined?'—':count.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </Pressable>;
                })}
              </View>
              {periodCounts.error ? <Text style={styles.sortError}>Counts are unavailable. The selected filter may need a server update.</Text>:null}
              <Pressable accessibilityRole="button" accessibilityLabel="Apply policy filters"
                style={({pressed})=>[styles.sortApply,pressed&&styles.summaryChipPressed]} onPress={applySortSheet}>
                <View style={styles.sortApplyContent}>
                  <Feather name="filter" size={20} color="#FFFFFF"/>
                  <Text style={styles.sortApplyText}>Apply Filter</Text>
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={statusMenuOpen} transparent animationType="fade" onRequestClose={() => setStatusMenuOpen(false)}>
        <View style={styles.statusMenuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close policy status menu"
            onPress={() => setStatusMenuOpen(false)}
          />
          <View style={[styles.statusMenu, { top: statusMenuTop }]}>
            {statusOptions.map((option) => {
              const selected = lifecycle === option.filter;
              return (
                <Pressable
                  key={option.filter}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, ${formatStatusCount(option.count)}`}
                  accessibilityState={{ selected }}
                  onPress={() => selectSummary(option.filter)}
                  style={({ pressed }) => [styles.statusMenuOption, selected && styles.statusMenuOptionSelected, pressed && styles.summaryChipPressed]}
                >
                  <Text style={[styles.statusMenuLabel, selected && styles.statusMenuSelectedText]} numberOfLines={1}>{option.label}</Text>
                  <Text style={[styles.statusMenuCount, selected && styles.statusMenuSelectedText]}>
                    {formatStatusCount(option.count)}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" color="#3156B8" size={17} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PolicyCard({ row, onPress }: { row: PartnerPolicyRow; onPress: () => void }) {
  const category = policyCategory(row);
  const status = policyStatus(row.lifecycle_status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${category} policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.policyCard, pressed && styles.policyCardPressed]}
    >
      <View style={styles.policyIconShell}>
        {row.insurer_name ? (
          <PartnerInsurerLogo
            name={row.insurer_name}
            style={styles.insurerLogo}
            accessibilityLabel={row.insurer_name}
          />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={20} color="#2459B7" />
            <View style={styles.policyIconMini}>
              <Ionicons name="shield-checkmark" size={8} color="#FFFFFF" />
            </View>
          </>
        )}
      </View>

      <View style={styles.policyMain}>
        <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
        <Text numberOfLines={1} style={styles.policyNumber}>{row.policy_no || row.policy_code || 'Policy'}</Text>
        <Text numberOfLines={1} style={styles.vehicleText}>{row.vehicle_no || category}</Text>
      </View>

      <View style={styles.policyRight}>
        <PartnerMotionBadge style={[styles.statusPill, { backgroundColor: status.background }]}>
          <View style={[styles.statusDot, { backgroundColor: status.foreground }]} />
          <Text style={[styles.statusText, { color: status.foreground }]}>{status.label}</Text>
        </PartnerMotionBadge>
        <Text style={styles.policyPeriod}>{formatDate(row.start_date)} - {formatDate(row.end_date)}</Text>
      </View>
    </Pressable>
  );
}

function policyStatus(value: PartnerPolicyRow['lifecycle_status']) {
  if (value === 'expired') {
    return { label: 'Lapsed', foreground: '#D04C4C', background: '#FDECEC' };
  }
  if (value === 'expiring') {
    return { label: 'Expiring Soon', foreground: '#C47B12', background: '#FFF5E5' };
  }
  if (value === 'upcoming') {
    return { label: 'Upcoming', foreground: '#4C63C8', background: '#EEF0FF' };
  }
  return { label: 'Active', foreground: '#1D9A68', background: '#EAF8F2' };
}

function policyCategory(row: PartnerPolicyRow) {
  const value = [row.policy_type, row.policy_product, row.business_line].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  if (value.includes('non motor') || value.includes('non-motor') || value.includes('non_motor')) return 'Non-Motor';
  if (value.includes('motor') || row.vehicle_id || row.vehicle_no) return 'Motor';
  return 'Non-Motor';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return formatAppDate(value);
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 108, backgroundColor: '#FFFFFF' },
  contentEmpty: { flexGrow: 1 },
  hero: {
    height: 98,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  heroTopRow: {
    zIndex: 3,
    position: 'absolute',
    top: 13,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 35,
  },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  heroBrandCopy: { justifyContent: 'center' },
  heroBrandInsureit: { color: '#153B72', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
  heroBrandPartner: { color: '#C48424', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
  heroActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  unreadBadge: {
    position: 'absolute', top: -8, right: -9, minWidth: 21, height: 21,
    paddingHorizontal: 4, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E53445', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: Platform.OS === 'ios' ? '400' : '900' },
  heroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F6FC',
    borderWidth: 1,
    borderColor: '#D5E0F0',
  },
  heroAvatarTouch: { borderRadius: 18 },
  heroAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D5E0F0',
    shadowColor: '#001B42',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroAvatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  heroHeadingRow: {
    zIndex: 3,
    position: 'absolute',
    left: 18,
    right: 15,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    color: '#153B72',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: Platform.OS === 'ios' ? '400' : '800',
    letterSpacing: -0.2,
  },
  intakeHeaderButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#001B42',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  intakeHeaderText: { color: '#0B2E63', fontSize: 9.5, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  searchSpacer: { height: 44, marginTop: -10, marginHorizontal: 16 },
  stickyStatusBarShield: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, backgroundColor: '#082657' },
  stickySearchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: '#082657', paddingTop: 12, paddingBottom: 10 },
  stickyClaimsHeading: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '400', marginLeft: 18, marginBottom: 12 },
  searchRow: {
    zIndex: 5,
    marginTop: -10,
    marginHorizontal: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DFEA',
    overflow: 'hidden',
    shadowColor: '#173B6C',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  filterButton: {
    height: 44,
    width: 158,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 7,
    backgroundColor: '#FFFFFF',
  },
  filterNameBadge: {
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#17365D',
  },
  filterText: { flexShrink: 1, color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  statusMenuOverlay: { flex: 1 },
  statusMenu: {
    position: 'absolute', right: 16, width: 228, padding: 5,
    borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE7F1',
    shadowColor: '#001B42', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 10,
  },
  statusMenuOption: {
    minHeight: 44, borderRadius: 9, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  statusMenuOptionSelected: { backgroundColor: '#EEF4FF' },
  statusMenuLabel: { flex: 1, color: '#17365D', fontSize: 12, fontWeight: '700' },
  statusMenuCount: { color: '#657995', fontSize: 11, fontWeight: '700' },
  statusMenuSelectedText: { color: '#234F9F' },
  summaryChipPressed: { opacity: 0.78 },
  sortFloating:{position:'absolute',bottom:8,alignSelf:'center',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,
    paddingHorizontal:15,minHeight:40,borderRadius:22,backgroundColor:'#F0EDFF',borderWidth:1,borderColor:'#E1DBFA',
    shadowColor:'#5C5493',shadowOpacity:0.13,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:6},
  sortFloatingText:{fontSize:11,fontWeight:'800',color:'#304778'},
  sortOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(16,30,66,0.73)'},
  sortSheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:18,paddingTop:10},
  sortSheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:8,borderBottomWidth:1,borderColor:'#E4E5F1'},
  sortSheetTitle:{fontSize:17,fontWeight:'800',color:'#14244B'},
  sortSheetClose:{minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'},
  sortSheetBody:{paddingTop:8,paddingBottom:3},
  sortSectionHeading:{flexDirection:'row',alignItems:'center',gap:9,marginTop:4,marginBottom:9},
  sortSectionLabel:{fontSize:13,lineHeight:19,color:'#172552',fontWeight:'800'},
  sortSectionDivider:{height:1,backgroundColor:'#E1E3EE',marginTop:12,marginBottom:10},
  sortPeriodRow:{flexDirection:'row',gap:10},
  sortPeriodOption:{flex:1,minHeight:43,borderRadius:12,borderWidth:1,borderColor:'#D8DCEA',
    backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  sortPeriodSelected:{backgroundColor:'#4030AF',borderColor:'#4030AF',shadowColor:'#4535B5',shadowOpacity:0.14,shadowRadius:8,elevation:3},
  sortPeriodContent:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  sortPeriodText:{fontSize:13,fontWeight:'800',color:'#172552'},
  sortPeriodTextSelected:{color:'#FFFFFF'},
  sortChoices:{gap:4},
  sortChoice:{flexDirection:'row',alignItems:'center',gap:11,minHeight:46,paddingHorizontal:13,
    borderRadius:13,backgroundColor:'#FFFFFF',shadowColor:'#31296A',shadowOpacity:0.06,
    shadowRadius:10,shadowOffset:{width:0,height:3},elevation:2},
  sortChoiceSelected:{backgroundColor:'#EFEBFF'},
  sortChoiceText:{flex:1,fontSize:13,color:'#172552',fontWeight:'600'},
  sortChoiceTextSelected:{color:'#3829A9',fontWeight:'800'},
  sortChoiceCountBadge:{minWidth:38,minHeight:28,borderRadius:15,alignItems:'center',justifyContent:'center',paddingHorizontal:11},
  sortChoiceCount:{fontSize:12,fontWeight:'800'},
  sortCountPurple:{backgroundColor:'#DDDDFE'},
  sortCountPurpleText:{color:'#4331BC'},
  sortCountGreen:{backgroundColor:'#DFF8E9'},
  sortCountGreenText:{color:'#16A067'},
  sortCountRed:{backgroundColor:'#FCE5E5'},
  sortCountRedText:{color:'#CC3D42'},
  sortCountAmber:{backgroundColor:'#FFF0D9'},
  sortCountAmberText:{color:'#CC8618'},
  sortError:{color:'#B42318',fontSize:11,marginTop:8},
  sortApply:{height:46,borderRadius:24,alignItems:'center',justifyContent:'center',
    backgroundColor:'#4030AF',marginTop:14,marginBottom:3,overflow:'hidden',shadowColor:'#4530B5',shadowOpacity:0.19,shadowRadius:8,elevation:5},
  sortApplyContent:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},
  sortApplyText:{fontSize:14,fontWeight:'800',color:'#FFFFFF'},
  quickActionsSection: { marginHorizontal: 12, marginTop: 13, marginBottom: 2 },
  policyListHeadingSection: { marginHorizontal: 12, marginTop: 9, marginBottom: 10, flexDirection:'row',alignItems:'center',gap:10 },
  businessLineButton:{flexDirection:'row',alignItems:'center',gap:7,minHeight:30,paddingHorizontal:3,backgroundColor:'transparent',borderWidth:0},
  businessLineText:{color:'#17365D',fontSize:12,fontWeight:'800'},
  businessLineMenu:{position:'absolute',width:210,padding:7,borderWidth:1,borderColor:'#D7E1EF',borderRadius:14,backgroundColor:'#FFFFFF',shadowColor:'#001B42',shadowOpacity:0.15,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:12},
  businessLineMenuTitle:{paddingHorizontal:10,paddingTop:9,paddingBottom:8,color:'#93A1B5',fontSize:10,letterSpacing:0.7,fontWeight:'700'},
  businessLineOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,minHeight:38,borderRadius:9},
  businessLineSelected:{backgroundColor:'#EDF3FC'},
  businessLineOptionText:{color:'#40536F',fontSize:12,fontWeight:'600'},
  businessLineOptionSelectedText:{color:'#17365D',fontWeight:'700'},
  quickActionsHeading: { marginHorizontal: 3, marginBottom: 8, color: '#17365D', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  quickActionsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  quickAction: {
    flex: 1, minWidth: 0, minHeight: 74,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, paddingVertical: 6, gap: 4,
    backgroundColor: 'transparent',
  },
  quickActionPressed: { opacity: 0.78 },
  quickActionImage: { width: 48, height: 48 },
  quickActionLabel: {
    color: '#102D55', fontSize: 9.25, lineHeight: 12,
    fontWeight: '800', textAlign: 'center', width: '100%',
    includeFontPadding: false,
  },
  feedback: { marginHorizontal: 12, marginTop: 7 },
  tabsRow: {
    minHeight: 48,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  tabsScroller: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { backgroundColor: '#EEF4FF', borderBottomColor: '#3156B8' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2.5 },
  tabText: { color: '#708099', textAlign: 'center', fontSize: 9.2, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  tabTextActive: { color: '#183E87', fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  tabCount: { color: '#8B98AA', fontSize: 8.2, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  tabCountActive: { color: '#3156B8' },
  cardGap: { height: 5 },
  policyCard: {
    minHeight: 68,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9F3',
  },
  policyCardPressed: { backgroundColor: '#F6F9FF' },
  policyIconShell: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E9F3',
    overflow: 'hidden',
  },
  insurerLogo: { width: 33, height: 33 },
  policyIconMini: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3156B8',
  },
  policyMain: { flex: 1, minWidth: 0 },
  customerName: { color: '#173A7D', fontSize: 13, lineHeight: 17, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 10, lineHeight: 13, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  vehicleText: { marginTop: 1, color: '#7D8CA1', fontSize: 9.2, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  policyRight: { width: 120, alignItems: 'flex-end' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  policyPeriod: { marginTop: 4, color: '#72829A', fontSize: 8.5, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '600', textAlign: 'right' },
  listFooter: { minHeight: 58, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: '#708099', fontSize: 8, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  loadMoreButton: {
    marginHorizontal: 12,
    marginTop: 5,
    minHeight: 36,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5FD',
  },
  loadMoreButtonLoading: { backgroundColor: '#3156B8' },
  loadMoreText: { color: '#3156B8', fontSize: 8, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  loadMoreTextLoading: { color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  endText: { color: '#9AA6B7', fontSize: 7, lineHeight: 10, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  pressed: { opacity: 0.72 },
});