import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const screen=read('../app/(tabs)/policies.tsx');
const api=read('../lib/policies.ts');
const claims=read('../app/(tabs)/claims.tsx');
const migration=read('../../../supabase/migrations/20261120061111_partner_policy_advanced_filters.sql');

for(const tab of ["key:'period'","key:'source'","key:'rm'","key:'date'"])
  assert.ok(screen.includes(tab),'The one-row filters must contain '+tab);
assert.match(screen,/useState<PolicyFilterTab>\('period'\)/,'Period opens by default');
assert.match(screen,/filterTab==='period'/);
assert.match(screen,/filterTab==='source'/);
assert.match(screen,/filterTab==='rm'/);
assert.match(screen,/filterTab==='date'/);
assert.match(screen,/All Policies Status/);
assert.match(screen,/sheetStatuses\.map/);
assert.match(screen,/const draftStatusCounts = draftFiltersMatchApplied \? periodCounts\.data\?\.\[draftPeriod\] : draftCounts\?\.\[draftPeriod\]/,
  'Status counts use the selected MTD or All period, even before Apply');
assert.match(screen,/getPartnerAdvancedPolicyCounts\(\{businessLine,search:debouncedSearch,source:draftSource,rm:draftRm,fromDate:draftFromDate,toDate:draftToDate\}\)/,
  'Changing source, RM or date filters queries counts for the draft selection');
assert.match(screen,/const count=draftStatusCounts\?\.\[option\.value\]/,'Every status option uses the selected draft period count');
assert.match(screen,/count===undefined\?\(draftCountsLoading\?'…':'—'\):count\.toLocaleString\('en-IN'\)/,
  'Pending or unavailable counts must not be invented');
assert.doesNotMatch(screen,/advancedPanel:\{maxHeight:290/,'Remove fixed 290px status area height');
assert.match(screen,/maxHeight:Math\.max\(160,windowHeight-safeAreaInsets\.top-safeAreaInsets\.bottom-210\)/,
  'Filter panel adapts to the safe screen height, leaving room for footer');

assert.match(screen,/Search source\.\.\./);
assert.match(screen,/Search RM\.\.\./);
assert.match(screen,/PartnerDatePicker directSelect label="From"/);
assert.match(screen,/PartnerDatePicker directSelect label="To"/);
// Keep the Policies search Filter button identical to Claims, but enabled and wired to the existing sheet.
for (const marker of [
  'accessibilityLabel="Filter policies"',
  'onPress={openSortSheet}',
  '<Ionicons name="filter-outline" size={18} color="#3156B8" />',
  '<Text style={styles.filterText}>Filter</Text>',
  'borderLeftWidth: StyleSheet.hairlineWidth',
  "borderLeftColor: '#D9DFEA'",
]) assert.ok(screen.includes(marker), 'Policies inline Filter must preserve: '+marker);
for (const style of ['filterButton', 'filterText']) {
  const grab = src => src.match(new RegExp('  '+style+': \\{[\\s\\S]*?\\n  \\},|  '+style+': \\{[^\\n]+\\},'))?.[0];
  assert.equal(grab(screen), grab(claims), 'Policies '+style+' must match the exact Claims style');
}
assert.doesNotMatch(screen,/styles\.sortFloating|sortFloating:|>Sort by<\/Text>/,'Remove the old floating Sort by control');
assert.match(screen,/searchSticky \? <View style=\{\[styles\.stickySearchOverlay[\s\S]*?\{searchControls\}/,'Sticky Policies search reuses the enabled inline Filter');
assert.match(screen,/Reset Filters/);
assert.match(screen,/Apply Filter/);
assert.match(screen,/setDraftSource\(source\)/,'Opening sheet preserves source');
assert.match(screen,/setDraftRm\(rm\)/,'Opening sheet preserves RM');
assert.match(screen,/setDraftPeriod\(period\)/,'Opening sheet preserves period');
assert.doesNotMatch(screen,/setDraftPeriod\(value\);setDraftLifecycle\('all'\)/,'Period must not reset status');
assert.match(screen,/setSource\(draftSource\);setRm\(draftRm\)/,'Apply commits both filters');
assert.match(screen,/setFromDate\(draftFromDate\);setToDate\(draftToDate\)/);
assert.match(api,/partner_app_list_policies_filtered/);
assert.match(api,/partner_app_policy_filter_options/);
assert.match(api,/partner_app_policy_filtered_counts/);
assert.match(api,/p_from_date:fromDate\|\|null,p_to_date:toDate\|\|null/);
assert.match(migration,/public\.partner_app_commercial_scope\(\)/);
assert.match(migration,/public\.partner_branch_authorized_policy_ids\(\)/);
assert.match(migration,/p_from_date is null or coalesce\(b\.issuance_date,b\.created_at::date\)>=p_from_date/);
assert.match(migration,/p_to_date is null or coalesce\(b\.issuance_date,b\.created_at::date\)<=p_to_date/);
assert.match(migration,/count\(\*\) over\(\) as total_count/);
assert.match(migration,/REVOKE ALL ON FUNCTION public\.partner_app_policy_filter_options/);
assert.doesNotMatch(migration,/\b(insert|update|delete|truncate)\s+(into|from|public\.)/i,'Filters must be read-only');
assert.ok(screen.includes("sortPeriodSelected:{backgroundColor:'#FFFFFF',borderColor:'#4030AF',borderWidth:1.5}"),'Selected MTD or All uses a white background with purple outline only');
assert.ok(screen.includes("sortPeriodTextSelected:{color:'#4030AF'}"),'Selected period remains legible in purple');
assert.ok(screen.includes("sortPeriodOption:{flex:1,minHeight:43,borderRadius:12,borderWidth:1,borderColor:'#D8DCEA'"),'Unselected period remains a neutral outline');
console.log('Partner Policies four-tab filter UI and scoped data contract passed.');
