/**
 * Runs ONLY with an ephemeral local Supabase Docker stack. NEVER production.
 * End-to-end DB checks: one-use Firebase phone auth_time, cooldown,
 * concurrent races and service_role-only access. No real Firebase credentials.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey ||
    !/^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
  throw Error('Refusing: test must run only against localhost Supabase port 54321');
}
const server = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const name = 'customer_firebase_session_exchange_consume';
const now = Math.floor(Date.now() / 1000);
async function consume(uid, authTime, interval = 120) {
  const { data, error } = await server.rpc(name, {
    p_firebase_uid: uid, p_auth_time: authTime, p_interval_seconds: interval,
  });
  if (error) throw new Error('Privileged local test RPC failed: ' + error.code);
  return data;
}

assert.equal(await consume('synthetic-one', now), true);
assert.equal(await consume('synthetic-one', now), false,
  'same Firebase auth_time is forbidden twice');
assert.equal(await consume('synthetic-one', now + 1), false,
  'a later Firebase SMS sign-in is rate limited during cooldown');
assert.equal(await consume('synthetic-two', now), true,
  'one verified user cannot block another verified user');

const results = await Promise.all(Array.from({ length: 10 },
  () => consume('synthetic-concurrent', now)));
assert.equal(results.filter(Boolean).length, 1,
  'concurrent token exchanges must issue at most one challenge');

assert.equal(await consume('synthetic-old', now - 301), false,
  'expired phone verification events cannot enter the DB gate');
assert.equal(await consume('synthetic-future', now + 35), false,
  'future-dated phone authentication cannot enter the DB gate');
assert.equal(await consume('synthetic-missing', null), false);
assert.equal(await consume('x', now), false, 'invalid short UID');
assert.equal(await consume('synthetic-invalid-interval', now, 10), false);

const publicRpc = await anon.rpc(name, {
  p_firebase_uid: 'synthetic-anon',
  p_auth_time: now,
  p_interval_seconds: 120,
});
assert.ok(publicRpc.error,
  'anon clients must not be able to call privileged session issuance gate');

const anonRead = await anon.from('customer_firebase_session_exchange_limits')
  .select('firebase_uid').limit(1);
assert.ok(anonRead.error,
  'anon clients must not read private throttle state');

const { data: serverRead, error: readError } = await server
  .from('customer_firebase_session_exchange_limits')
  .select('firebase_uid,last_auth_time,next_allowed_at')
  .eq('firebase_uid', 'synthetic-one')
  .single();
assert.equal(readError, null);
assert.equal(serverRead.last_auth_time, now);
assert.ok(serverRead.next_allowed_at);

console.info('PASS: disposable local rate limiter enforces replay, cooldown, concurrency, age, and anon denial');
