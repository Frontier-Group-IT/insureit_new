import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const layout=read("../app/reports/(workspace)/layout.tsx");
const page=read("../app/reports/(workspace)/daily/page.tsx");
const header=read("../components/reports/daily-report-header-controls.tsx");
const period=read("../lib/reports/daily-report-period.ts");
const loader=read("../lib/reports/daily-self-activity.ts");
const directory=read("../components/reports/daily-employee-directory.tsx");

assert.match(layout, /<h1>Reports<\/h1>/);
assert.match(layout, /<DailyReportHeaderScopes\s*\/>/, "Self All beside Reports heading");
assert.match(layout, /<DailyReportHeaderPeriod\s*\/>/, "Period dropdown at right of Reports header");
assert.match(header, /if\(!isDaily\) return null/, "Daily header controls are hidden on other reporting pages");
assert.match(header, /aria-label="Daily Report visibility"/);
for(const label of ["90D","MTD","YTD","All time","Custom"]){
  assert.ok(header.includes(`label:"${label}"`),`Period menu missing ${label}`);
}
assert.match(header, /<ReportDateRangePicker/, "Use existing exact-style shared calendar");
assert.match(header, /onRangeComplete=\{\(start,end\)=>/, "Completing both custom dates activates custom period");
assert.match(header, /params\.set\("page","1"\)/, "Date and scope transitions reset detail pagination");
assert.match(header, /params\.delete\("person"\)/, "Self All changes don't retain a different employee's selection");
assert.doesNotMatch(page, /DailyReportQuickFilters|<nav|type="date"/, "Remove entire white date and scope section");
assert.match(page, /resolveDailyReportPeriod\(query\)/);
assert.match(page, /from: periodRange\.from, to: periodRange\.to/, "Apply period range to Self and selected employee events");
assert.match(period, /period==="mtd"/);
assert.match(period, /period==="ytd"/);
assert.match(period, /period==="custom"/);
assert.match(period, /89\*86400000/, "90D includes current and 89 previous calendar days");
assert.match(period, /query\.from>query\.to \|\| query\.to>today/, "Invalid future and inverted dates fail closed");
assert.match(loader, /dailyReportRangeWindow\(options\.from,options\.to\)/);
assert.match(loader, /if\(window\) q=q\.gte\("created_at",window\.from\)\.lt\("created_at",window\.to\)/);
assert.match(loader, /if\(window\) q=q\.gte\("finalized_at",window\.from\)\.lt\("finalized_at",window\.to\)/);
assert.match(loader, /if\(window\) q=q\.gte\("converted_at",window\.from\)\.lt\("converted_at",window\.to\)/);
assert.match(directory, /DailyReportQuickFilters mode="directory"/, "Directory employee search remains available inside list");
assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/, "No changes to business records");
console.log("Daily Report header layout, 90D MTD YTD All time Custom, and IST range source filtering verified.");
