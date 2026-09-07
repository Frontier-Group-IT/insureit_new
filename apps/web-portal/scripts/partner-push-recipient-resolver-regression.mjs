import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const resolver = fs.readFileSync(path.join(root, 'lib/partner-push-recipient-resolver.ts'), 'utf8');
const registrationRoute = fs.readFileSync(path.join(root, 'app/api/partner/push-devices/route.ts'), 'utf8');

for (const required of [
  'import "server-only"',
  'resolveRenewalActors',
  'resolveClaimActors',
  'resolvePolicyIntakeSubmitter',
  'loadActiveDevicesForActors',
  'customers.lead_source_intermediary_id',
  'partner_app_commercial_scope()',
  'PARTNER_PUSH_PROJECT_ID',
  'PARTNER_PUSH_APP_VERSION',
]) {
  if (!resolver.includes(required)) throw new Error(`Partner push recipient resolver missing contract: ${required}`);
}

const authResolution = resolver.indexOf('const actors = uniqueValidActors(authorizedActors)');
const zeroActorExit = resolver.indexOf('if (actors.length === 0) return []');
const deviceLookup = resolver.indexOf('dependencies.loadActiveDevicesForActors(actors)');
if (authResolution < 0 || zeroActorExit < 0 || deviceLookup < 0 || !(authResolution < zeroActorExit && zeroActorExit < deviceLookup)) {
  throw new Error('Business authorization must be resolved and fail closed before any device lookup.');
}

const intakeSubmitter = resolver.indexOf('resolvePolicyIntakeSubmitter(recordId)');
if (intakeSubmitter < 0 || !resolver.includes('authorizedActors = submitter ? [submitter] : []')) {
  throw new Error('Policy Intake push audience must stay exact-submitter only.');
}

for (const filter of [
  'if (!device.active) continue',
  'if (!authorizedActorKeys.has(actorKey(device))) continue',
  'device.eas_project_id !== PARTNER_PUSH_PROJECT_ID',
  'device.app_version !== PARTNER_PUSH_APP_VERSION',
]) {
  if (!resolver.includes(filter)) throw new Error(`Partner push endpoint filtering missing: ${filter}`);
}

for (const forbidden of [
  'createSupabaseAdminClient',
  'SUPABASE_SERVICE_ROLE_KEY',
  'fetch(',
  'exp.host',
  'api.push.apple.com',
  'fcm.googleapis.com',
  'setInterval(',
  'setTimeout(',
]) {
  if (resolver.includes(forbidden)) throw new Error(`Recipient resolver must remain inert and transport-free: ${forbidden}`);
}

const routeProject = registrationRoute.match(/const EXPECTED_PROJECT_ID = "([^"]+)"/)?.[1];
const routeVersion = registrationRoute.match(/const EXPECTED_APP_VERSION = "([^"]+)"/)?.[1];
const resolverProject = resolver.match(/PARTNER_PUSH_PROJECT_ID = "([^"]+)"/)?.[1];
const resolverVersion = resolver.match(/PARTNER_PUSH_APP_VERSION = "([^"]+)"/)?.[1];
if (!routeProject || routeProject !== resolverProject) {
  throw new Error('Recipient resolver EAS project identity must match push-device registration.');
}
if (!routeVersion || routeVersion !== resolverVersion) {
  throw new Error('Recipient resolver app-version identity must match push-device registration.');
}

for (const pii of ['customer_name', 'policy_number', 'claim_number', 'registration_number', 'mobile', 'email']) {
  if (resolver.includes(pii)) throw new Error(`Recipient output layer must not include business/PII field: ${pii}`);
}

console.log('Partner push recipient resolver contract verified: authorization-first, exact intake ownership, active scoped endpoints, no delivery side effects.');
