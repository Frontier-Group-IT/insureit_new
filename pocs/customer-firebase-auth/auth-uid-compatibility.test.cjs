const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname,'auth_uid_firebase_compatibility_REVIEW_ONLY.sql'),'utf8');
const provider = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/customer-otp-provider.ts'),'utf8');

test('UUID-subject fix remains review-only, never an automatically deployed migration',()=>{
  assert.match(sql,/REVIEW ONLY: do not apply/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION auth\.uid\(\)/);
  assert.match(provider,/return legacySupabaseOtpProvider;/);
});

test('candidate auth.uid function preserves UUID return type and fails closed for Firebase subjects',()=>{
  assert.match(sql,/RETURNS uuid/);
  assert.match(sql,/STABLE/);
  assert.match(sql,/request\.jwt\.claim\.sub/);
  assert.match(sql,/request\.jwt\.claims/);
  assert.match(sql,/\[0-9a-f\]\{8\}/);
  assert.match(sql,/THEN coalesce\(/);
  assert.match(sql,/ELSE NULL::uuid/);
  assert.doesNotMatch(sql,/SECURITY DEFINER/);
});

test('candidate grants no new customer table privileges or bypass role',()=>{
  assert.doesNotMatch(sql,/\bGRANT\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(sql,/\bDISABLE ROW LEVEL SECURITY\b/i);
  assert.doesNotMatch(sql,/\bservice_role\b/i);
});

const documentRules = fs.readFileSync(path.join(__dirname,'phase6_customer_documents_read_rls_REVIEW_ONLY.sql'),'utf8');
test('supplemental document policies require canonical customer ownership and matching claim',()=>{
  assert.match(documentRules,/CREATE POLICY firebase_customer_claim_documents_select/);
  assert.match(documentRules,/customer_firebase_can_read_customer\(customer_id\)/);
  assert.match(documentRules,/c\.id = claim_id AND c\.customer_id = claim_documents\.customer_id/);
  assert.match(documentRules,/CREATE POLICY firebase_customer_onboarding_applications_select/);
  assert.match(documentRules,/CREATE POLICY firebase_customer_onboarding_documents_select/);
  assert.match(documentRules,/a\.profile_id = \(SELECT public\.customer_firebase_profile_id\(\)\)/);
  assert.match(documentRules,/a\.source = 'customer_app'/);
  assert.doesNotMatch(documentRules,/\bFOR\s+(?:INSERT|UPDATE|DELETE)\b/i);
});
