import fs from 'node:fs';

const page = fs.readFileSync(new URL('../app/customer/(protected)/spot-intimation/page.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!page.includes('Back to Start Claim'), 'Back to Start Claim must be removed.');
assert(page.includes('Accident &amp; Spot Intimation Details'), 'Reference section title must be present.');
assert(page.includes('Accident Date &amp; Time'), 'Accident date/time must be grouped.');
assert(page.includes('Spot Intimation Date &amp; Time'), 'Spot intimation date/time must be grouped.');
assert(page.includes('Driver Number'), 'Driver Number label must match the reference.');
assert(page.includes('min-[1440px]:grid-cols-5'), 'Wide desktop section must use five aligned columns and reflow responsively.');
assert(page.includes('centerSummaryIcons'), 'Spot Intimation must center Vehicle Number and Policy Source icons.');
assert(page.includes('text-[11px] font-bold uppercase leading-5'), 'Input labels must be larger and legible.');
assert(page.includes('h-[42px]'), 'Form inputs must use taller controls.');
assert(page.includes('gap-y-4 py-2'), 'Spot details card must provide additional vertical spacing.');

const strip = fs.readFileSync(new URL('../components/customer-portal/customer-claim-stage-strip.tsx', import.meta.url), 'utf8');
assert(strip.includes('centerSummaryIcons && (label === "Vehicle No." || label === "Policy Source")'), 'Summary icon alignment must be scoped to the two requested fields.');
const uploads = fs.readFileSync(new URL('../components/customer-portal/customer-claim-multiple-upload.tsx', import.meta.url), 'utf8');
assert(uploads.includes('const [expanded,setExpanded]=useState(false)'), 'Bulk files should start collapsed.');
assert(uploads.includes('setExpanded(false);\n        router.refresh()'), 'Bulk uploads must collapse after successful upload while refreshing data.');
assert(uploads.includes('sm:grid-cols-2 xl:grid-cols-4'), 'Expanded bulk documents should show four columns on large screens.');

console.log('Customer portal Spot Intimation reference layout regression checks passed.');
