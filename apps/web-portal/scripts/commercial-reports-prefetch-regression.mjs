import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const policyReportMigration = await readFile(
  new URL("../../../supabase/migrations/20260831181500_optimize_policy_business_report_enrichment.sql", import.meta.url),
  "utf8",
);
const financeReportMigration = await readFile(
  new URL("../../../supabase/migrations/20260831184000_optimize_finance_report_deferred_enrichment.sql", import.meta.url),
  "utf8",
);

for (const file of [
  "../app/policies/commercial-review/commercial-review-client.tsx",
  "../app/reports/page.tsx",
  "../app/accounts/page.tsx",
  "../components/reports/report-navigation.tsx",
]) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const links = source.match(/<Link\b[^>]*>/gs) ?? [];
  assert.ok(links.length > 0, `${file}: expected navigation links`);
  for (const link of links) {
    assert.match(
      link,
      /prefetch=\{false\}/,
      `${file}: heavy authenticated navigation must not auto-prefetch`,
    );
  }
}

assert.match(
  policyReportMigration,
  /row_page_base\s+as\s*\(/i,
  "Policy business report should paginate before customer/vehicle/insurer display enrichment.",
);
assert.match(
  policyReportMigration,
  /from\s+row_page_base\s+f\s+join\s+public\.customers/i,
  "Policy business report row enrichment should run only on the paginated register rows.",
);
assert.doesNotMatch(
  policyReportMigration,
  /from\s+public\.policies\s+p[\s\S]*?join\s+public\.customers\s+c\s+on\s+c\.id=p\.customer_id[\s\S]*?where/i,
  "Policy business report base scan should not enrich every policy with customer display data before filtering and pagination.",
);

assert.match(
  financeReportMigration,
  /register_page\s+as\s*\(/i,
  "Finance report should paginate before customer and vehicle display enrichment.",
);
assert.match(
  financeReportMigration,
  /from\s+register_page\s+f\s+join\s+public\.customers/i,
  "Finance report customer enrichment should run only on paginated register rows.",
);
assert.doesNotMatch(
  financeReportMigration,
  /from\s+public\.policies\s+p\s+join\s+public\.customers/i,
  "Finance report base scan should not join every policy to customer display data.",
);
assert.doesNotMatch(
  financeReportMigration,
  /from\s+public\.policies\s+p[\s\S]{0,1200}?left\s+join\s+public\.vehicles/i,
  "Finance report base scan should not join every policy to vehicle display data.",
);

console.log("Commercial/reports prefetch regression passed.");
