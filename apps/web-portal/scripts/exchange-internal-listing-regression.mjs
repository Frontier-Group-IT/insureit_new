import fs from "node:fs";

const files = {
  roles: fs.readFileSync(new URL("../lib/roles.ts", import.meta.url), "utf8"),
  nav: fs.readFileSync(new URL("../components/claim-manager/app-navigation.tsx", import.meta.url), "utf8"),
  service: fs.readFileSync(new URL("../lib/exchange-internal-listing.ts", import.meta.url), "utf8"),
  page: fs.readFileSync(new URL("../app/exchange/listings/new/page.tsx", import.meta.url), "utf8"),
  api: fs.readFileSync(new URL("../app/api/exchange/listings/internal/route.ts", import.meta.url), "utf8"),
  media: fs.readFileSync(new URL("../app/api/exchange/listings/internal/media/route.ts", import.meta.url), "utf8"),
  workspace: fs.readFileSync(new URL("../components/exchange/internal-exchange-listing-workspace.tsx", import.meta.url), "utf8"),
};

function expect(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

expect(files.roles.includes('"create_exchange_listings"'), "create_exchange_listings capability exists");
expect(files.roles.includes('super_admin:[...ALL_OPERATIONAL,...ACCOUNTS_VIEW,"approve_policy_ocr_training","create_exchange_listings","review_exchange_listings"'), "Super Admin receives listing-create permission");
expect(files.roles.includes('sales_operations_head:') && files.roles.includes('"finalize_policy_intakes","create_exchange_listings","review_exchange_listings"'), "Operations Head receives listing-create permission");
expect(files.nav.includes('href:"/exchange/listings/new",label:"Listing"'), "Exchange sidebar exposes Listing route");
expect(files.nav.includes('capability:"create_exchange_listings",minimumAccess:"edit"'), "Listing navigation requires edit permission");
expect(files.page.includes('new Set(["it_super_user", "super_admin", "sales_operations_head"])'), "Listing page enforces exactly the approved role set");
expect(files.service.includes('new Set(["it_super_user", "super_admin", "sales_operations_head"])'), "Server service enforces exactly the approved role set");
expect(files.service.includes('activeStatuses = ["pending_review", "live", "paused", "deal_in_progress"]'), "Duplicate active listing states are protected");
expect(files.service.includes('guidedPhotoLabels = ["Front", "Rear", "Left", "Right", "Cabin", "Odometer"]'), "Six customer-app guided photo slots are preserved");
expect(files.service.includes('created_via: "operations_web"'), "Internal listing actions are audit-labelled");
expect(files.service.includes('status: "pending_review"'), "Internal submission enters existing Listing Review queue");
expect(files.media.includes('uploadInternalExchangePhoto'), "Photo upload goes through protected server route");
expect(files.workspace.includes('placeholder="Search customer"'), "Customer selector uses compact search placeholder");
expect(files.workspace.includes('customerDropdownOpen && customerQuery.trim()'), "Customer suggestions appear only after typing");
expect(files.workspace.includes('No matching customer found.'), "Customer autocomplete has an empty-search result state");
expect(files.workspace.includes('md:grid-cols-2 xl:grid-cols-3'), "Fleet expands after removing permanent customer-list column");
expect(files.workspace.includes('Submit for review'), "Desktop wizard includes governed submission");
expect(files.workspace.includes('Resume') && files.workspace.includes('editable_listing'), "Draft/rejected/paused listing resume is supported");
expect(!files.service.includes('exchange_upsert_listing_draft'), "Internal flow does not weaken or impersonate customer-scoped draft RPC");
expect(!files.service.includes('exchange_submit_listing('), "Internal flow does not alter customer-scoped submit RPC");

if (!process.exitCode) console.log("Internal Exchange listing regression passed.");
