import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const activity = read("app/activity.tsx");
const screen = read("components/partner-screen.tsx");
const policies = read("app/(tabs)/policies.tsx");
const engagement = read("lib/engagement.ts");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261017150500_partner_activity_read_receipts.sql", import.meta.url),
  "utf8",
);

function expect(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

expect(migration.includes("create table if not exists public.partner_activity_read_receipts"), "Persistent Partner activity read-receipt table exists");
expect(migration.includes("primary key (auth_user_id, event_key)"), "Read receipts are unique per user/activity event");
expect(migration.includes("auth.uid() = auth_user_id"), "Read receipts are RLS-scoped to the signed-in user");
expect(engagement.includes("partnerActivityEventKey"), "Partner activity uses a stable event key");
expect(engagement.includes("getPartnerActivityReadKeys"), "Partner activity can load persistent read state");
expect(engagement.includes("markPartnerActivityRead"), "Opening activity can persist read state");
expect(engagement.includes("getPartnerUnreadActivityCount"), "Header bell can compute unread activity count");
expect(activity.includes('placeholder="Search all activity..."'), "Activity page includes universal search");
expect(activity.includes("['unread', 'Unread', counts.unread]"), "Activity page includes Unread count tab");
expect(activity.includes("['read', 'Read', counts.read]"), "Activity page includes Read count tab");
expect(activity.includes("['all', 'All', counts.all]"), "Activity page includes All count tab");
expect(activity.includes("markPartnerActivityRead(item)"), "Opening an unread activity marks it read");
expect(screen.includes("homeHeroBellBadge"), "Partner header bell renders an unread badge");
expect(screen.includes("unreadActivityCount > 99 ? '99+' : unreadActivityCount"), "Bell badge safely caps large counts");
expect(policies.includes("getPartnerUnreadActivityCount(100)"), "Policies header loads persisted unread activity count");
expect(policies.includes("useFocusEffect"), "Policies header refreshes unread count on focus");
expect(policies.includes("unreadActivityCount > 99 ? \"99+\" : unreadActivityCount"), "Policies bell caps unread count at 99+");
expect(policies.includes("styles.unreadBadge"), "Policies bell displays red unread badge");
expect(!screen.includes("setBadgeCountAsync"), "Feature does not alter the OS application icon badge");


const periodMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261121082430_partner_activity_period_filter.sql", import.meta.url),
  "utf8",
);
expect(activity.includes("Filter activity by date") && activity.includes('name="chevron-down"'), "Activity header has an accessible compact period dropdown");
for (const option of ["Today", "Last Week", "Last Month", "All"]) {
  expect(activity.includes(option), `Activity dropdown supports ${option}`);
}
expect(activity.includes('visible={periodMenuOpen}') && activity.includes('transparent') && activity.includes('style={StyleSheet.absoluteFillObject}') && activity.includes('accessibilityLabel="Close activity date filter"') && activity.includes('onPress={() => setPeriodMenuOpen(false)}'), "Activity dropdown closes when the user taps outside without selecting an option");
expect(activity.includes('onRequestClose={() => setPeriodMenuOpen(false)}') && activity.includes('statusBarTranslucent'), "Activity dropdown supports Android back dismissal and full-screen outside taps");
expect(activity.includes('periodTriggerRef.current?.measureInWindow') && activity.includes('top: y + height + 3') && activity.includes('left: Math.max(8, Math.min(x, windowWidth - 160))'), "Activity dropdown remains anchored to its trigger on different screen sizes");
expect(activity.includes('onPress={() => { setPeriodMenuOpen(false); setPeriod(key); }}'), "Selecting a date period dismisses the menu and applies the selected filter");
expect(activity.includes("setPeriod(key)") && activity.includes("getPartnerActivityByPeriod(period"), "Changing period fetches scoped records instead of relabeling old results");
expect(activity.includes("Load more activity") && activity.includes("loadMore()"), "Historical activity can be paginated");
expect(engagement.includes("partner_app_activity_filtered") && engagement.includes("p_offset: offset"), "Period RPC receives server-side date filter and pagination");
expect(periodMigration.includes("v_start is null or coalesce(p.created_at"), "Policy events filter by policy activity timestamp");
expect(periodMigration.includes("v_start is null or coalesce(h.created_at"), "Claim events filter by claim activity timestamp");
expect(periodMigration.includes("v_start is null or pir.updated_at"), "Intake events filter by intake activity timestamp");
expect(periodMigration.includes("v_start is null or a.created_at"), "Learning events filter by learning timestamp");
expect(periodMigration.includes("v_offset") && periodMigration.includes("has_more"), "Backend pages all authorized events without the previous 100-record total cap");
expect(periodMigration.includes("partner_app_current_identity()") && periodMigration.includes("partner_app_commercial_scope()"), "New RPC retains Partner identity and scope enforcement");
expect(periodMigration.includes("revoke all on function public.partner_app_activity_filtered"), "Anonymous execution is not granted for activity history");

const logoCatalog = read("lib/catalog-logos.ts");
const makerMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261111121500_partner_activity_claim_vehicle_manufacturer.sql", import.meta.url),
  "utf8",
);
expect(engagement.includes("manufacturer?: string | null"), "Partner activity supports optional manufacturer without breaking older API responses");
expect(makerMigration.includes("left join public.vehicles v on v.id=cl.vehicle_id"), "Claim manufacturer comes from the linked claim vehicle");
expect(makerMigration.includes("nullif(trim(v.make),'') manufacturer"), "Manufacturer is resolved from the vehicle make");
expect(makerMigration.includes("'manufacturer',manufacturer"), "Scoped activity API includes manufacturer in its payload");
expect(makerMigration.includes("c.lead_source_intermediary_id=any(v_intermediary_ids)"), "Partner claim scope is preserved");
expect(logoCatalog.includes("getPartnerManufacturerLogoSource"), "Bundled manufacturer logo lookup exists");
expect(activity.includes("item.kind === 'claim'"), "Only claim activities use manufacturer logos");
expect(activity.includes("getPartnerManufacturerLogoSource(item.manufacturer)"), "Claim logo lookup uses manufacturer, not claim status");
expect(activity.includes("logo ?? activityAsset(item.kind)"), "Unknown manufacturers retain the original claim icon fallback");
expect(activity.includes("readKeys.has(partnerActivityEventKey(item))"), "Unread UI follows persisted receipt state");
expect(activity.includes("styles.itemCardUnread") && activity.includes("styles.unreadDot"), "Unread notifications are subtly highlighted and marked");
expect(activity.includes("styles.titleRead") && activity.includes("styles.subtitleUnread"), "Read and unread text contrast differs without changing layout");

expect(activity.includes("styles.attentionCardRenewal") && activity.includes("styles.attentionCardClaim"), "Needs-attention cards use distinct blue and lavender themes");
expect(activity.includes("styles.attentionIcon") && activity.includes("styles.attentionGlyphBadge"), "Needs-attention cards have reference-style white icon tiles with compact badges");
expect(activity.includes('name="calendar-outline"') && activity.includes('name="sync"'), "Renewal card shows calendar and refresh icons");
expect(activity.includes('name="document-text-outline"') && activity.includes('name="shield-checkmark"'), "Claim card shows document and shield icons");
expect(!activity.includes('source={PartnerAssets.status.opportunityAlert}'), "Needs-attention cards no longer repeat generic alert artwork");
expect(!activity.includes('name="chevron-forward" size={21} color="#06155E"'), "Needs-attention cards do not show a right arrow");
expect(!activity.includes("#FFF9EA") && !activity.includes("#F2DCA9"), "Old yellow attention-card palette is removed");
expect(activity.includes('onPress={() => router.push(item.route as never)}'), "Needs-attention cards preserve destination navigation");
expect(activity.includes('data.attention.slice(0, 3)'), "Needs-attention list retains its original maximum length");

const logoTileStyle = activity.split("  logoTile: {")[1]?.split("  },")[0] ?? "";
expect(Boolean(logoTileStyle), "Recent activity still has a dedicated logo alignment container");
expect(!logoTileStyle.includes("backgroundColor"), "Policy insurer and claim manufacturer logos have no white tile background");
expect(activity.includes("style={logo ? styles.insurerLogo : styles.eventArtworkImage}"), "Logo and fallback icon sizing stays unchanged");
expect(activity.includes("source={logo ?? activityAsset(item.kind)}"), "Existing manufacturer, insurer and fallback asset behavior remains intact");
expect(activity.includes("backgroundColor: '#FFFFFF'") && activity.includes("attentionIcon:"), "Needs-attention white icon tiles are retained");

const attentionThemeStyles = ['attentionCardRenewal', 'attentionCardClaim', 'attentionCardOther']
  .map((name) => activity.split(`  ${name}: {`)[1]?.split('},')[0] ?? '');
expect(attentionThemeStyles.every((style) => style.includes("backgroundColor: '#FFFFFF'")), "Every Needs-attention card has a white background");
expect(attentionThemeStyles.every((style) => style.includes('borderColor:')), "Distinct subtle attention card borders remain");
expect(activity.includes("status === 'active' ? styles.attentionTitleActive") &&
  activity.includes("status === 'due' ? styles.attentionTitleDue") &&
  activity.includes("status === 'expired' ? styles.attentionTitleExpired"), "Entire attention title uses the Active, Due or Expired status color");
expect(activity.includes("attentionTitleActive: { color: '#16834B' }") &&
  activity.includes("attentionTitleDue: { color: '#C56B12' }") &&
  activity.includes("attentionTitleExpired: { color: '#DC3545' }"), "Green, orange and red status colors are defined");
expect(activity.includes("function attentionStatus(title: string)") &&
  activity.includes("return null;"), "Unknown attention statuses stay neutral instead of being misclassified");
expect(activity.includes("styles.attentionText") && activity.includes("onPress={() => router.push(item.route as never)}"), "Attention subtitles and card destinations are preserved");
expect(activity.includes("useState<'unread' | 'read' | 'all'>('all')"), "Recent Activity defaults to All");
expect(!activity.includes("setActivityFilter(unreadCount > 0 ? 'unread' : 'all')"), "Loading unread receipts does not override the All default");
expect(activity.includes("onPress={() => setActivityFilter(key)}") &&
  activity.includes("activityFilter === 'unread' && isRead") &&
  activity.includes("activityFilter === 'read' && !isRead"), "Manual Unread and Read filters remain functional");
const cardStart = activity.indexOf('<View style={styles.itemBody}>');
const contentStart = activity.indexOf('<View style={styles.itemContent}>', cardStart);
const rowStart = activity.indexOf('<View style={styles.itemRow}>', contentStart);
const titlePos = activity.indexOf('{item.title}</Text>', rowStart);
const badgePos = activity.indexOf('<View style={styles.kindPill}>', rowStart);
const subtitlePos = activity.indexOf('{item.subtitle}</Text>', badgePos);
const dateColumnPos = activity.indexOf('<View style={styles.dateColumn}>', subtitlePos);
const timeRowPos = activity.indexOf('<View style={styles.timeRow}>', dateColumnPos);
expect(cardStart >= 0 && contentStart > cardStart && rowStart > contentStart &&
  titlePos > rowStart && badgePos > titlePos && subtitlePos > badgePos &&
  dateColumnPos > subtitlePos && timeRowPos > dateColumnPos,
  "Activity displays title/category and description at left, date and time at right");
expect(activity.includes('formatActivityDate(item.event_at)') &&
  activity.includes('formatActivityTime(item.event_at)') &&
  activity.includes('styles.unreadDot'),
  "Every activity date/time uses its original event timestamp and unread badge");
const cardStyle = activity.split("  itemCard: {")[1]?.split("  },")[0] ?? "";
expect(cardStyle.includes("minHeight: 54") && cardStyle.includes("paddingVertical: 4"),
  "Activity cards remain compact without excess vertical space");
const itemBodyStyle = activity.split("  itemBody: {")[1]?.split("},")[0] ?? "";
const dateColumnStyle = activity.split("  dateColumn: {")[1]?.split("},")[0] ?? "";
expect(itemBodyStyle.includes("flexDirection: 'row'") &&
  dateColumnStyle.includes("alignItems: 'flex-end'") &&
  dateColumnStyle.includes("maxWidth: 90"),
  "Date/time stays in a bounded right-aligned column on narrow phones");
expect(activity.includes('  title: {') && activity.includes('  subtitle: {') &&
  activity.includes('    minWidth: 0,'),
  "Long references and subtitles can shrink without displacing the date column");
expect(activity.includes("styles.itemCardUnread") && activity.includes("styles.unreadDot") &&
  activity.includes("styles.titleRead"), "Unread highlight, dot and read styling remain intact");

// Activity-only layout refresh: title, iOS/Android safe-area color, compact width and reference overflow.
expect(activity.includes('title="Activity"') && activity.includes('hideTopBar') && activity.includes('fullWidth') &&
  activity.includes('navyStatusBar') && activity.includes('bottomNavigationNavy') &&
  activity.includes('<PartnerCaseBottomNavigation activeTab="Home" />') &&
  activity.includes("height: 56,") && activity.includes("backgroundColor: '#071E49'"),
  "Activity retains its full-width title, compact 56-point navy header and permission-aware bottom navigation");
expect(activity.includes('<Text style={styles.heroTitle}>Activity</Text>') && !activity.includes('What changed'), "Visible Activity header no longer says What changed");
expect(screen.includes('statusBarColor?: string;') && screen.includes('statusBarColor ? { backgroundColor: statusBarColor } : null'), "Shared PartnerScreen supports an opt-in colored safe area");
expect(screen.includes("backgroundColor={statusBarColor ?? (navyStatusBar ? '#071E49' : undefined)}") && screen.includes("style={statusBarColor || navyStatusBar"), "Status bar uses matching color and light system indicators");
expect(activity.includes('  body: {') && activity.includes('    paddingHorizontal: 8,') && activity.includes("  hero: {") && !activity.includes('marginHorizontal: -partnerTheme.spacing.lg'), "Activity cards use compact 8px margins and a full-width header");
expect(activity.includes('numberOfLines={1} ellipsizeMode="middle"') && activity.includes('{item.title}</Text>'), "Long policy/claim references truncate in the middle instead of clipping");
expect(activity.includes("styles.itemRow") && activity.includes("styles.kindPill") && activity.includes("styles.dateColumn"), "Compact cards retain category metadata and a right-side date column");
expect(activity.includes('styles.timeRow') && activity.includes('styles.unreadDot') && activity.includes('styles.itemCardUnread'), "Time and unread indicators are preserved");

expect(activity.includes('<Text style={styles.heroTitle}>Activity</Text>'), "Activity retains one clear main heading");
expect(!activity.includes('<Text style={styles.heroEyebrow}>ACTIVITY</Text>'), "Redundant small ACTIVITY eyebrow is removed");
expect(!activity.includes('name="megaphone"') && !activity.includes('styles.heroIcon'), "Old megaphone and its boxed tile are removed from Activity header");
expect(activity.includes('name="notifications-outline" size={23} color="#FFFFFF" style={styles.heroActivityIcon}'), "Header uses a relevant notification icon directly against blue");
expect(activity.includes('name="calendar-outline"') && activity.includes('name="document-text-outline"'), "Distinct renewal and claim attention icons remain intact");

if (!process.exitCode) console.log("Partner activity unread/search regression passed.");


const searchField = read("components/ui/partner-search-field.tsx");
const claimRegister = read("app/(tabs)/claims.tsx");
const customerRegister = read("app/customers.tsx");
expect(searchField.includes("suggestions?: readonly string[]"), "Shared Partner input accepts suggestion sources.");
expect(searchField.includes("searchTerm.length >= 2"), "Partner suggestions appear after two characters.");
expect(searchField.includes(".slice(0, 5)"), "Partner suggestions show at most five records.");
expect(searchField.includes("style={styles.suggestionList}"), "Partner autocomplete has a compact dropdown.");
expect(policies.includes("suggestions={debouncedSearch.length >= 2 ? collection.rows"), "Policy suggestions use existing authorized paginated server search.");
expect(claimRegister.includes("suggestions={debouncedSearch.length >= 2 ? rows"), "Claim suggestions use existing authorized paginated server search.");
expect(customerRegister.includes("suggestions={debouncedSearch.length >= 2 ? collection.rows"), "Customer suggestions use existing authorized paginated server search.");


expect(searchField.includes('if (!value.trim()) setChosen("")'), "Clearing Partner search resets the selected suggestion.");
expect(searchField.includes('onChangeText("");') && searchField.includes('onClear?.();'), "Shared Partner search X always resets controlled query even without an optional clear callback.");
expect(searchField.includes('Keyboard.dismiss();'), "Shared Partner search dismisses the keyboard when clearing.");
expect(policies.includes("onClear={() => setQuery('')}"), "Partner policies clear query to refresh server results.");
expect(policies.includes("setVisibleLimit(PAGE_SIZE)"), "Partner policies reset pagination when search changes.");
expect(claimRegister.includes("setVisibleLimit(PAGE_SIZE)"), "Partner claims reset pagination when search changes.");
