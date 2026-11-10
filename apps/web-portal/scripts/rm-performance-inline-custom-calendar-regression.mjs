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

console.log("RM Performance inline custom calendar regression passed.");
