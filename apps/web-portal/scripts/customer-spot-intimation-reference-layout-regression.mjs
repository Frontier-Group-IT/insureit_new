import fs from 'node:fs';

const page = fs.readFileSync(new URL('../app/customer/(protected)/spot-intimation/page.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!page.includes('Back to Start Claim'), 'Back to Start Claim must be removed.');
assert(page.includes('Accident &amp; Spot Intimation Details'), 'Reference section title must be present.');
assert(page.includes('-mx-4 -mt-1 border-b border-[#D8E3F1] px-4 py-2 sm:-mx-5 sm:-mt-1'), 'Spot Intimation title and divider must sit lower inside the card.');
assert(page.includes('Accident Date &amp; Time'), 'Accident date/time must be grouped.');
assert(page.includes('Spot Intimation Date &amp; Time'), 'Spot intimation date/time must be grouped.');
assert(page.includes('Driver Number'), 'Driver Number label must match the reference.');
assert(page.includes('min-[1440px]:grid-cols-5'), 'Wide desktop section must use five aligned columns and reflow responsively.');
assert(page.includes('centerSummaryIcons'), 'Spot Intimation must center Vehicle Number and Policy Source icons.');
assert(page.includes('text-[11px] font-bold uppercase leading-5'), 'Input labels must be larger and legible.');
assert(page.includes('h-[42px]'), 'Form inputs must use taller controls.');
const dateInput = fs.readFileSync(new URL('../components/customer-portal/customer-date-input.tsx', import.meta.url), 'utf8');
assert(page.includes('CustomerDateInput compact splitTime name="accidentDate"'), 'Accident date must use the width-sharing compact picker.');
assert(page.includes('CustomerDateInput compact splitTime name="spotDate"'), 'Spot intimation date must use the width-sharing compact picker.');
assert(dateInput.includes('h-[34px] min-h-[34px] min-w-0 flex-[3_1_0%]'), 'Split date picker must keep 34px height and a shrinkable 60% width.');
assert(page.includes('h-[34px] min-w-0 flex-[2_1_0%] self-center'), 'Time picker must keep 34px height and the remaining 40% width.');
assert(page.includes('flex h-[42px] w-full min-w-0 overflow-hidden'), 'Combined date/time outer control must remain 42px high.');

assert(page.includes('gap-y-4 py-2'), 'Spot details card must provide additional vertical spacing.');

const strip = fs.readFileSync(new URL('../components/customer-portal/customer-claim-stage-strip.tsx', import.meta.url), 'utf8');
assert(strip.includes('centerSummaryIcons && (label === "Vehicle No." || label === "Policy Source")'), 'Summary icon alignment must be scoped to the two requested fields.');
assert(strip.includes('centerSummaryIcons && label === "Vehicle No." ? <CustomerClaimLogo value={claimSummary.manufacturer} kind="vehicle" size={32} />'), 'Spot Intimation Vehicle No. must show manufacturer branding.');
assert(strip.includes('centerSummaryIcons && label === "Policy Source" ? <CustomerClaimLogo value={claimSummary.insurer} kind="insurer" size={32} />'), 'Spot Intimation Policy Source must show insurer branding.');
const uploads = fs.readFileSync(new URL('../components/customer-portal/customer-claim-multiple-upload.tsx', import.meta.url), 'utf8');
assert(uploads.includes('const [expanded,setExpanded]=useState(false)'), 'Bulk files should start collapsed.');
assert(uploads.includes('setExpanded(false);\n        router.refresh()'), 'Bulk uploads must collapse on every claim workflow after upload.');
assert(uploads.includes('sm:grid-cols-2 xl:grid-cols-4'), 'Expanded bulk documents should show four columns on large screens.');

console.log('Customer portal Spot Intimation reference layout regression checks passed.');
