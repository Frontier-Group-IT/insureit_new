const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-data-client.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module(file + '.cjs', module);
mod.filename = file + '.cjs'; mod.paths = module.paths; mod._compile(output, mod.filename);
const { createCustomerFirebaseDataClient } = mod.exports;

test('rejects missing or insecure Supabase configuration', () => {
  assert.throws(() => createCustomerFirebaseDataClient('http://example.com', 'anon', async () => 'token'), /configuration/);
  assert.throws(() => createCustomerFirebaseDataClient('https://example.com', '', async () => 'token'), /configuration/);
});
test('creates a separate client and never installs a Supabase Auth session', () => {
  let calls = 0;
  const client = createCustomerFirebaseDataClient('https://example.supabase.co', 'public-anon-key', async () => {
    calls++;
    return 'firebase-token';
  });
  assert.equal(typeof client.from, 'function');
  assert.throws(() => client.auth.getSession(), /accessToken option/);
  assert.equal(calls, 0);
});
