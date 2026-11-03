import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const home = read("app/partner/page.tsx");
const payout = read("app/partner/payout/page.tsx");
const layout = read("app/partner/layout.tsx");
const nav = read("components/partner-portal/partner-navigation.tsx");
const bottom = read("components/partner-portal/partner-bottom-navigation.tsx");

assert.match(home, /const isBranchLogin = identity\.actor_kind === "intermediary" && scope\.portal_access_type === "branch"/);
assert.match(home, /isBranchLogin \? Promise\.resolve\(null\) : getPartnerWebPayoutSummary\(\)/, "Branch Home must not request payout data");
assert.match(home, /!isBranchLogin \? <SummaryCard\s+label="Payout"/, "Hide Payout card from Branch");
assert.match(home, /!isBranchLogin \? <SummaryCard\s+label="Payout Outstanding"/, "Hide Payout Outstanding card from Branch");
assert.match(home, /!isBranchLogin && payout \? <SnapshotCard label="Payout Pending Records"/, "Hide Payout pending Snapshot card from Branch");
assert.match(home, /isBranchLogin \? "xl:grid-cols-2" : "xl:grid-cols-4"/, "Balance dashboard layout for Branch");
assert.match(layout, /<PartnerNavigation hideAccount=\{hideAccount\} hidePayout=\{branchPortal\} \/>/);
assert.match(nav, /hidePayout \? secondaryItems\.filter\(\(item\) => item\.href !== "\/partner\/payout"\) : secondaryItems/);
assert.match(nav, /<NavGroup label="Commercial" items=\{visibleCommercialItems\} \/>/);
assert.doesNotMatch(bottom, /\/partner\/payout/, "Mobile bottom navigation must not link to payout");
assert.match(payout, /const \{ identity, scope \} = await getPartnerWebSession\(\)/);
assert.match(payout, /identity\.actor_kind === "intermediary" && scope\.portal_access_type === "branch"\) redirect\("\/partner"\)/);
assert.ok(payout.indexOf('redirect("/partner")') < payout.indexOf("getPartnerWebPayoutSummary()"), "Route gate must run before payout retrieval");
console.log("Branch-only Payout visibility and direct-route protection checks passed");
