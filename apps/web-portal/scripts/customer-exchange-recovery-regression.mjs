import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const page = read("app/customer/(protected)/exchange/page.tsx");
const loader = read("lib/customer-web-phase3-data.ts");
const globalError = read("app/error.tsx");

assert.match(page, /await resolveCustomerWebScope\(params\.account\);/, "Customer authorization must remain outside recovery");
assert.match(page, /try\s*\{\s*rows\s*=\s*await loadCustomerExchangeFeed/, "Marketplace failures must be handled locally");
assert.match(page, /catch\s*\(error\)\s*\{\s*feedUnavailable\s*=\s*true/, "Failed feeds must set recovery state");
assert.match(page, /feedUnavailable\s*\?/, "Exchange must render a specific recovery state");
assert.match(page, /<form action="\/customer\/exchange" method="get">/, "Retry must make a full new request on repeated attempts");
assert.match(page, /name="account" value=\{account\.id\}/, "Retry must preserve authorized customer account");
assert.match(page, /name="q" value=\{query\}/, "Retry must preserve query filter");
assert.match(page, /name="category" value=\{category\}/, "Retry must preserve category filter");
assert.match(page, /href="\/customer\/home"/, "A failed Exchange feed must not trap users");
assert.match(loader, /rpc\("exchange_marketplace_feed"/, "Exchange must preserve the existing feed RPC");
assert.match(globalError, /onClick=\{reset\}/, "Existing generic reset must not be removed");
assert.match(globalError, /window\.location\.reload\(\)/, "Existing generic full reload must not be removed");
assert.doesNotMatch(page, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/, "Never bypass Customer authorization");
console.log("Customer Exchange recovery regression passed.");
