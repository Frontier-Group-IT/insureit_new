import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../app/partner/reports/page.tsx");
const business = read("../app/partner/reports/business/page.tsx");
const filters = read("../components/partner-portal/partner-reports-filters.tsx");
const calendar = read("../components/reports/report-date-range-picker.tsx");

// Evaluate the actual Overview guard rather than just repeating its comparison
// in the test. The TypeScript non-null assertions have no runtime meaning.
const match = overview.match(/if\((period==="custom"&&validDate\(from\)&&validDate\(to\)&&from!\s*[<>]=?\s*to!)\) return \{from:from!,to:to!\};/);
assert.ok(match, "Overview must apply a guarded custom range unchanged.");
const guard = match[1].replace(/from!/g, "from").replace(/to!/g, "to");
const isCustom = new Function("period", "from", "to", "validDate", `return ${guard};`);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

assert.equal(isCustom("custom", "2026-10-10", "2026-11-04", validDate), true, "Cross-month custom range must be accepted.");
assert.equal(isCustom("custom", "2026-10-04", "2026-11-05", validDate), true, "URL range must never be silently replaced by MTD.");
assert.equal(isCustom("custom", "2026-11-04", "2026-11-04", validDate), true, "Same-day custom range must work.");
assert.equal(isCustom("custom", "2026-11-05", "2026-10-04", validDate), false, "Reversed ranges must be rejected.");
assert.equal(isCustom("custom", "invalid", "2026-11-04", validDate), false, "Invalid dates must be rejected.");
assert.equal(isCustom("mtd", "2026-10-10", "2026-11-04", validDate), false, "Presets must not be replaced with a custom range.");

// Overview KPI, trend, business mix and export must share the same bounds.
assert.ok(overview.includes("const bounds=boundsFor(day,period,query.from,query.to)"));
assert.ok(overview.includes("date>=bounds.from&&date<=bounds.to"));
assert.ok(overview.includes('from:bounds.from,to:bounds.to'));
assert.ok(overview.includes("filterQuery.toString()"));
assert.ok(business.includes("String(query.from) <= String(query.to)"));
assert.ok(business.includes("date < bounds.from || date > bounds.to"));

// Shared picker must submit both selected dates and preserve the rest of URL
// parameters, including business and authorized filter scope.
assert.ok(calendar.includes("onRangeComplete(nextStart, nextEnd)"));
assert.ok(filters.includes('navigate({ period: "custom", from: nextFrom, to: nextTo })'));
assert.ok(filters.includes("new URLSearchParams(existingParams.toString())"));

console.log("Partner Reports ascending custom date bounds, Overview/Business/export parity and picker regression passed.");
