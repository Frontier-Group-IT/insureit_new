import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repoRoot = path.resolve(root, '../..');
const route = fs.readFileSync(path.join(root, 'app/api/partner/push-devices/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(repoRoot, 'supabase/migrations/20260907002000_partner_push_devices.sql'), 'utf8');

for (const required of [
  'partner_app_current_identity',
  'partner_app_commercial_scope',
  'createSupabaseWithAccessToken',
  'createSupabaseAdminClient',
  'EXPECTED_PROJECT_ID = "8ade82c1-4c96-4f09-b90b-802270fb406d"',
  'EXPECTED_APP_VERSION = "0.2.0"',
  'onConflict: "expo_push_token"',
  '.eq("actor_kind", actor.actor_kind)',
  '.eq("actor_id", actor.actor_id)',
  'Cache-Control',
]) {
  if (!route.includes(required)) throw new Error(`Partner push device route contract missing: ${required}`);
}

for (const forbidden of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE',
]) {
  if (route.includes(forbidden)) throw new Error(`Partner push device route must not read raw service-role secrets directly: ${forbidden}`);
}

for (const required of [
  'create table if not exists public.partner_push_devices',
  'expo_push_token text not null unique',
  "actor_kind text not null check (actor_kind in ('employee', 'intermediary'))",
  'alter table public.partner_push_devices enable row level security',
  'revoke all on table public.partner_push_devices from anon, authenticated',
  'grant all on table public.partner_push_devices to service_role',
]) {
  if (!migration.includes(required)) throw new Error(`Partner push device migration contract missing: ${required}`);
}

if (/grant\s+(select|insert|update|delete|all)[\s\S]*to\s+(anon|authenticated)/i.test(migration)) {
  throw new Error('Partner push device registry must not grant direct table access to anon/authenticated.');
}

console.log('Partner push-device registration security contract verified.');
