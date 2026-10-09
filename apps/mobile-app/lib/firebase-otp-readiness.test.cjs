const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'firebase-otp-readiness.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const m = new Module(file + '.cjs', module);
m.filename = file + '.cjs';
m.paths = module.paths;
m._compile(js, m.filename);
const { getFirebaseOtpReadiness } = m.exports;
const complete = {
  nativeModuleInstalled: true,
  firebaseAndroidAppRegistered: true,
  supabaseThirdPartyConfigured: true,
  reviewedIdentityMappingEnabled: true,
  rlsVerified: true,
};
test('never enable a partially configured Firebase login', () => {
  for (const key of Object.keys(complete)) {
    assert.equal(getFirebaseOtpReadiness({ ...complete, [key]: false }).status, 'not_configured');
  }
});
test('only a completely verified Firebase configuration is ready', () => {
  assert.equal(getFirebaseOtpReadiness(complete).status, 'ready_for_native_build');
});
