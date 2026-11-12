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
const rowOneStart = activity.indexOf('<View style={styles.itemRow}>', cardStart);
const rowTwoStart = activity.indexOf('<View style={styles.itemRow}>', rowOneStart + 1);
const referencePos = activity.indexOf('{item.title}</Text>', rowOneStart);
const badgePos = activity.indexOf('<View style={styles.kindPill}>', rowOneStart);
const customerPos = activity.indexOf('{item.subtitle}</Text>', rowTwoStart);
const datePos = activity.indexOf('<View style={styles.dateAndUnread}>', rowTwoStart);
expect(cardStart >= 0 && rowOneStart > cardStart && rowTwoStart > rowOneStart &&
  referencePos > rowOneStart && referencePos < badgePos && badgePos < rowTwoStart,
  "Row one places the reference at left and the category badge at right");
expect(customerPos > rowTwoStart && customerPos < datePos &&
  datePos > rowTwoStart, "Row two places customer at left and timestamp/unread dot at right");
const itemRowStyle = activity.split("  itemRow: {")[1]?.split("  },")[0] ?? "";
expect(itemRowStyle.includes("flexDirection: 'row'") &&
  itemRowStyle.includes("justifyContent: 'space-between'") &&
  itemRowStyle.includes("alignItems: 'center'"), "Activity uses two horizontally balanced, vertically aligned compact rows");
const kindPillStyle = activity.split("  kindPill: {")[1]?.split("  },")[0] ?? "";
expect(kindPillStyle.includes('flexShrink: 0') && !kindPillStyle.includes("alignSelf: 'flex-start'"),
  "Badge stays at right without shrinking or forcing left alignment");
expect(activity.includes("  itemBody: { flex: 1, minWidth: 0, gap: 3 }") &&
  activity.includes("    minHeight: 54,") && activity.includes("    paddingVertical: 4,"),
  "Activity card removes excess blank height and retains two compact rows");
expect(activity.includes("  title: {\\n    flexShrink: 1,") ||
  (activity.includes("  title: {") && activity.includes("  subtitle: {") && activity.includes("    minWidth: 0,")),
  "Long references and customer names shrink without displacing right-side metadata");
expect(activity.includes("styles.itemCardUnread") && activity.includes("styles.unreadDot") &&
  activity.includes("styles.titleRead"), "Unread highlight, dot and muted read state remain intact");

// Activity-only layout refresh: title, iOS/Android safe-area color, compact width and reference overflow.
expect(activity.includes('<PartnerScreen title="Activity" hideTopBar fullWidth statusBarColor="#0879DF">'), "Activity title, full-width screen and blue status-bar opt-in are configured");
expect(activity.includes('<Text style={styles.heroTitle}>Activity</Text>') && !activity.includes('What changed'), "Visible Activity header no longer says What changed");
expect(screen.includes('statusBarColor?: string;') && screen.includes('statusBarColor ? { backgroundColor: statusBarColor } : null'), "Shared PartnerScreen supports an opt-in colored safe area");
expect(screen.includes("backgroundColor={statusBarColor ?? (navyStatusBar ? '#071E49' : undefined)}") && screen.includes("style={statusBarColor || navyStatusBar"), "Status bar uses matching color and light system indicators");
expect(activity.includes('  body: {') && activity.includes('    paddingHorizontal: 8,') && activity.includes("  hero: {") && !activity.includes('marginHorizontal: -partnerTheme.spacing.lg'), "Activity cards use compact 8px margins and a full-width header");
expect(activity.includes('numberOfLines={1} ellipsizeMode="middle"') && activity.includes('{item.title}</Text>'), "Long policy/claim references truncate in the middle instead of clipping");
expect(activity.includes("styles.itemRow") && activity.includes("styles.kindPill") && activity.includes("styles.dateAndUnread"), "Compact rows retain category and date metadata on the right");
expect(activity.includes('styles.dateAndUnread') && activity.includes('styles.unreadDot') && activity.includes('styles.itemCardUnread'), "Date and unread styles are preserved");

expect(activity.includes('<Text style={styles.heroTitle}>Activity</Text>'), "Activity retains one clear main heading");
expect(!activity.includes('<Text style={styles.heroEyebrow}>ACTIVITY</Text>'), "Redundant small ACTIVITY eyebrow is removed");
expect(!activity.includes('name="megaphone"') && !activity.includes('styles.heroIcon'), "Old megaphone and its boxed tile are removed from Activity header");
expect(activity.includes('name="notifications-outline" size={23} color="#FFFFFF" style={styles.heroActivityIcon}'), "Header uses a relevant notification icon directly against blue");
expect(activity.includes('name="calendar-outline"') && activity.includes('name="document-text-outline"'), "Distinct renewal and claim attention icons remain intact");

if (!process.exitCode) console.log("Partner activity unread/search regression passed.");
