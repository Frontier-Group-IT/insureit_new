import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const filters = readFileSync(new URL("../app/rm-performance/rm-performance-filters.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../components/reports/report-date-range-picker.tsx", import.meta.url), "utf8");
assert.match(filters, /<div className="relative shrink-0">/, "Period dropdown must anchor calendar without taking layout space");
assert.match(filters, /period\.key === "custom" \? \([\s\S]*?aria-label="Open custom date range calendar"/, "Calendar icon appears for Custom only");
assert.match(filters, /<ReportDateRangePicker[\s\S]*?hideTrigger[\s\S]*?align="left"/, "Use the triggerless shared calendar below Custom");
assert.match(filters, /<select\s+aria-label="Filter by time period"/, "Dropdown remains operable for MTD and Last Month");
assert.match(filters, /appearance-none/, "Single fixed-width period control with native menu");
assert.match(filters, /onRangeComplete=\{\(from, to\) => \{[\s\S]*?params\.set\("from", from\)[\s\S]*?params\.set\("to", to\)/, "Complete range auto-applies URL filters");
assert.match(calendar, /document\.addEventListener\("mousedown", onPointerDown\)/, "Outside click closes the calendar");
assert.match(calendar, /if \(event\.key === "Escape"\) setOpen\(false\)/, "Escape closes the calendar");
assert.match(calendar, /if \(rangeStart && !rangeEnd\)/, "Calendar waits for both range boundaries");

const financeRmSql = readFileSync(new URL("../../../supabase/migrations/20261110112500_finance_report_rm_employee_id_alignment.sql", import.meta.url), "utf8");
const rmPage = readFileSync(new URL("../app/rm-performance/page.tsx", import.meta.url), "utf8");
const financeLoader = readFileSync(new URL("../lib/reports/finance.ts", import.meta.url), "utf8");
assert.match(financeRmSql, /p_rm_employee_id is null\s+or p\.rm_employee_id = p_rm_employee_id/, "RM finance must use stable employee IDs rather than exact text.");
assert.match(financeRmSql, /p\.rm_employee_id is null\s+and lower\(regexp_replace\(btrim\(coalesce\(p\.rm_name,''\)\)/, "Legacy name fallback is permitted only when policy has no employee ID.");
assert.match(financeRmSql, /\[\[:space:\]\]\+/, "Legacy RM names should normalize repeated whitespace.");
assert.doesNotMatch(financeRmSql, /x\.rm_name is null or p\.rm_name=x\.rm_name/, "Do not restore exact-name-only finance matching.");
assert.match(financeRmSql, /p_customer_ids is null or p\.customer_id=any\(p_customer_ids\)/, "Customer authorization scope must be unchanged.");
assert.match(financeRmSql, /coalesce\(p\.issuance_date,p\.start_date,p\.created_at::date\)>=p_from_date/, "Finance business period must remain intact.");
assert.match(rmPage, /payin=\{periodFinance\?\.report\.summary\.payin_after_tds \?\? 0\}/, "RM summary continues to use authoritative finance after-TDS pay-in.");
assert.match(rmPage, /payout=\{periodFinance\?\.report\.summary\.gross_payout \?\? 0\}/, "RM summary continues to use authoritative finance payout.");
assert.match(financeLoader, /admin\.rpc\("get_finance_report_v4"/, "Finance v4 must continue supplying payout totals.");
// Historical spelling variation is handled by employee ID, without merging
// differently owned policies solely because their display names resemble each other.
const rmMatches = ({policyRmId, employeeId, policyRmName, employeeName}) =>
  policyRmId === employeeId || (policyRmId === null &&
    policyRmName.trim().replace(/\s+/g, " ").toLowerCase() === employeeName.trim().replace(/\s+/g, " ").toLowerCase());
assert(rmMatches({policyRmId:"jatin-id",employeeId:"jatin-id",policyRmName:"Jatin Kumar Buwaniwala",employeeName:"JATIN KUMAR BHUWANIWALA"}));
assert(rmMatches({policyRmId:null,employeeId:"pramod-id",policyRmName:"Pramod  Kumar Nayak",employeeName:"PRAMOD KUMAR NAYAK"}));
assert(!rmMatches({policyRmId:"other-rm-id",employeeId:"jatin-id",policyRmName:"Jatin Kumar Buwaniwala",employeeName:"JATIN KUMAR BHUWANIWALA"}));

// The MTD badge compares the same calendar dates of the previous month, not
// its entire month total. The six-month history remains unchanged.
const performanceLoader = readFileSync(new URL("../lib/rm-performance.ts", import.meta.url), "utf8");
assert.match(performanceLoader, /previousEquivalent = selectedPeriod\.key === "mtd" \? previousMonthMatchingRange\(selectedPeriod\.to\)/, "MTD needs an equivalent previous-month range.");
assert.match(performanceLoader, /from: previousEquivalent\.from, to: previousEquivalent\.to/, "Previous comparison must use the matched date range.");
assert.match(performanceLoader, /netPremium: comparisonPayload\.report\.summary\.net_premium/, "Comparison comes from authoritative scoped report summary.");
assert.match(performanceLoader, /ytdTrend: ytdPayload\.report\.trend\.slice\(-6\)/, "Preserve six-month chart history.");
assert.match(rmPage, /comparison=\{data\.mtdComparison\}/, "MTD Context receives independent same-window comparison.");
assert.match(rmPage, /comparison\.netPremium > 0 \? \(\(currentNetPremium - comparison\.netPremium\)/, "MTD change must use previous equivalent premium.");
assert.doesNotMatch(rmPage, /latest && previous && previous\.net_premium/, "MTD movement must not compare partial to full month.");
assert.match(performanceLoader, /employment_status:string\|null/, "Hierarchy must have employee active-status information.");
assert.match(performanceLoader, /person\.employment_status\?\.toLowerCase\(\) !== "active"/, "Only active zero-business descendants are included.");
assert.match(performanceLoader, /childrenByManager\.get\(managerId\)/, "Report must include active descendants of represented management rows.");
assert.match(performanceLoader, /resolved\.has\(person\.id\)/, "Zero-business personnel must not duplicate reported RMs.");
assert.match(performanceLoader, /!selectedRmId && profile\.role !== "relationship_manager"/, "Scoped RM view must not fetch other employees.");
assert.match(performanceLoader, /head motors/, "HEAD MOTORS must be recognized as a manager.");
assert.match(performanceLoader, /todayPolicies: 0, todayNetPremium: 0, mtdPolicies: 0, mtdNetPremium: 0/, "Zero-production reporting RMs show zero rather than invented production.");
// Exercise the exact date helper from the server source with its TS annotation
// removed, including shorter months and year rollover.
const matchStart = performanceLoader.indexOf("function previousMonthMatchingRange(");
const matchEnd = performanceLoader.indexOf("\nfunction sixMonthTrendStart(", matchStart);
assert.ok(matchStart !== -1 && matchEnd > matchStart, "Previous month date helper exists.");
const helper = performanceLoader.slice(matchStart, matchEnd).replace("isoDate: string", "isoDate");
const equivalentRange = new Function(helper + "\nreturn previousMonthMatchingRange;")();
assert.deepEqual(equivalentRange("2026-11-12"), { from: "2026-10-01", to: "2026-10-12" });
assert.deepEqual(equivalentRange("2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(equivalentRange("2024-03-31"), { from: "2024-02-01", to: "2024-02-29" });
assert.deepEqual(equivalentRange("2026-01-12"), { from: "2025-12-01", to: "2025-12-12" });

const reportActions = readFileSync(new URL("../app/rm-performance/rm-report-actions.tsx", import.meta.url), "utf8");
assert.match(reportActions, /if\(!response\.ok\|\|!result\.ok\)throw new Error/, "Do not show success until the email API confirms acceptance.");
assert.match(reportActions, /setTo\(""\);\s*setOpen\(false\);\s*setSuccess\(true\);/, "Success must clear recipient, close entry modal and show success popup.");
assert.match(reportActions, /window\.setTimeout\(\(\)=>setSuccess\(false\),3000\)/, "Success popup must auto-dismiss after three seconds.");
assert.match(reportActions, /window\.clearTimeout\(timeout\)/, "Success dismissal timer must be cleaned up.");
assert.match(reportActions, /role="status" aria-live="polite"/, "Success popup must be announced accessibly.");
assert.match(reportActions, /catch\(error\)\{setMessage\(/, "Failed email submissions retain inline error feedback and recipient for retry.");
assert.doesNotMatch(reportActions, /setMessage\("Report emailed successfully\."\)/, "Successful sending must not leave a message inside the email form.");
console.log("RM Performance inline calendar and report email confirmation regression passed.");
