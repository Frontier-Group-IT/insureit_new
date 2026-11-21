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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerProfileAvatar } from '@/components/ui/partner-profile-avatar';
import { PartnerMotionBadge } from '@/components/ui/partner-motion-badge';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerDatePicker } from '@/components/ui/partner-date-picker';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerPolicySummary,
  getPartnerPolicyPeriodCounts,
  getPartnerAdvancedPolicyCounts,
  getPartnerPolicyFilterOptions,
  type PartnerPolicyFilterOption,
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
let savedPolicySource='all', savedPolicyRm='all', savedPolicyFrom='', savedPolicyTo='';
type PolicyFilterTab='period'|'source'|'rm'|'date';
const isoDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseFilterDate=(value:string)=>value?new Date(value+'T12:00:00'):null;
const todayDate=()=>new Date();
const quickDateRange=(key:'mtd'|'90'|'365')=>{
 const now=todayDate();
 if(key==='mtd')return {from:isoDate(new Date(now.getFullYear(),now.getMonth(),1)),to:isoDate(now)};
 const from=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 from.setDate(from.getDate()-(key==='90'?89:364));
 return {from:isoDate(from),to:isoDate(now)};
};
const selectedDatePreset=(from:string,to:string):'all'|'mtd'|'90'|'365'|null=>{
  if(!from&&!to)return 'all';
  for(const key of ['mtd','90','365'] as const){
    const range=quickDateRange(key);
    if(from===range.from&&to===range.to)return key;
  }
  return null;
};
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
  const [draftCounts, setDraftCounts] = useState<PartnerPolicyPeriodCounts | null>(null);
  const [draftCountsLoading, setDraftCountsLoading] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<PartnerPolicyPeriod>(savedPolicyPeriod);
  const [draftLifecycle, setDraftLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [filterTab,setFilterTab]=useState<PolicyFilterTab>('period');
  const [source,setSource]=useState(savedPolicySource);
  const [rm,setRm]=useState(savedPolicyRm);
  const [fromDate,setFromDate]=useState(savedPolicyFrom);
  const [toDate,setToDate]=useState(savedPolicyTo);
  const [draftSource,setDraftSource]=useState(savedPolicySource);
  const [draftRm,setDraftRm]=useState(savedPolicyRm);
  const [draftFromDate,setDraftFromDate]=useState(savedPolicyFrom);
  const [draftToDate,setDraftToDate]=useState(savedPolicyTo);
  const [sourceSearch,setSourceSearch]=useState('');
  const [rmSearch,setRmSearch]=useState('');
  const advanced=source!=='all'||rm!=='all'||Boolean(fromDate)||Boolean(toDate);
  const [businessLine, setBusinessLine] = useState<PartnerPolicyBusinessLine>('all');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [lineMenuPosition, setLineMenuPosition] = useState({top:300,left:88});
  const lineButtonRef = useRef<View>(null);
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
  }, [period, lifecycle, debouncedSearch, businessLine, source, rm, fromDate, toDate]);

  useEffect(() => {
    savedPolicyQuery = query;
    savedPolicyLifecycle = lifecycle;
    savedPolicyPeriod = period;
    savedPolicySource=source; savedPolicyRm=rm; savedPolicyFrom=fromDate; savedPolicyTo=toDate;
  }, [lifecycle, period, query, source, rm, fromDate, toDate]);

  const fetchSummary = useCallback(() => getPartnerPolicySummary(), []);
  const fetchPeriodCounts = useCallback(() =>
    advanced
      ? getPartnerAdvancedPolicyCounts({businessLine,search:debouncedSearch,source,rm,fromDate,toDate})
      : getPartnerPolicyPeriodCounts({businessLine,search:debouncedSearch}),
    [businessLine,debouncedSearch,advanced,source,rm,fromDate,toDate]);
  const filterOptions=usePartnerQuery({
    scopeKey:cacheScopeKey,
    key:`policies:filter-options:${businessLine}`,
    fetcher:()=>getPartnerPolicyFilterOptions(businessLine),
    staleTimeMs:120_000,
  });
  const periodCounts = usePartnerQuery<PartnerPolicyPeriodCounts>({
    scopeKey:cacheScopeKey,
    key:`policies:period-counts:${businessLine}:${debouncedSearch||'all'}:${source}:${rm}:${fromDate}:${toDate}`,
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
      period,source,rm,fromDate,toDate,
      search: debouncedSearch,
      limit,
      offset,
    });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, lifecycle, businessLine, period, source,rm,fromDate,toDate]);

  const collection = usePartnerPageQuery<PartnerPolicyRow>({
    scopeKey: cacheScopeKey,
    // The requested limit is part of the cache identity. Without this, increasing
    // 10 -> 20 can reuse the cached 10-row "page 0" result and appear to do nothing.
    key: `policies:list:${period}:${lifecycle}:${businessLine}:${source}:${rm}:${fromDate}:${toDate}:${debouncedSearch||'all'}:limit:${visibleLimit}`,
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

  const draftFiltersMatchApplied = draftSource===source && draftRm===rm &&
    draftFromDate===fromDate && draftToDate===toDate;
  // The draft period is not part of this request: each response contains both MTD and All.
  // Fetch counts for draft Source/RM/Date selections before Apply, rather than displaying
  // stale counts from the applied filter or hiding status badges until Apply.
  useEffect(()=>{
    if(!sortSheetOpen || draftFiltersMatchApplied){
      setDraftCounts(null);
      setDraftCountsLoading(false);
      return;
    }
    let active=true;
    setDraftCounts(null);
    setDraftCountsLoading(true);
    const draftAdvanced=draftSource!=='all'||draftRm!=='all'||Boolean(draftFromDate)||Boolean(draftToDate);
    const countRequest=draftAdvanced
      ? getPartnerAdvancedPolicyCounts({businessLine,search:debouncedSearch,source:draftSource,rm:draftRm,fromDate:draftFromDate,toDate:draftToDate})
      : getPartnerPolicyPeriodCounts({businessLine,search:debouncedSearch});
    void countRequest.then(result=>{if(active)setDraftCounts(result);})
      .catch(()=>{if(active)setDraftCounts(null);})
      .finally(()=>{if(active)setDraftCountsLoading(false);});
    return ()=>{active=false;};
  },[sortSheetOpen,draftFiltersMatchApplied,draftSource,draftRm,draftFromDate,draftToDate,businessLine,debouncedSearch]);
  const draftStatusCounts = draftFiltersMatchApplied ? periodCounts.data?.[draftPeriod] : draftCounts?.[draftPeriod];
  useEffect(() => {
    if (!isFocused) { setLineMenuOpen(false); setSortSheetOpen(false); }
  }, [isFocused]);

  const openSortSheet = () => {
    setLineMenuOpen(false);
    setDraftPeriod(period);
    setDraftLifecycle(lifecycle);
    setDraftSource(source);setDraftRm(rm);setDraftFromDate(fromDate);setDraftToDate(toDate);
    setSourceSearch('');setRmSearch('');setFilterTab('period');
    setSortSheetOpen(true);
  };
  const applySortSheet = () => {
    if(draftFromDate&&draftToDate&&draftFromDate>draftToDate)return;
    setSortSheetOpen(false);
    setPeriod(draftPeriod);
    setLifecycle(draftLifecycle);
    setSource(draftSource);setRm(draftRm);
    setFromDate(draftFromDate);setToDate(draftToDate);
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
        <View accessibilityLabel="Filter options are available from the bottom Sort button"
          style={styles.filterButton} pointerEvents="none">
          <Ionicons name="filter-outline" size={18} color="#3156B8" />
          <Text style={styles.filterText}>Filter</Text>
        </View>
      </View>

  );

  const header = (
    <View>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/partner/banners/claims-header-reference.jpg')}
          resizeMode="cover"
          style={styles.heroBackdrop}
        />
        <View style={styles.heroShade} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroBrand}>
            <Image
              source={require('../../assets/insureit-partner-official.png')}
              resizeMode="contain"
              style={styles.heroLogo}
              accessibilityLabel="InsureIT Partner"
            />
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
              <Feather name="bell" size={20} color="#FFFFFF" />
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
      {isFocused ? <StatusBar style={searchSticky ? 'light' : 'dark'} /> : null}
      {searchSticky && safeAreaInsets.top > 0 ? <View pointerEvents="none" style={[styles.stickyStatusBarShield, { height: safeAreaInsets.top }]} /> : null}
      {searchSticky ? <View style={[styles.stickySearchOverlay, { top: safeAreaInsets.top }]} pointerEvents="box-none"><Text style={styles.stickyClaimsHeading}>Policies</Text>{searchControls}</View> : null}
      {isFocused && !sortSheetOpen && !lineMenuOpen ? (
        <View pointerEvents="box-none" style={styles.sortFloatingPosition}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort and filter policies"
            accessibilityHint="Opens Period, Source, RM, Date Range and Policy Status filters"
            onPress={openSortSheet}
            style={({ pressed }) => [styles.sortFloatingButton, pressed && styles.sortFloatingPressed]}>
            <Ionicons name="swap-vertical" size={17} color="#182B56"/>
            <Text style={styles.sortFloatingLabel}>Sort by</Text>
          </Pressable>
        </View>
      ) : null}
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
      <Modal visible={sortSheetOpen} transparent animationType="slide" statusBarTranslucent={false} onRequestClose={()=>setSortSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={styles.sortOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close sort by popup" onPress={()=>setSortSheetOpen(false)}/>
          <View style={[styles.sortSheet,{paddingBottom:Math.max(12,safeAreaInsets.bottom+7),maxHeight:windowHeight-Math.max(safeAreaInsets.top,20)-12}]}>
            <View style={styles.sortSheetHeader}>
              <Text style={styles.sortSheetTitle}>Sort by</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close sort by popup" onPress={()=>setSortSheetOpen(false)} style={styles.sortSheetClose}>
                <Ionicons name="close" size={23} color="#586580"/>
              </Pressable>
            </View>
            <View style={styles.advancedTabs}>
              {([
                {key:'period',label:'Period',icon:'calendar'},
                {key:'source',label:'Source',icon:'sliders'},
                {key:'rm',label:'RM',icon:'users'},
                {key:'date',label:'Date Range',icon:'calendar'},
              ] as const).map(tab=><Pressable key={tab.key} accessibilityRole="tab"
                accessibilityLabel={tab.label} accessibilityState={{selected:filterTab===tab.key}}
                onPress={()=>setFilterTab(tab.key)}
                style={[styles.advancedTab,filterTab===tab.key&&styles.advancedTabActive]}>
                <Feather name={tab.icon} size={12} color={filterTab===tab.key?'#4230B3':'#53647D'}/>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                  style={[styles.advancedTabText,filterTab===tab.key&&styles.advancedTabTextActive]}>{tab.label}</Text>
              </Pressable>)}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              style={[styles.advancedPanel,{maxHeight:Math.max(160,windowHeight-safeAreaInsets.top-safeAreaInsets.bottom-210)}]} contentContainerStyle={styles.sortSheetBody}>
              {filterTab==='period'?<>
                <View style={styles.sortSectionHeading}><Feather name="calendar" size={18} color="#182557"/>
                  <Text style={styles.sortSectionLabel}>Period</Text></View>
                <View style={styles.sortPeriodRow}>
                  {(['mtd','all'] as const).map(value=>{
                    const selected=draftPeriod===value;
                    return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value==='mtd'?'MTD':'All'}
                      accessibilityState={{selected}} onPress={()=>setDraftPeriod(value)}
                      style={[styles.sortPeriodOption,selected&&styles.sortPeriodSelected]}>
                      <Text style={[styles.sortPeriodText,selected&&styles.sortPeriodTextSelected]}>{value==='mtd'?'MTD':'All'}</Text>
                    </Pressable>;
                  })}
                </View>
                <View style={styles.sortSectionDivider}/>
                <View style={styles.sortSectionHeading}><Ionicons name="layers-outline" size={19} color="#182557"/>
                  <Text style={styles.sortSectionLabel}>All Policies Status</Text></View>
                <View style={styles.sortChoices}>
                  {sheetStatuses.map(option=>{
                    const selected=draftLifecycle===option.lifecycle;
                    const count=draftStatusCounts?.[option.value];
                    return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label}
                      accessibilityState={{selected}} onPress={()=>setDraftLifecycle(option.lifecycle)}
                      style={[styles.sortChoice,selected&&styles.sortChoiceSelected]}>
                      <Ionicons name={selected?'radio-button-on':'radio-button-off'} color={selected?'#4230B3':'#A3A9B1'} size={22}/>
                      <Text style={[styles.sortChoiceText,selected&&styles.sortChoiceTextSelected]}>{option.label}</Text>
                      <View style={styles.sortChoiceCountBadge}>
                         <Text style={styles.sortChoiceCount}>{count===undefined?(draftCountsLoading?'…':'—'):count.toLocaleString('en-IN')}</Text>
                       </View>
                    </Pressable>;
                  })}
                </View>
              </>:null}
              {filterTab==='source'?<>
                <View style={styles.advancedSearch}><Feather name="search" size={17} color="#8190A7"/>
                  <TextInput value={sourceSearch} onChangeText={setSourceSearch}
                    accessibilityLabel="Search sources" placeholder="Search source..."
                    placeholderTextColor="#91A0B4" style={styles.advancedSearchInput}/></View>
                <Pressable accessibilityRole="button" accessibilityState={{selected:draftSource==='all'}}
                  onPress={()=>setDraftSource('all')} style={[styles.advancedOption,draftSource==='all'&&styles.sortChoiceSelected]}>
                  <Ionicons name={draftSource==='all'?'checkbox':'square-outline'} size={20} color="#4230B3"/>
                  <Text style={styles.sortChoiceText}>All Sources</Text></Pressable>
                {filterOptions.loading?<ActivityIndicator color="#4030AF"/>:filterOptions.error?
                  <Text style={styles.sortError}>Sources unavailable. Check network and retry.</Text>:
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator
                    style={styles.advancedOptionsScroll} contentContainerStyle={styles.advancedOptionsContent}>
                    {(filterOptions.data?.sources??[]).filter((option:PartnerPolicyFilterOption)=>
                      option.label.toLowerCase().includes(sourceSearch.trim().toLowerCase())||
                      option.value.toLowerCase().includes(sourceSearch.trim().toLowerCase())
                    ).map((option:PartnerPolicyFilterOption)=><Pressable key={option.value} accessibilityRole="button"
                      accessibilityLabel={option.label} accessibilityState={{selected:draftSource===option.value}}
                      onPress={()=>setDraftSource(option.value)}
                      style={[styles.advancedOption,draftSource===option.value&&styles.sortChoiceSelected]}>
                      <Ionicons name={draftSource===option.value?'checkbox':'square-outline'} size={20} color="#4230B3"/>
                      <Text style={styles.sortChoiceText} numberOfLines={2}>{option.label}</Text></Pressable>)}
                  </ScrollView>}
              </>:null}
              {filterTab==='rm'?<>
                <View style={styles.advancedSearch}><Feather name="search" size={17} color="#8190A7"/>
                  <TextInput value={rmSearch} onChangeText={setRmSearch}
                    accessibilityLabel="Search RMs" placeholder="Search RM..."
                    placeholderTextColor="#91A0B4" style={styles.advancedSearchInput}/></View>
                <Pressable accessibilityRole="button" accessibilityState={{selected:draftRm==='all'}}
                  onPress={()=>setDraftRm('all')} style={[styles.advancedOption,draftRm==='all'&&styles.sortChoiceSelected]}>
                  <Ionicons name={draftRm==='all'?'checkbox':'square-outline'} size={20} color="#4230B3"/>
                  <Text style={styles.sortChoiceText}>All RMs</Text></Pressable>
                {filterOptions.loading?<ActivityIndicator color="#4030AF"/>:filterOptions.error?
                  <Text style={styles.sortError}>RMs unavailable. Check network and retry.</Text>:
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator
                    style={styles.advancedOptionsScroll} contentContainerStyle={styles.advancedOptionsContent}>
                    {(filterOptions.data?.rms??[]).filter((name:string)=>name.toLowerCase().includes(rmSearch.trim().toLowerCase()))
                    .map((name:string)=><Pressable key={name} accessibilityRole="button" accessibilityLabel={name}
                      accessibilityState={{selected:draftRm===name}} onPress={()=>setDraftRm(name)}
                      style={[styles.advancedOption,draftRm===name&&styles.sortChoiceSelected]}>
                      <Ionicons name={draftRm===name?'checkbox':'square-outline'} size={20} color="#4230B3"/>
                      <Text style={styles.sortChoiceText} numberOfLines={2}>{name}</Text></Pressable>)}
                  </ScrollView>}
              </>:null}
              {filterTab==='date'?<>
                <Text style={styles.sortSectionLabel}>Date Range</Text>
                <View style={styles.advancedPresets}>
                  {([
                    {key:'all',label:'All Dates'},
                    {key:'mtd',label:'MTD'},
                    {key:'90',label:'90 Days'},
                    {key:'365',label:'365 Days'},
                  ] as const).map(option=><Pressable key={option.key} accessibilityRole="button"
                    accessibilityState={{selected:selectedDatePreset(draftFromDate,draftToDate)===option.key}}
                    onPress={()=>{if(option.key==='all'){setDraftFromDate('');setDraftToDate('');}
                      else {const dates=quickDateRange(option.key);setDraftFromDate(dates.from);setDraftToDate(dates.to);}}}
                    style={[styles.advancedPreset,selectedDatePreset(draftFromDate,draftToDate)===option.key&&styles.advancedPresetSelected]}>
                    <Text style={[styles.advancedPresetText,selectedDatePreset(draftFromDate,draftToDate)===option.key&&styles.advancedPresetTextSelected]}>{option.label}</Text>
                  </Pressable>)}
                </View>
                <View style={styles.advancedDates}>
                  <View style={{flex:1}}><PartnerDatePicker directSelect label="From" value={parseFilterDate(draftFromDate)}
                    onChange={date=>setDraftFromDate(isoDate(date))} maximumDate={parseFilterDate(draftToDate)??undefined}/></View>
                  <View style={{flex:1}}><PartnerDatePicker directSelect label="To" value={parseFilterDate(draftToDate)}
                    onChange={date=>setDraftToDate(isoDate(date))} minimumDate={parseFilterDate(draftFromDate)??undefined}/></View>
                </View>
                {draftFromDate&&draftToDate&&draftFromDate>draftToDate?
                  <Text style={styles.sortError}>The start date must be before the end date.</Text>:null}
              </>:null}
              {periodCounts.error?<Text style={styles.sortError}>Policy counts are temporarily unavailable.</Text>:null}
            </ScrollView>
            <View style={styles.advancedFooter}>
              <Pressable accessibilityRole="button" accessibilityLabel="Reset Filters" style={styles.advancedReset}
                onPress={()=>{setDraftPeriod('all');setDraftLifecycle('all');setDraftSource('all');setDraftRm('all');
                  setDraftFromDate('');setDraftToDate('');setSourceSearch('');setRmSearch('');setFilterTab('period');}}>
                <Feather name="rotate-ccw" size={17} color="#172552"/>
                <Text style={styles.advancedResetText}>Reset Filters</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply policy filters"
                disabled={Boolean(draftFromDate&&draftToDate&&draftFromDate>draftToDate)}
                style={styles.advancedApply} onPress={applySortSheet}>
                <Feather name="filter" size={18} color="#FFFFFF"/>
                <Text style={styles.sortApplyText}>Apply Filter</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  content: { paddingBottom: 120, backgroundColor: '#FFFFFF' },
  contentEmpty: { flexGrow: 1 },
  hero: {
    height: 98,
    overflow: 'hidden',
    backgroundColor: '#0752A2',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1,42,95,0.10)',
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
  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },
  heroBrandCopy: { justifyContent: 'center' },
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
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
    backgroundColor: 'rgba(4,33,78,0.72)',
    borderWidth: 1.25,
    borderColor: '#FFFFFF',
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
    borderColor: 'rgba(255,255,255,0.98)',
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
    color: '#FFFFFF',
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
  statusMenuOverlay: { flex: 1 },
  summaryChipPressed: { opacity: 0.78 },
  filterButton: {
    height: 44,
    minWidth: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#D9DFEA',
  },
  filterText: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: '500' },
  sortFloatingPosition: { position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center', zIndex: 25, elevation: 8 },
  sortFloatingButton: { minHeight: 46, minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#F0EBFF', shadowColor: '#7D68A9', shadowOpacity: 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  sortFloatingPressed: { backgroundColor: '#E4DAFA' },
  sortFloatingLabel: { color: '#182B56', fontSize: 13, fontWeight: '700' },
  sortOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(16,30,66,0.73)'},
  sortSheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:18,paddingTop:10},
  sortSheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:8,borderBottomWidth:1,borderColor:'#E4E5F1'},
  sortSheetTitle:{fontSize:17,fontWeight:'800',color:'#14244B'},
  sortSheetClose:{minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'},
  sortSheetBody:{paddingTop:8,paddingBottom:3},
  advancedTabs:{flexDirection:'row',gap:4,marginTop:11},
  advancedTab:{flex:1,minWidth:0,minHeight:38,flexDirection:'row',gap:3,alignItems:'center',justifyContent:'center',
    borderRadius:10,borderWidth:1,borderColor:'#D7DCEC',paddingHorizontal:3,backgroundColor:'#FFFFFF'},
  advancedTabActive:{backgroundColor:'#EEE7FF',borderColor:'#D4C6FC'},
  advancedTabText:{fontSize:10,fontWeight:'700',color:'#344765',flexShrink:1},
  advancedTabTextActive:{color:'#4230B3'},
  advancedPanel:{flexShrink:1,marginTop:11},
  advancedSearch:{minHeight:41,flexDirection:'row',alignItems:'center',gap:8,
    borderWidth:1,borderColor:'#D9DEEE',borderRadius:12,paddingHorizontal:12,marginTop:9,marginBottom:6},
  advancedSearchInput:{flex:1,minHeight:40,color:'#172552',fontSize:12},
  advancedOption:{height:46,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:10,borderRadius:9},
  // Four records (4 x 46px) remain visible; additional Source/RM entries scroll independently.
  advancedOptionsScroll:{maxHeight:184,flexGrow:0},
  advancedOptionsContent:{flexGrow:0},
  advancedPresets:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},
  advancedPreset:{minHeight:34,paddingHorizontal:11,justifyContent:'center',borderRadius:9,backgroundColor:'#F1EFF9'},
  advancedPresetText:{color:'#27345B',fontSize:11,fontWeight:'700'},
  advancedPresetSelected:{backgroundColor:'#4030AF',borderColor:'#4030AF',borderWidth:1},
  advancedPresetTextSelected:{color:'#FFFFFF',fontWeight:'800'},
  advancedDates:{flexDirection:'row',gap:9,marginTop:13},
  advancedFooter:{flexDirection:'row',gap:9,paddingVertical:11,borderTopWidth:1,borderTopColor:'#E5E7F1'},
  advancedReset:{flex:1,minHeight:45,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderColor:'#C8D0E5',borderRadius:23},
  advancedResetText:{fontSize:12,color:'#1B2950',fontWeight:'800'},
  advancedApply:{flex:1.6,minHeight:45,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',
    borderRadius:23,backgroundColor:'#4030AF'},

  sortSectionHeading:{flexDirection:'row',alignItems:'center',gap:9,marginTop:4,marginBottom:9},
  sortSectionLabel:{fontSize:13,lineHeight:19,color:'#172552',fontWeight:'800'},
  sortSectionDivider:{height:1,backgroundColor:'#E1E3EE',marginTop:12,marginBottom:10},
  sortPeriodRow:{flexDirection:'row',gap:10},
  sortPeriodOption:{flex:1,minHeight:43,borderRadius:12,borderWidth:1,borderColor:'#D8DCEA',
    backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  sortPeriodSelected:{backgroundColor:'#FFFFFF',borderColor:'#4030AF',borderWidth:1.5},
  sortPeriodContent:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  sortPeriodText:{fontSize:13,fontWeight:'800',color:'#172552'},
  sortPeriodTextSelected:{color:'#4030AF'},
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