import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const overview = read("../app/partner/reports/page.tsx");
const business = read("../app/partner/reports/business/page.tsx");
const filters = read("../components/partner-portal/partner-reports-filters.tsx");
const calendar = read("../components/reports/report-date-range-picker.tsx");

for (const [name, source] of [["Overview", overview], ["Business", business]]) {
  assert.match(source, /<PartnerReportsFilters/, name + " must use the shared interactive filter");
  assert.doesNotMatch(source, /<form method="get"/, name + " must not require form submission");
  assert.doesNotMatch(source, /type="date"/, name + " must not show standalone date inputs");
  assert.doesNotMatch(source, />Apply</, name + " must not show an Apply button");
}

assert.match(filters, /import \{ ReportDateRangePicker \} from "@\/components\/reports\/report-date-range-picker"/);
assert.match(filters, /onRangeComplete=\{\(nextFrom, nextTo\) => \{/);
assert.match(filters, /navigate\(\{ period: "custom", from: nextFrom, to: nextTo \}\)/);
assert.match(filters, /onOpenChange=\{onCalendarOpenChange\}/);
assert.match(filters, /rangeCommittedRef\.current = true/, "Completing the range must be distinguished from cancellation.");
assert.match(filters, /if \(!rangeCommittedRef\.current\) setDraftPeriod\(period\)/, "Only incomplete selection may restore previous period.");
assert.match(filters, /useEffect\(\(\) => \{ setDraftPeriod\(period\); \}, \[period, from, to\]\)/, "Applied period synchronization must not depend on closing the calendar.");
assert.doesNotMatch(filters, /\[period, calendarOpen\]/, "Calendar visibility must not reset the selected Custom period.");
assert.doesNotMatch(filters, /onRangeComplete=\{\(nextFrom, nextTo\) => \{\s*setCalendarOpen\(false\)/, "Let the shared RM picker close after range completion.");
assert.match(filters, /onChange=\{\(event\) => changePeriod\(event.target.value\)\}/);
assert.match(filters, /navigate\(\{ period: value, from: null, to: null \}\)/);
assert.match(filters, /navigate\(\{ business: event.target.value \}\)/);
assert.match(filters, /navigate\(\{ \[field\]: value \|\| null \}\)/);
assert.match(filters, /new URLSearchParams\(existingParams.toString\(\)\)/);
assert.match(business, /insurerOptions=\{insurerOptions\} rmOptions=\{rmOptions\}/);
assert.match(business, /exportHref=\{exportHref\}/);
assert.match(overview, /filterQuery.toString\(\)/);
assert.match(calendar, /const inRange = Boolean\(rangeEnd/);
assert.match(calendar, /onRangeComplete\(nextStart, nextEnd\)/);
assert.match(calendar, /onPointerDown/);
console.log("Partner Reports shared RM calendar and instant filter regression passed.");
