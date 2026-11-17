import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const css=read("../app/globals.css");
const source=read("../lib/reports/daily-self-activity.ts");
const page=read("../app/reports/(workspace)/daily/page.tsx");

assert.ok(css.includes('main:has(.daily-report-reference) {'),"Desktop Daily Report gets its own full-height shell");
assert.match(css,/main:has\(\.daily-report-reference\)\s*\{[^}]*padding-bottom:\s*20px/s,"Daily Report bottom gutter matches the desktop workspace spacing");
for(const wrapper of ['.ui-page-stage','.reports-reference-shell > .relative','.reports-reference-shell > .relative > .visible','.daily-report-reference']) {
  assert.ok(css.includes('main:has(.daily-report-reference) '+wrapper),"All Daily Report wrappers stretch: "+wrapper);
}
assert.match(css,/main:has\(\.daily-report-reference\) \.daily-report-panel\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s,"Panel fills remaining height without an arbitrary minimum");
assert.match(css,/@media \(min-width: 1024px\)/,"Desktop-only height override preserves mobile bottom navigation clearance");
assert.ok(panel.includes('daily-report-panel flex min-h-[calc(100dvh-145px)]'),"All Daily Report views fill the available viewport");
assert.ok(panel.includes('md:min-h-[calc(100dvh-80px)]'),"Desktop panel scales to available viewport");
assert.ok(panel.includes('min-h-0 flex-1'),"Drilldown rows consume available body space");
assert.ok(panel.includes('relative z-10 mt-auto flex shrink-0 flex-wrap items-center justify-between'),"Interactive pagination stays above decorative overlays and remains anchored");
assert.match(panel,/aria-label="Daily Report activity pages"/,"Pagination has a dedicated navigation landmark");
assert.match(panel,/href=\{linkFor\(\{page:String\(data\.page-1\)\}\)\}/,"Previous navigates to the preceding server-rendered page");
assert.match(panel,/href=\{linkFor\(\{page:String\(data\.page\+1\)\}\)\}/,"Next navigates to the following server-rendered page");
assert.match(panel,/data\.hasNext \? \(/,"Next stays available only when more matching records exist");
assert.match(panel,/data\.page > 1 \? \(/,"Previous stays available after page one");
assert.match(panel,/type="button" disabled title="No more matching records"/,"Last-page Next is visibly and semantically disabled");
assert.match(panel,/type="button" disabled title="Already on the first page"/,"First-page Previous is visibly and semantically disabled");
assert.match(panel,/Math\.ceil\(data\.selectedCount\/30\)/,"Pager exposes total pages from authorized matching record count");
assert.doesNotMatch(panel,/href=\{(?:data\.page<=1|!data\.hasNext)\?"#"/,"Disabled pagination must never navigate to a hash");
assert.ok(panel.includes('data.rows.length ? <table'),"Detail table is shown only with rows");
assert.ok(panel.includes('</table> : <DailyReportEmptyState />'),"Empty detail retains pagination with centered empty state");
assert.ok(panel.includes('flex flex-1 items-center justify-center'),"Empty summary is vertically centered");
assert.ok(panel.includes('data.categories.length ? ('),"Summary uses full-height panel");
assert.ok(!panel.includes('min-h-[calc(100dvh-300px)]'),"Panel height must not depend on record count");
assert.match(panel,/aria-label="Self activity summary and register"/,"Full-height sizing applies to both modes through the shared component");
assert.match(panel,/gridColumnsFor\(group\.items\.length\)/,"Activity cards fill the width available to each group");
assert.doesNotMatch(panel,/h-screen|h-\[100dvh\]|overflow-y-hidden/,"Panel remains naturally scrollable when activity tables exceed the viewport");
assert.match(panel,/count>=5\?"xl:grid-cols-5"/,"Five or more cards keep the five-column desktop layout");
assert.match(panel,/group\.items\.map\(item=>\(/, "Every activity category appears in grid");
assert.match(panel,/href=\{linkFor\(\{activity:item\.name,page:"1"\}\)\}/,
  "Clicking a category still opens its filtered details");
assert.match(panel,/item\.name/, "Category labels remain visible");
assert.match(panel,/item\.count\.toLocaleString\("en-IN"\)/,
  "Each category shows its true recorded count");
assert.match(panel,/<DailyActivityHistoryRows rows=\{data\.rows\}/, "Detail table passes rows to interactive renderer");
assert.match(read("../components/reports/daily-activity-history-rows.tsx"),/rows\.map\(row=>\(/, "Detail table is preserved");
assert.match(panel,/data\.category \?/,"Selected category still uses existing detail mode with employee in the heading");
assert.match(source,/for\(const a of all\) counts\.set\(a\.category/,
  "Backend counts remain unmodified and use complete recorded source set");
assert.match(page,/reportMode=\{isSelf \? "self" : "employee"\}/,
  "Both Self and selected All employee share the same responsive summary");
assert.match(panel,/daily-report-activity-card group flex/,"Activity links use distinct, reference-style card surfaces");
assert.match(panel,/daily-report-activity-card group flex[^"\n]*bg-white/,"All activity cards use white Tailwind backgrounds");
assert.doesNotMatch(panel,/bg-gradient-to-br from-white to-\[#f7faff\]|hover:from-\[#f5f9ff\]|hover:to-\[#e9f2ff\]/,"Activity cards have no tinted utility gradients");
assert.match(css,/\.daily-report-reference \.daily-report-activity-card \{[^}]*background: #fff;/s,"Scoped card background remains solid white");
assert.match(css,/\.daily-report-reference \.daily-report-activity-card:hover \{[^}]*background: #fff;/s,"Hover background stays white");

assert.match(panel,/hover:-translate-y-0\.5/,"Activity cards rise subtly on hover");
assert.match(panel,/hover:shadow-\[0_5px_14px_rgba\(23,54,93,0\.13\)\]/,"Activity cards gain a restrained shadow on hover");
assert.match(panel,/hover:border-\[#7ba7dc\]/,"Professional blue border hover feedback remains visible");
assert.match(panel,/focus-visible:outline/,"Keyboard focus state remains visible");
assert.match(panel,/motion-reduce:transform-none motion-reduce:transition-none/,"Reduced-motion users receive static hover feedback");
assert.match(panel,/active:translate-y-0/,"Pressed state provides immediate feedback");
const header=read("../components/reports/daily-report-header-controls.tsx");
assert.match(css,/width: 100%;\s*max-width: none;/,"Daily Report occupies full available workspace width");
assert.match(page,/daily-report-reference/,"Daily Report styling scoped to the page");
assert.match(css,/reports-reference-shell:has/,"Reference header styling limited to Daily Report");
assert.ok(css.includes("linear-gradient(100deg,#24119b"),"Purple summary bar matches reference palette");
for (const group of ["vehicle","policies","claims","other"]) {
  assert.ok(css.includes('data-activity-group="'+group+'"'),group+" section keeps distinct reference color");
}
assert.match(panel,/daily-report-category-heading/,"Text-only category headings retained");
assert.doesNotMatch(panel,/groupIcon\[|const groupIcon=/,"No category heading icons");
assert.match(panel,/group\.name==="Claims"\?"Claim":group\.name/,"Claims family heading is singular Claim");
assert.match(panel,/daily-report-count-badge/,"Numeric category counts retained without a colored pill");
assert.match(css,/\.daily-report-reference \.daily-report-count-badge \{[^}]*background: transparent/s,"Category counts have no background fill");
assert.match(css,/\.daily-report-reference \.daily-report-total-badge \{[^}]*background: transparent/s,"Summary total has no colored pill");
assert.match(css,/\.reports-reference-shell:has\(\.daily-report-reference\) \.reports-reference-header \{[^}]*background: #fff/s,"Reports heading has white background");
assert.doesNotMatch(css,/\.reports-reference-shell:has\(\.daily-report-reference\) \.reports-reference-header::before/,"No decorative gradient is layered over the white header");
assert.match(panel,/daily-report-activity-icon/,"Activity icons retained");
assert.match(header,/daily-report-header-select/,"Pill-shaped period and scope filters retained");
assert.ok(panel.includes('</table> : <DailyReportEmptyState />'),"Empty drilldowns show illustrated state and retain bottom pagination");
assert.match(panel,/<DailyReportEmptyState \/>/,"Empty summaries show illustrated empty state");
assert.match(panel,/No activities yet/,"Empty-state title is visible");
assert.match(panel,/Your activities will appear here once they are recorded/,"Empty-state explanation is visible");
console.log("Daily Report adaptive full-width grids and illustrated empty state verified.");
