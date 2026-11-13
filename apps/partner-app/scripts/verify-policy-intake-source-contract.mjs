import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const service = fs.readFileSync(path.join(root, 'lib/policy-intakes.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'app/policy-intake-new.tsx'), 'utf8');
const detailScreen = fs.readFileSync(path.join(root, 'app/policy-intakes/[id].tsx'), 'utf8');
const manufacturerLogo = fs.readFileSync(path.join(root, 'components/ui/partner-manufacturer-logo.tsx'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../web-portal/app/api/partner/policy-intakes/route.ts'), 'utf8');

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

requireText(service, 'listPartnerPolicyIntakeSources()', 'Policy Intake service must expose a dedicated source loader.');
requireText(service, "'/api/partner/policy-intakes?view=sources'", 'Policy Intake source loader must call the dedicated ?view=sources endpoint.');
requireText(service, 'Array.isArray(result.sources) ? result.sources : []', 'Policy Intake source response must be normalized defensively.');
requireText(service, 'Array.isArray(page.intakes)', 'Each requested Policy Intake page must be validated as an array.');
requireText(service, 'export async function listPartnerPolicyIntakesPage(', 'Policy Intake list must load authorized pages independently.');
requireText(service, 'offset = 0,', 'Keep default offset at the first authorized page.');

requireText(screen, 'listPartnerPolicyIntakeSources()', 'New Policy Intake must load lead sources from the dedicated source endpoint.');
requireText(screen, 'const nextSources = Array.isArray(result) ? result : [];', 'New Policy Intake must normalize source data before array operations.');
if (screen.includes('listPartnerPolicyIntakes(),')) {
  throw new Error('New Policy Intake must not depend on the intake-list endpoint for lead sources.');
}
if (screen.includes('result.sources.some(') || screen.includes('result.sources.length')) {
  throw new Error('New Policy Intake must not dereference sources from the intake-list response.');
}

for (const required of [
  'submitPartnerPolicyIntake({',
  'loadPartnerPolicyIntakeDraft()',
  'savePartnerPolicyIntakeDraft({',
  'clearPartnerPolicyIntakeDraft()',
  "const [policyType, setPolicyType] = useState<PartnerPolicyType>('motor');",
  "value: 'life'",
  "value: 'health'",
  "proposalForm ? 'Proposal form (Optional)' : 'Policy copy'",
  'policyType,',
]) {
  requireText(screen, required, `New Policy Intake must preserve ${required}.`);
}

requireText(service, "export type PartnerPolicyType = 'motor' | 'non_motor' | 'life' | 'health';", 'Partner Policy Intake service must expose the four portal policy types.');
requireText(service, "action: 'submit_without_proposal'", 'Life/Health Policy Intake must support optional proposal submission.');
requireText(service, 'policy_type: input.policyType', 'Partner Policy Intake service must send policy_type to the portal API.');

requireText(api, 'policy_type: PolicyType', 'Partner Policy Intake API must accept policy_type on uploaded submissions.');
requireText(api, 'action: "submit_without_proposal"', 'Partner Policy Intake API must accept no-proposal Life/Health submissions.');
requireText(api, 'status: proposalForm ? "ready_for_review" : "processing"', 'Life/Health proposal submissions must bypass OCR and enter Operations review.');
requireText(api, 'if (!proposalForm) {', 'Partner Policy Intake API must gate OCR processing away from Life/Health proposals.');

for (const required of [
  'title="Policy Intake"',
  'topBarIcon="documents-outline"',
  'fullWidth',
  '<Ionicons name="reader-outline" size={27}',
  '"car-sport-outline"',
  '"shield-checkmark-outline"',
  'statusBadgeStyle(row)',
  'statusDate',
  'navyStatusBar',
  'bottomNavigation={<PolicyIntakeDetailNavigation',
]) {
  requireText(detailScreen, required, `Policy Intake detail redesign must preserve ${required}.`);
}
for (const removed of [
  'eyebrow="POLICY INTAKE"',
  'subtitle="Track Operations progress and respond when needed"',
  '<Text style={styles.statusLabel}>CURRENT STATUS</Text>',
  'Updated {formatDate(row.updated_at)}',
]) {
  if (detailScreen.includes(removed)) throw new Error(`Policy Intake detail must not restore removed UI: ${removed}`);
}
requireText(manufacturerLogo, 'getPartnerManufacturerLogoSource(name)', 'Partner manufacturer logo must reuse the catalog mapping.');
requireText(manufacturerLogo, 'fallback ?? null', 'Partner manufacturer logo must preserve fallback artwork.');


// Website detail parity: keep populated authorized OCR fields and review notes
// visible, but do not render empty placeholder rows for sparse OCR results.
for (const required of [
  'const vehicleReviewKeys:',
  'const policyReviewKeys:',
  "'vehicle_chassis_number'",
  "'vehicle_engine_number'",
  "'vehicle_rto_name'",
  "'vehicle_fuel_type'",
  "'vehicle_manufacturing_year'",
  "'vehicle_capacity'",
  "'cpa_opted'",
  "'cpa_premium'",
  "'tax_amount'",
  "'gross_premium'",
  'row.ocr_warnings',
  'row.submitted_by_name',
  'getPartnerPolicyIntakeDocumentUrl(row.id)',
  'View policy copy',
  'Review status',
  'Review notes',
  'row.review_access.can_review',
  'row.review_access.can_finalize',
  'Review & Finalize',
]) requireText(detailScreen, required, `Partner Intake detail must preserve website parity: ${required}`);
for (const required of [
  'vehicleReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim()))',
  'vehicleReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map',
  'policyReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim()))',
  'policyReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map',
  'number="02"',
  'number="03"',
  'Fetched from the uploaded policy copy for Operations review.',
  'No vehicle details were fetched from the saved policy copy.',
  'No policy or premium details were fetched from the saved policy copy.',
  'Fetching vehicle details from the policy copy…',
  'Fetching policy and premium details…',
]) requireText(detailScreen, required, `Sparse OCR must preserve compact extracted-only review behavior: ${required}`);
if (detailScreen.includes('vehicleReviewKeys.map(([key, label]) =>') ||
    detailScreen.includes('policyReviewKeys.map(([key, label]) =>')) {
  throw new Error('Non-duplicate review must not render all OCR labels as empty dashes.');
}
requireText(service, '/api/partner/policy-intakes/${encodeURIComponent(id)}/document', 'Partner document viewer must use existing scoped signed URL endpoint.');
requireText(api, 'ocr_fields,ocr_warnings,attention_reason', 'Detail API must include OCR review notes.');
requireText(api, 'submitted_by_name: submittedByName', 'Detail API must return actual submitter rather than guessing lead source.');
if (detailScreen.includes('Fetched policy details (OCR)')) throw new Error('Remove duplicate unstructured OCR review dump.');

console.log('Partner Policy Intake source, policy-type and detail presentation contracts verified.');
