import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const service = fs.readFileSync(path.join(root, 'lib/policy-intakes.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'app/policy-intake-new.tsx'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../web-portal/app/api/partner/policy-intakes/route.ts'), 'utf8');

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

requireText(service, 'listPartnerPolicyIntakeSources()', 'Policy Intake service must expose a dedicated source loader.');
requireText(service, "'/api/partner/policy-intakes?view=sources'", 'Policy Intake source loader must call the dedicated ?view=sources endpoint.');
requireText(service, 'Array.isArray(result.sources) ? result.sources : []', 'Policy Intake source response must be normalized defensively.');
requireText(service, 'Array.isArray(result.intakes) ? result.intakes : []', 'Policy Intake list response must be normalized defensively.');

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

console.log('Partner Policy Intake source and policy-type contracts verified.');
