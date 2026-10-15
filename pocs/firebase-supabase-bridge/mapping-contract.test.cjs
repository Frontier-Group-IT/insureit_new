const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const file = path.join(__dirname, 'mapping-contract.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
});
const mod = new Module(file + '.cjs', module);
mod.filename = file + '.cjs';
mod.paths = module.paths;
mod._compile(compiled.outputText, mod.filename);
const { resolveApprovedPrincipal } = mod.exports;
const principal = { iss: 'https://securetoken.google.com/insureit-customer-auth', aud: 'insureit-customer-auth', sub: 'firebase-uid-1', role: 'authenticated' };
const userId = '123e4567-e89b-42d3-a456-426614174000';
const mapping = { firebaseUid: 'firebase-uid-1', supabaseUserId: userId, active: true, reviewed: true };

test('approved unique mapping resolves without issuing a session', () => {
  assert.deepEqual(resolveApprovedPrincipal(principal, [mapping]), { status: 'resolved', supabaseUserId: userId });
});
test('wrong issuer, audience, role, or missing UID denied', () => {
  for (const key of ['iss','aud','role','sub']) {
    assert.equal(resolveApprovedPrincipal({ ...principal, [key]: 'untrusted' }, [mapping]).status, 'denied');
  }
});
test('missing or duplicated mapping denied', () => {
  assert.equal(resolveApprovedPrincipal(principal, []).status, 'denied');
  assert.equal(resolveApprovedPrincipal(principal, [mapping, {...mapping}]).status, 'denied');
});
test('unreviewed, inactive or malformed mappings denied', () => {
  for (const change of [{reviewed:false},{active:false},{supabaseUserId:'firebase-uid-1'}]) {
    assert.equal(resolveApprovedPrincipal(principal, [{...mapping,...change}]).status,'denied');
  }
});
test('two active Firebase UIDs pointing to the same Supabase user denied', () => {
  assert.equal(resolveApprovedPrincipal(principal, [mapping,{...mapping,firebaseUid:'another-uid'}]).status,'denied');
});
