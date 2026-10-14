const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const src = path.join(__dirname, 'customer-contact-email.ts');
const js = ts.transpileModule(fs.readFileSync(src, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(src + '.cjs', module);
loaded.filename = src + '.cjs'; loaded.paths = module.paths;
loaded._compile(js, loaded.filename);
const { customerContactEmail } = loaded.exports;
const alias = 'c-11111111-1111-4111-8111-111111111111@customer-login.insureit.invalid';

test('internal Auth alias can never be a deliverable customer contact address', () => {
  assert.equal(customerContactEmail(alias), null);
  assert.equal(customerContactEmail(alias.toUpperCase()), null);
  assert.equal(customerContactEmail('unexpected@customer-login.insureit.invalid'), null);
  assert.equal(customerContactEmail(''), null);
  assert.equal(customerContactEmail(null), null);
});

test('a real customer email is preserved without modifying case or account details', () => {
  assert.equal(customerContactEmail('  customer@example.com  '), 'customer@example.com');
  assert.equal(customerContactEmail('Sales@fleet.example'), 'Sales@fleet.example');
});

test('customer onboarding never reads an internal Auth email without filtering', () => {
  const auth = fs.readFileSync(path.join(__dirname, 'auth.ts'), 'utf8');
  assert.match(auth, /import \{ customerContactEmail \} from '\.\/customer-contact-email'/);
  assert.match(auth, /applicant_email: customerContactEmail\(user\.email\)/);
  assert.match(auth, /customerContactEmail\(details\?\.email\)/);
  assert.match(auth, /customerContactEmail\(metadata\.email\)/);
  assert.match(auth, /customerContactEmail\(user\.email\)/);
  assert.doesNotMatch(auth, /applicant_email: user\.email/);
  assert.doesNotMatch(auth, /\|\| user\.email \|\|/);
});
