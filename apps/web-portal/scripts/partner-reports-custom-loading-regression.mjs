import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const filters = read("../components/partner-portal/partner-reports-filters.tsx");
const shell = read("../components/partner-portal/partner-reports-shell.tsx");
const loader = read("../components/partner-portal/partner-reports-loading.tsx");
const picker = read("../components/reports/report-date-range-picker.tsx");
const overview = read("../app/partner/reports/page.tsx");
const business = read("../app/partner/reports/business/page.tsx");

// Selecting a previously applied Custom period must always reopen the calendar.
assert.match(filters, /aria-label="Open custom date calendar"/);
assert.match(filters, /absolute inset-y-0 left-0 right-7/);
assert.match(filters, /onMouseDown=\{\(event\) => event\.stopPropagation\(\)\}/);
assert.match(filters, /setCalendarOpen\(\(value\) => !value\)/);
assert.match(filters, /onRangeComplete=\{\(nextFrom, nextTo\) =>/);
assert.match(filters, /navigate\(\{ period: "custom", from: nextFrom, to: nextTo \}\)/);
assert.match(filters, /new URLSearchParams\(existingParams\.toString\(\)\)/);
assert.match(filters, /router\.replace\(qs \? pathname \+ "\?" \+ qs : pathname, \{ scroll: false \}\)/);

// During the server navigation show a real skeleton over the report, not a permanent spinner.
assert.match(filters, /setReportPending\(true\)/);
assert.match(filters, /setReportPending\(isPending\)/);
assert.match(shell, /PartnerReportsLoadingProvider/);
assert.match(shell, /reports-reference-shell report-page-shell relative/);
assert.match(loader, /role="status" aria-live="polite"/);
assert.match(loader, /animate-pulse/);
assert.match(loader, /absolute inset-x-0 top-\[62px\] bottom-0/);

// Selected period must reach both report pages and be shown by the Overview.
assert.match(overview, /date>=bounds\.from&&date<=bounds\.to/);
assert.match(overview, /note=\{\`\$\{bounds\.from\} to \$\{bounds\.to\}\`\}/);
assert.match(overview, /label:period==="custom"\?\`\$\{bounds\.from\} – \$\{bounds\.to\}\`/);
assert.match(business, /date < bounds\.from \|\| date > bounds\.to/);
assert.match(business, /<PartnerReportsFilters/);
assert.match(picker, /onRangeComplete\(nextStart, nextEnd\)/);
console.log("Partner Reports Custom range application and loading skeleton regression passed.");
