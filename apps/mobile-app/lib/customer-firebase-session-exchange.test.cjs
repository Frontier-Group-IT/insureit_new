const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const idA = '1e1e1e1e-1111-4111-8111-111111111111';
const idB = '2e2e2e2e-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64);
const sourceFile = path.join(__dirname, 'customer-firebase-session-exchange.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness(opts = {}) {
  const previous = opts.previous ?? null;
  let active = previous;
  const calls = { fetch: 0, verifyOtp: 0, getUser: 0, restored: 0, signedOut: 0 };
  const expectedId = opts.expectedId ?? idB;
  const candidateId = opts.candidateId ?? idB;
  const candidate = {
    user: { id: candidateId },
    access_token: 'supabase-issued-access',
    refresh_token: 'supabase-issued-refresh',
  };
  const sdk = {
    auth: {
      getSession: async () => ({ data: { session: active }, error: null }),
      verifyOtp: async (args) => {
        calls.verifyOtp++;
        assert.deepEqual(args, { token_hash: hash, type: 'magiclink' });
        active = candidate;
        return { data: { user: candidate.user, session: candidate }, error: null };
      },
      getUser: async () => {
        calls.getUser++;
        return { data: { user: { id: opts.getUserId ?? candidateId } }, error: null };
      },
      signOut: async () => { calls.signedOut++; active = null; return { error: null }; },
    },
    from: (table) => {
      assert.equal(table, 'profiles');
      return { select: (fields) => {
        assert.equal(fields, 'id,role,is_active');
        return { eq: (column, id) => {
          assert.equal(column, 'id');
          assert.equal(id, expectedId);
          return { maybeSingle: async () => ({
            data: opts.profile ?? { id: expectedId, role: 'customer', is_active: true },
            error: null,
          }) };
        } };
      } };
    },
  };
  const restoreCustomerSessionSnapshot = async snapshot => {
    calls.restored++;
    active = snapshot;
  };
  const loaded = new Module(sourceFile + '.cjs', module);
  loaded.filename = sourceFile + '.cjs'; loaded.paths = module.paths;
  loaded.require = name => {
    if (name === 'react-native') return { Platform: { OS: opts.platform ?? 'android' } };
    if (name === './supabase') return { supabase: sdk };
    if (name === './customer-account-vault') return { restoreCustomerSessionSnapshot };
    if (name === './customer-firebase-session-diagnostics.mjs') return { classifyFirebaseBridgeFailure: () => 'bridge_unavailable' };
    throw new Error('Unexpected dependency ' + name);
  };
  loaded._compile(compiled, loaded.filename);
  return {
    calls,
    getActive: () => active,
    run: () => loaded.exports.exchangeVerifiedFirebaseOtpForSupabaseSession('firebase-id-token-'.repeat(12)),
    flags: () => loaded.exports.firebaseOtpSessionGateEnabled(),
    mockFetch: async () => {
      calls.fetch++;
      const payload = opts.payload ?? { code: 'exchange_ready', token_hash: hash, profile_id: expectedId };
      return { ok: opts.responseOk ?? true, json: async () => payload };
    },
  };
}
async function withEnvironment(h, run) {
  const saved = {
    enabled: process.env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    fetch: global.fetch,
  };
  process.env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED = 'true';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://testing-placeholder.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
  global.fetch = (...args) => h.mockFetch(...args);
  try { await run(); } finally {
    for (const [k,v] of Object.entries({
      EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED: saved.enabled,
      EXPO_PUBLIC_SUPABASE_URL: saved.url,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: saved.key,
    })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    global.fetch = saved.fetch;
  }
}

test('success: a real Supabase Auth session is verified, never a Firebase session', async () => {
  const h = harness();
  await withEnvironment(h, async () => {
    const session = await h.run();
    assert.equal(session.user.id, idB);
    assert.equal(session.access_token, 'supabase-issued-access');
    assert.equal(h.calls.fetch, 1);
    assert.equal(h.calls.verifyOtp, 1);
    assert.equal(h.calls.getUser, 1);
    assert.equal(h.calls.restored, 0);
  });
});

test('fail closed: wrong Supabase Auth UUID restores original Customer A session', async () => {
  const prior = { user: { id: idA }, access_token: 'prior', refresh_token: 'prior' };
  const h = harness({ previous: prior, candidateId: idA });
  await withEnvironment(h, async () => {
    await assert.rejects(h.run(), /existing OTP login/);
    assert.equal(h.getActive(), prior);
    assert.equal(h.calls.restored, 1);
  });
});

test('fail closed: inactive or staff profile restores previous signed-in Customer', async () => {
  const prior = { user: { id: idA } };
  const h = harness({ previous: prior, profile: { id: idB, role: 'it_super_user', is_active: false } });
  await withEnvironment(h, async () => {
    await assert.rejects(h.run(), /existing OTP login/);
    assert.equal(h.getActive(), prior);
    assert.equal(h.calls.restored, 1);
  });
});

test('fail closed: hostile/malformed server challenge does not alter prior account', async () => {
  const prior = { user: { id: idA } };
  const h = harness({ previous: prior, payload: { code: 'exchange_ready', token_hash: 'bad', profile_id: idB } });
  await withEnvironment(h, async () => {
    await assert.rejects(h.run(), /existing OTP login/);
    assert.equal(h.calls.verifyOtp, 0);
    assert.equal(h.getActive(), prior);
  });
});

test('fail closed: backend reports phone-only identity unavailable, no session mutation', async () => {
  const prior = { user: { id: idA } };
  const h = harness({ previous: prior, responseOk: false });
  await withEnvironment(h, async () => {
    await assert.rejects(h.run(), /existing OTP login/);
    assert.equal(h.calls.verifyOtp, 0);
    assert.equal(h.getActive(), prior);
  });
});

test('fail closed: unexpected Auth session without previous account signs out locally', async () => {
  const h = harness({ candidateId: idA });
  await withEnvironment(h, async () => {
    await assert.rejects(h.run(), /existing OTP login/);
    assert.equal(h.getActive(), null);
    assert.equal(h.calls.signedOut, 1);
  });
});

test('disabled by default on unsupported platform', async () => {
  const h = harness({ platform: 'ios' });
  await withEnvironment(h, async () => {
    assert.equal(h.flags(), false);
    await assert.rejects(h.run(), /not enabled/);
    assert.equal(h.calls.fetch, 0);
  });
});
