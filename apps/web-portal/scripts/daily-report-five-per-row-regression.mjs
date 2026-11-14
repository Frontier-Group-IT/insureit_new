import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const source=read("../lib/reports/daily-self-activity.ts");
const page=read("../app/reports/(workspace)/daily/page.tsx");

assert.match(panel,/className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"/,
  "Activity summary uses five columns on desktop with responsive smaller breakpoints");
assert.match(panel,/data\.categories\.map\(item=>\(/, "Every activity category appears in grid");
assert.match(panel,/href=\{linkFor\(\{activity:item\.name,page:"1"\}\)\}/,
  "Clicking a category still opens its filtered details");
assert.match(panel,/item\.name/, "Category labels remain visible");
assert.match(panel,/item\.count\.toLocaleString\("en-IN"\)/,
  "Each category shows its true recorded count");
assert.match(panel,/data\.rows\.map\(row=>\(/, "Detail table is preserved");
assert.match(panel,/data\.category \|\|/, "Selected category still uses existing detail mode");
assert.match(source,/for\(const a of all\) counts\.set\(a\.category/,
  "Backend counts remain unmodified and use complete recorded source set");
assert.match(page,/reportMode=\{isSelf \? "self" : "employee"\}/,
  "Both Self and selected All employee share the same responsive summary");
console.log("Daily Report activity summary uses five responsive desktop columns with intact drilldowns.");
