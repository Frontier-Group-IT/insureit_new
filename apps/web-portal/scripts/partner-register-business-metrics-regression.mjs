import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const sql = readFileSync(resolve(root, "supabase/migrations/20261008183000_partner_register_business_metrics.sql"), "utf8");
const loader = readFileSync(resolve(here, "../app/intermediaries/intermediary-register.tsx"), "utf8");
const client = readFileSync(resolve(here, "../app/intermediaries/partner-register-client.tsx"), "utf8");
const mtdSql = readFileSync(resolve(root, "supabase/migrations/20261104101500_partner_register_mtd_net_premium.sql"), "utf8");

for (const [description, pattern] of [
  ["service-role-only function", /create or replace function public\.partner_register_business_metrics\(p_partner_ids uuid\[\]\)/i],
  ["bounded partner IDs", /where p\.id = any\(coalesce\(p_partner_ids/i],
  ["customer attribution", /c\.lead_source_intermediary_id = f\.intermediary_id/i],
  ["normalized policy code matching", /upper\(btrim\(p\.intermediary_code\)\) = upper\(btrim\(f\.intermediary_code\)\)/i],
  ["deduplicated policies", /select distinct f\.partner_id, p\.id as policy_id/i],
  ["net premium aggregation", /sum\(ppd\.net_premium\)/i],
  ["payout aggregation", /partner_payout_amount/i],
  ["revoke public access", /revoke all on function public\.partner_register_business_metrics\(uuid\[\]\) from public, anon, authenticated/i],
  ["service role grant", /grant execute on function public\.partner_register_business_metrics\(uuid\[\]\) to service_role/i],
]) assert.match(sql, pattern, description);

assert.match(loader, /admin\.rpc\("partner_register_business_metrics", \{ p_partner_ids: partnerBusinessIds \}\)/);
assert.match(loader, /partnerBusinessError/);
assert.match(loader, /customerCount: metric \? Number\(metric\.customer_count\) : null/);
assert.match(loader, /netPremium: metric \? Number\(metric\.net_premium\) : null/);
assert.match(loader, /payout: metric \? Number\(metric\.payout\) : null/);
assert.match(client, /row\.customerCount === null \? "—"/);
assert.match(client, /row\.netPremium === null/);
assert.match(client, /row\.payout === null/);
// Business-ranked page one must be drawn from the entire authorized Partner set.
assert.match(loader, /selectedType === "partner"\s*\? await fetchAllPages<IntermediaryRow, unknown>/, "All authorized Partners must be paginated before ranking");
assert.match(loader, /\.order\("id", \{ ascending: false \}\)/, "Partner backend pagination must use deterministic ordering");
assert.match(client, /return \[\.\.\.filtered\]\.sort\(/, "Business ranking must use a copy, not mutate source data");
assert.match(loader, /admin\.rpc\("partner_register_mtd_net_premium", \{ p_partner_ids: partnerBusinessIds \}\)/, "MTD ranking must use server-side scoped metric");
assert.match(loader, /mtdNetPremium: mtdMetric \? Number\(mtdMetric\.mtd_net_premium\) : null/, "MTD premium must not be substituted with lifetime premium");
assert.match(client, /return b\.mtdNetPremium - a\.mtdNetPremium/, "MTD net premium sorts descending");
assert.match(client, /if \(a\.mtdNetPremium === null\)/, "Unavailable MTD is sorted separately from real zero");
assert.match(client, /router\.refresh\(\)/, "Visible Partner Register periodically refreshes MTD rank");
assert.match(client, /document\.visibilityState !== "visible"/, "Background tabs must not poll");
assert.match(client, /Sorted by MTD Net Premium/, "User must see default ordering basis");
assert.match(client, /MTD \{money\(row\.mtdNetPremium\)\}/, "Each Partner row must reveal the MTD amount used in ranking");
assert.match(mtdSql, /timezone\('Asia\/Kolkata', now\(\)\)/, "Month boundary must use India calendar time");
assert.match(mtdSql, /coalesce\(p\.issuance_date, \(p\.created_at at time zone 'Asia\/Kolkata'\)::date\)/, "MTD must use issuance date with creation fallback");
assert.match(mtdSql, /select distinct f\.partner_id, p\.id as policy_id/, "MTD must deduplicate partner-family policies");
assert.match(mtdSql, /sum\(ppd\.net_premium\)/, "MTD uses the same net premium basis as lifetime values");
assert.match(mtdSql, /revoke all on function public\.partner_register_mtd_net_premium\(uuid\[\]\) from public, anon, authenticated;/, "MTD RPC must not be available to clients");
assert.match(mtdSql, /grant execute on function public\.partner_register_mtd_net_premium\(uuid\[\]\) to service_role;/, "Only server service role may execute MTD RPC");
assert.ok(client.indexOf("return [...filtered].sort(") < client.indexOf("visibleRows.slice(pageStartIndex"), "Business priority must apply before page slicing");
console.log("Partner Register business metrics migration and UI contract regression passed");

assert.match(loader, /partnerStatus:\s*linked[\s\S]*"Not Created"/, "Unlinked POSP\/MISP status must be Not Created");
assert.doesNotMatch(loader, /partnerStatus:[^\n]*partnerComplete \? "Active"/, "Partner activation must not be reused as linked POSP\/MISP Active status");
