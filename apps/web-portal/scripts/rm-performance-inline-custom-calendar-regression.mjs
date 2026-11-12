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

// The MTD percentage must compare equivalent prior-month dates only.
const rmLoader = readFileSync(new URL("../lib/rm-performance.ts", import.meta.url), "utf8");
assert.match(rmLoader, /selectedPeriod\.key === "mtd" \? previousMonthMatchingRange\(selectedPeriod\.to\) : null/, "Comparison RPC is MTD-only");
assert.match(rmLoader, /from: priorEquivalent\.from, to: priorEquivalent\.to/, "Previous MTD uses equivalent date boundaries");
assert.match(rmLoader, /netPremium: priorEquivalentPayload\.report\.summary\.net_premium/, "Use authoritative summary premium");
assert.match(rmLoader, /rm: selectedRmId \?\? undefined/, "Preserve filtered RM scope in report RPCs");
assert.match(rmLoader, /ytdTrend: ytdPayload\.report\.trend\.slice\(-6\)/, "Keep six-month trend untouched");
assert.match(rmPage, /periodLabel === "MTD" \? \(priorEquivalent && priorEquivalent\.netPremium > 0/, "Use equivalent dates exclusively in MTD badge");
assert.match(rmPage, /: previousMovement;/, "Do not change Last Month and Custom trend comparison");
assert.match(rmPage, /Compared with \$\{priorEquivalent\.from\} to \$\{priorEquivalent\.to\}/, "Show the exact comparison window");
assert.match(rmLoader, /if \(!selectedRmId && profile\.role !== "relationship_manager"\)/, "Preserve existing RM hierarchy scope");
assert.doesNotMatch(rmLoader, /childrenByManager = new Map<string, typeof people>/, "Never reintroduce reverted zero-business hierarchy logic");
// Evaluate only the pure date helper, including leap year and month rollover.
const dateStart = rmLoader.indexOf("function previousMonthMatchingRange(");
const dateEnd = rmLoader.indexOf("\nfunction sixMonthTrendStart(", dateStart);
assert.ok(dateStart >= 0 && dateEnd > dateStart, "Date range helper must exist");
const dateHelper = rmLoader.slice(dateStart, dateEnd).replace("isoDate: string", "isoDate");
const equivalent = new Function(dateHelper + "\nreturn previousMonthMatchingRange;")();
assert.deepEqual(equivalent("2026-11-12"), { from: "2026-10-01", to: "2026-10-12" });
assert.deepEqual(equivalent("2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(equivalent("2024-03-31"), { from: "2024-02-01", to: "2024-02-29" });
assert.deepEqual(equivalent("2026-01-12"), { from: "2025-12-01", to: "2025-12-12" });

const reportActions = readFileSync(new URL("../app/rm-performance/rm-report-actions.tsx", import.meta.url), "utf8");
assert.match(reportActions, /if\(!response\.ok\|\|!result\.ok\)throw new Error/, "Do not show success until the email API confirms acceptance.");
assert.match(reportActions, /setTo\(""\);\s*setOpen\(false\);\s*setSuccess\(true\);/, "Success must clear recipient, close entry modal and show success popup.");
assert.match(reportActions, /window\.setTimeout\(\(\)=>setSuccess\(false\),3000\)/, "Success popup must auto-dismiss after three seconds.");
assert.match(reportActions, /window\.clearTimeout\(timeout\)/, "Success dismissal timer must be cleaned up.");
assert.match(reportActions, /role="status" aria-live="polite"/, "Success popup must be announced accessibly.");
assert.match(reportActions, /catch\(error\)\{setMessage\(/, "Failed email submissions retain inline error feedback and recipient for retry.");
assert.doesNotMatch(reportActions, /setMessage\("Report emailed successfully\."\)/, "Successful sending must not leave a message inside the email form.");
console.log("RM Performance inline calendar and report email confirmation regression passed.");
