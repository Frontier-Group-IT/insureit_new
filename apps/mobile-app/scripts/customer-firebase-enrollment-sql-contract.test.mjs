import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const migration=readFileSync(new URL('../../../supabase/migrations/20261016162000_customer_firebase_enrollment_atomic.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../../../supabase/rollback/20261016162000_customer_firebase_enrollment_atomic_down.sql',import.meta.url),'utf8');
test('atomic enroll locks both keys and records audit in same transaction',()=>{
 assert.match(migration,/pg_advisory_xact_lock[\s\S]*pg_advisory_xact_lock/);
 assert.match(migration,/insert into public.customer_firebase_identity_links[\s\S]*insert into public.customer_firebase_migration_audit/);
 assert.match(migration,/mapping_conflict/);
 assert.match(migration,/for update/);
});
test('only service role can call and RLS remains separate',()=>{
 assert.match(migration,/auth\.role\(\) is distinct from 'service_role'/);
 assert.match(migration,/revoke all on function[\s\S]*anon,authenticated/);
 assert.match(migration,/grant execute[\s\S]*service_role/);
});
test('reversal drops only function; never deletes approved identities',()=>{
 assert.match(rollback,/drop function if exists/);
 assert.doesNotMatch(rollback,/delete from|truncate|drop table/i);
});
