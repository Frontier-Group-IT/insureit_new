// Isolated Node test harness: no Firebase credentials, network calls or database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const source = fs.readFileSync(path.join(__dirname, 'identity-contract.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const compiledModule = new Module(path.join(__dirname, 'identity-contract.js'), module);
compiledModule.filename = path.join(__dirname, 'identity-contract.js');
compiledModule.paths = module.paths;
compiledModule._compile(compiled.outputText, compiledModule.filename);
const { evaluateIdentityBridge } = compiledModule.exports;

const now = 1800000000;
const verified = {
  issuer: 'https://securetoken.google.com/insureit-customer-auth',
  audience: 'insureit-customer-auth',
  uid: 'firebase-identity-1',
  phoneNumber: '+919876543210',
  authTime: now - 60,
  issuedAt: now - 60,
  expiresAt: now + 3600,
};
const account = {
  userId: '123e4567-e89b-42d3-a456-426614174000',
  normalizedPhone: '+919876543210',
  isActiveCustomer: true,
};
const decide = (claims = verified, existing = account, time = now) => evaluateIdentityBridge(claims, existing, time);
const blocked = (claims, existing, time) => assert.equal(decide(claims, existing, time).status, 'blocked');

test('positive gate explicitly does not issue a session', () => {
  assert.deepEqual(decide(), { status: 'identity_verified_only', supabaseUserId: account.userId, needsSupportedSessionIssuer: true });
});
test('wrong Firebase project or issuer rejected', () => {
  blocked({ ...verified, audience: 'untrusted' }, account);
  blocked({ ...verified, issuer: 'https://securetoken.google.com/untrusted' }, account);
});
test('stale, expired and future verification rejected', () => {
  blocked({ ...verified, authTime: now - 301 }, account);
  blocked({ ...verified, expiresAt: now }, account);
  blocked({ ...verified, issuedAt: now + 1 }, account);
  blocked({ ...verified, authTime: now + 1 }, account);
});
test('no verified Indian phone or mismatch rejected', () => {
  blocked({ ...verified, phoneNumber: null }, account);
  blocked({ ...verified, phoneNumber: '+12025550123' }, account);
  blocked(verified, { ...account, normalizedPhone: '+919876543211' });
});
test('missing, inactive and malformed Supabase identity rejected', () => {
  blocked(verified, null);
  blocked(verified, { ...account, isActiveCustomer: false });
  blocked(verified, { ...account, userId: 'firebase-identity-1' });
});
