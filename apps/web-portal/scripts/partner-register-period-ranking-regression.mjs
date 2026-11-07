import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const sql = read("../../../supabase/migrations/20261104100500_partner_register_period_business_metrics.sql");
const page = read("../app/intermediaries/partner/page.tsx");
const loader = read("../app/intermediaries/intermediary-register.tsx");
const client = read("../app/intermediaries/partner-register-client.tsx");

assert.match(sql, /create or replace function public\.partner_register_period_business_metrics\(/i);
assert.match(sql, /p_from_date date,\s*p_to_date date/i);
assert.match(sql, /p\.issuance_date >= p_from_date\s+and p\.issuance_date <= p_to_date/i, "Business date should be inclusive policy issuance date.");
assert.match(sql, /select distinct f\.partner_id, p\.id as policy_id/i, "Deduplicate policy attribution to a partner family.");
assert.match(sql, /i\.application_id = sp\.source_application_id/, "Preserve direct partner family attribution.");
assert.match(sql, /op\.partner_record_id = sp\.id/, "Preserve POSP/MISP family attribution.");
assert.match(sql, /count\(distinct pf\.policy_id\)::bigint as policy_count/, "Use actual policies to determine if partner has business.");
assert.match(sql, /count\(distinct pf\.customer_id\)::bigint as customer_count/, "Period customer count must be scoped to policies.");
assert.match(sql, /sum\(ppd\.net_premium\)/, "Net premium must be summed only from period policies.");
assert.match(sql, /sum\(case when pip\.payout_basis is not null/, "Period partner payout must preserve legacy payout logic.");
assert.match(sql, /revoke all on function public\.partner_register_period_business_metrics\(uuid\[\],date,date\) from public, anon, authenticated/i, "Do not expose privileged business RPC to clients.");
assert.match(sql, /grant execute on function public\.partner_register_period_business_metrics\(uuid\[\],date,date\) to service_role/i);

assert.match(page, /Date\.now\(\) \+ 330 \* 60 \* 1000/, "MTD must follow India's business date.");
assert.match(page, /today\.slice\(0, 8\) \+ "01"/, "Default from date should be first day of month.");
assert.doesNotMatch(page, /q\.from|q\.to|validDate/, "Partner register must ignore custom business date overrides.");
assert.match(page, /periodFrom=\{mtdFrom\}/);
assert.match(page, /periodTo=\{today\}/);
assert.match(loader, /admin\.rpc\("partner_register_period_business_metrics", \{ p_partner_ids: partnerBusinessIds, p_from_date: periodFrom, p_to_date: periodTo \}\)/, "Run period business calculation for entire authorized partner set.");
assert.match(loader, /policyCount: metric \? Number\(metric\.policy_count\) : null/, "Expose actual policy count, not onboarding date.");
assert.match(loader, /loadError=\{Boolean\(loadError \|\| partnerBusinessError\)\}/, "Do not show false zero records on RPC failure.");
assert.doesNotMatch(client, /\(row\.policyCount \?\? 0\) > 0/, "Partners with zero MTD business must stay visible.");
assert.doesNotMatch(client, /indiaDateKey\(row\.onboardingDate\)/, "Partner onboarding date must never filter period business.");
assert.match(client, /\(b\.netPremium \?\? 0\) - \(a\.netPremium \?\? 0\)/, "Rank highest business first.");
assert.ok(client.indexOf("return [...filtered].sort(") < client.indexOf("visibleRows.slice(pageStartIndex"), "Rank before pagination.");
assert.doesNotMatch(client, /PartnerDateRangeFilter|applyBusinessRange|initialDateFrom|initialDateTo/, "Remove business date selector and state completely.");
assert.match(client, /return true;/, "Authorized partners must not be excluded for having zero MTD policies.");
assert.doesNotMatch(client, /onboarding date or status filter/, "Empty state should use business date terminology.");
console.log("Partner register issuance-period ranking and authorization regression passed.");
