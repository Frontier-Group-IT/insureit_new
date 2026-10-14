/**
 * DISPOSABLE LOCAL SUPABASE AUTH TEST ONLY. NEVER points to production.
 * Proves supported GoTrue Auth user-ID preservation and session exchange for
 * synthetic phone-only users, under ephemeral GitHub Actions Docker containers.
 * No Firebase SMS and no business/customer data are involved.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { customerAuthAlias } from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey ||
    !/^https?:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url)) {
  throw new Error('Refusing to run: requires LOCALHOST Supabase API and ephemeral test keys');
}
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const makeUserClient = () => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cleanup = [];
async function seed(phone, phone_confirm = true) {
  const { data, error } = await admin.auth.admin.createUser({
    phone, phone_confirm,
  });
  if (error || !data?.user?.id) throw error ?? Error('Could not seed local phone user');
  cleanup.push(data.user.id);
  assert.equal(data.user.email || null, null);
  return data.user.id;
}
async function aliasAndChallenge(userId, alias) {
  const initial = await admin.auth.admin.getUserById(userId);
  assert.equal(initial.error, null);
  assert.equal(initial.data.user.id, userId);
  assert.equal(initial.data.user.email || null, null);

  const updated = await admin.auth.admin.updateUserById(userId, {
    email: alias, email_confirm: true,
  });
  if (updated.error) throw updated.error;
  assert.equal(updated.data.user.id, userId, 'Auth UUID must remain unchanged');
  assert.equal(updated.data.user.email, alias);
  assert.ok(updated.data.user.email_confirmed_at);

  const after = await admin.auth.admin.getUserById(userId);
  if (after.error) throw after.error;
  assert.equal(after.data.user.id, userId);
  assert.equal(after.data.user.email, alias);
  assert.equal(after.data.user.phone, initial.data.user.phone,
    'Phone may not change when provisioning existing Auth identity');
  assert.ok(after.data.user.email_confirmed_at);

  const generated = await admin.auth.admin.generateLink({
    type: 'magiclink', email: alias,
  });
  if (generated.error) throw generated.error;
  assert.equal(generated.data.user.id, userId,
    'Magic link must never identify an unknown/created account');
  assert.equal(generated.data.user.email, alias);
  assert.ok(generated.data.properties.hashed_token);
  return generated.data.properties.hashed_token;
}
async function verifySession(userId, hash) {
  const userClient = makeUserClient();
  const exchanged = await userClient.auth.verifyOtp({ type: 'magiclink', token_hash: hash });
  if (exchanged.error) throw exchanged.error;
  assert.equal(exchanged.data.user.id, userId);
  assert.equal(exchanged.data.session.user.id, userId);
  assert.ok(exchanged.data.session.access_token);
  assert.ok(exchanged.data.session.refresh_token);

  const verified = await userClient.auth.getUser();
  if (verified.error) throw verified.error;
  assert.equal(verified.data.user.id, userId);

  const refreshed = await userClient.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  assert.ok(refreshed.data.session?.refresh_token);
  assert.equal(refreshed.data.user.id, userId);
  return userClient;
}
try {
  // Real GoTrue-compatible responses, not mocked challenge/session methods.
  const userA = await seed('+919876543210');
  const userB = await seed('+919876543211');
  const userC = await seed('+919876543212', false);
  const beforeC = await admin.auth.admin.getUserById(userC);
  if (beforeC.error) throw beforeC.error;
  assert.equal(beforeC.data.user.phone_confirmed_at || null, null,
    'Unconfirmed synthetic Supabase phone must start without confirmation');
  assert.notEqual(userA, userB);
  assert.notEqual(userC, userB);

  // .example.org belongs to the reserved example domain and is used only in
  // the local disposable auth container. It is NOT a production alias plan.
  const aliasA = customerAuthAlias(userA);
  const aliasB = customerAuthAlias(userB);
  const aliasC = customerAuthAlias(userC);
  assert.ok(aliasA?.endsWith('.invalid'));
  assert.ok(aliasB?.endsWith('.invalid'));
  assert.ok(aliasC?.endsWith('.invalid'));
  const challengeA = await aliasAndChallenge(userA, aliasA);
  const challengeB = await aliasAndChallenge(userB, aliasB);
  const challengeC = await aliasAndChallenge(userC, aliasC);
  assert.notEqual(challengeA, challengeB);
  await verifySession(userA, challengeA);
  await verifySession(userB, challengeB);
  await verifySession(userC, challengeC);
  const afterC = await admin.auth.admin.getUserById(userC);
  if (afterC.error) throw afterC.error;
  assert.equal(afterC.data.user.phone_confirmed_at || null, null,
    'Provisioning must not silently mark an originally unconfirmed phone confirmed');

  const replay = await makeUserClient().auth.verifyOtp({
    type: 'magiclink', token_hash: challengeA,
  });
  assert.ok(replay.error, 'A one-use challenge must reject replay');

  // Verify both immutable original user UUIDs still exist and differ.
  const [foundA, foundB] = await Promise.all([
    admin.auth.admin.getUserById(userA), admin.auth.admin.getUserById(userB),
  ]);
  assert.equal(foundA.data.user.id, userA);
  assert.equal(foundB.data.user.id, userB);

  console.info('PASS: local-only original Auth UUIDs retained, both confirmed and unconfirmed phone variants, refresh, replay denial and account separation');
} finally {
  await Promise.all(cleanup.map(id => admin.auth.admin.deleteUser(id).catch(() => undefined)));
}
