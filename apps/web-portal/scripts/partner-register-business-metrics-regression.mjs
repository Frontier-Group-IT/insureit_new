import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const sql = readFileSync(resolve(root, "supabase/migrations/20261008183000_partner_register_business_metrics.sql"), "utf8");
const loader = readFileSync(resolve(here, "../app/intermediaries/intermediary-register.tsx"), "utf8");
const client = readFileSync(resolve(here, "../app/intermediaries/partner-register-client.tsx"), "utf8");

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
console.log("Partner Register business metrics migration and UI contract regression passed");
