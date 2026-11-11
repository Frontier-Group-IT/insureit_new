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

if (!process.exitCode) console.log("Partner activity unread/search regression passed.");
