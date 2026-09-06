import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");
const migrationPath = path.join(repoRoot, "supabase/migrations/20260906235500_external_renewal_intake_visibility.sql");
const detailStateMigrationPath = path.join(repoRoot, "supabase/migrations/20260907001500_external_renewal_intake_detail_state.sql");
const terminalStateMigrationPath = path.join(repoRoot, "supabase/migrations/20260907004500_external_renewal_terminal_state_guard.sql");
const reportingMigrationPath = path.join(repoRoot, "supabase/migrations/20260907010000_external_renewal_reporting.sql");
const pagePath = path.join(root, "app/partner/renewals/external/page.tsx");
const detailPagePath = path.join(root, "app/partner/renewals/external/[id]/page.tsx");
const reportingPagePath = path.join(root, "app/partner/renewals/external/reporting/page.tsx");
const renewalsPagePath = path.join(root, "app/partner/renewals/page.tsx");
const libPath = path.join(root, "lib/partner-external-renewals.ts");
const reportingLibPath = path.join(root, "lib/partner-external-renewal-reporting.ts");

function assert(condition, message) {
  if (!condition) {
    console.error("External renewal intake visibility regression failed: " + message);
    process.exitCode = 1;
  }
}

for (const file of [migrationPath, detailStateMigrationPath, terminalStateMigrationPath, reportingMigrationPath, pagePath, detailPagePath, reportingPagePath, renewalsPagePath, libPath, reportingLibPath]) assert(fs.existsSync(file), path.basename(file) + " is missing");

if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert(migration.includes("p_intake_state text default 'all'"), "list RPC must expose the Policy Intake filter");
  assert(migration.includes("'in_policy_intake_count'"), "summary must expose the in-Policy-Intake count");
  assert(migration.includes("left join public.external_renewal_policy_intake_links"), "visibility must use the isolated conversion link");
  assert(migration.includes("r.submitted_by_profile_id"), "employee intake details must stay actor scoped");
  assert(migration.includes("r.submitted_by_portal_account_id"), "intermediary intake details must stay actor scoped");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "visibility migration must not mutate verified business tables");
}

if (fs.existsSync(detailStateMigrationPath)) {
  const migration = fs.readFileSync(detailStateMigrationPath, "utf8");
  assert(migration.includes("'linked', true"), "detail RPC must expose generic linked state");
  assert(migration.includes("'owned', x.owned"), "detail RPC must distinguish current-actor ownership");
  assert(migration.includes("case when x.owned then x.intake_id else null end"), "cross-actor intake ID must stay hidden");
  assert(migration.includes("case when x.owned then x.intake_number else null end"), "cross-actor intake number must stay hidden");
  assert(migration.includes("case when x.owned then x.status else null end"), "cross-actor intake status must stay hidden");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "detail-state migration must not mutate verified business tables");
}

if (fs.existsSync(terminalStateMigrationPath)) {
  const migration = fs.readFileSync(terminalStateMigrationPath, "utf8");
  assert(migration.includes("v_current_status in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost')"), "terminal states must reject further CRM writes");
  assert(migration.includes("This external renewal opportunity is closed and cannot accept further CRM updates"), "terminal-state RPC must fail closed with a clear error");
  assert(migration.includes("A closed outcome cannot schedule a follow-up"), "closing outcomes must not schedule future follow-ups");
  assert(migration.includes("when v_status in ('renewed_elsewhere','invalid_contact','do_not_contact','lost') then null"), "closing outcomes must clear next follow-up");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "terminal-state migration must not mutate verified business tables");
}

if (fs.existsSync(reportingMigrationPath)) {
  const migration = fs.readFileSync(reportingMigrationPath, "utf8");
  assert(migration.includes("create or replace function public.partner_app_external_renewal_reporting()"), "reporting RPC is missing");
  assert(migration.includes("public.partner_app_commercial_scope()"), "reporting RPC must use Partner commercial scope");
  assert(migration.includes("public.external_renewal_interactions"), "reporting funnel must use CRM interaction history");
  assert(migration.includes("r.final_policy_id is not null"), "conversion must require a real final policy");
  assert(migration.includes("join public.policies p on p.id=cp.final_policy_id"), "premium must come from the converted verified policy");
  assert(migration.includes("sum(coalesce(p.premium_amount,0))"), "premium generated must use verified policy premium");
  assert(!migration.includes("o.premium"), "reporting must not infer premium from external opportunities");
  assert(!/\b(update|insert into|delete from)\s+public\.(customers|vehicles|policies)\b/i.test(migration), "reporting migration must not mutate verified business tables");
}

if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, "utf8");
  assert(page.includes("In Policy Intake"), "worklist must visibly label linked opportunities");
  assert(page.includes('name="intake"'), "search must preserve the intake filter");
  assert(page.includes('value === "not_started" ? "Not Started" : "In Policy Intake"'), "worklist must expose intake filter choices");
}

if (fs.existsSync(detailPagePath)) {
  const page = fs.readFileSync(detailPagePath, "utf8");
  assert(page.includes("!intakeLink?.linked"), "Start Policy Intake must require a truly unlinked opportunity");
  assert(page.includes("intakeLink?.linked && intakeLink.owned"), "owned linked intake must have a dedicated branch");
  assert(page.includes("Policy Intake has already been started for this opportunity"), "cross-actor linked intake must show a neutral already-started state");
  assert(page.includes("Its details remain with the Partner user who started it"), "cross-actor intake details must not be exposed");
  assert(page.includes('TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost"])'), "detail page must define terminal opportunity states");
  assert(page.includes("const isClosed = TERMINAL_STATUSES.has(opportunity.opportunity_status)"), "detail page must derive closed state from the opportunity");
  assert(page.includes("No further CRM updates are allowed."), "closed opportunities must render as read-only");
  assert(page.includes("No new Policy Intake can be started from it."), "closed unlinked opportunities must not offer Policy Intake start");
}

if (fs.existsSync(reportingPagePath)) {
  const page = fs.readFileSync(reportingPagePath, "utf8");
  assert(page.includes("Retargeting performance"), "reporting page title is missing");
  assert(page.includes("Premium Generated"), "reporting page must show generated premium");
  assert(page.includes("Verified converted policies only"), "reporting UI must explain premium source");
  assert(page.includes("interaction history"), "reporting UI must explain funnel history semantics");
}

if (fs.existsSync(renewalsPagePath)) {
  const page = fs.readFileSync(renewalsPagePath, "utf8");
  assert(page.includes('href="/partner/renewals/external/reporting"'), "Renewals page must expose external renewal reporting");
  assert(page.includes("External Renewal Reporting"), "Renewals page reporting label is missing");
}

if (fs.existsSync(libPath)) {
  const lib = fs.readFileSync(libPath, "utf8");
  assert(lib.includes('PartnerExternalRenewalIntakeFilter = "all" | "not_started" | "in_progress"'), "typed intake filter is missing");
  assert(lib.includes("p_intake_state: intake"), "list RPC must receive the intake filter");
  assert(lib.includes("linked: true"), "typed detail link state must expose linked");
  assert(lib.includes("owned: boolean"), "typed detail link state must expose ownership");
  assert(lib.includes("intake_id: string | null"), "cross-actor intake ID must be nullable");
}

if (fs.existsSync(reportingLibPath)) {
  const lib = fs.readFileSync(reportingLibPath, "utf8");
  assert(lib.includes("partner_app_external_renewal_reporting"), "reporting helper must call the scoped reporting RPC");
  assert(lib.includes("premium_generated: number"), "reporting helper must type verified premium output");
}

if (!process.exitCode) console.log("External renewal intake visibility regression passed.");
