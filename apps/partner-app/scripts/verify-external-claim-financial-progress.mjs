import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const screen = read('../app/claim/[id].tsx');
const client = read('../lib/claims.ts');
const sql = read('../../../supabase/migrations/20261111184500_partner_claim_external_financial_milestones.sql');
const rollback = read('../../../supabase/rollback/20261111184500_partner_claim_external_financial_milestones.sql');

// The Partner App must follow the Customer Portal's external-policy financial source.
assert.match(sql, /partner_app_claim_in_scope\(p_claim_id\)/, 'All returned claim details must remain authorization-scoped');
assert.match(sql, /'external_policy_id',b\.external_policy_id/, 'Expose the server-owned external-policy identity');
assert.match(sql, /'financial_milestones',case when b\.external_policy_id is not null/, 'Do not return external financial milestones for internal claims');
assert.match(sql, /from public\.claim_milestones m[\s\S]*where m\.claim_id=p_claim_id/, 'Use claim-scoped Customer Portal milestone source');
for (const field of ['estimate_amount', 'bill_amount', 'do_amount', 'payment_received_amount']) {
  assert.ok(sql.includes("m.details->'" + field + "'"), 'Missing approved financial milestone field: ' + field);
}
assert.doesNotMatch(sql, /'details',m\.details|'details',m\.details\b/, 'Never expose all milestone details');
assert.match(rollback, /partner_app_claim_in_scope\(p_claim_id\)/, 'Rollback must retain claim authorization');
assert.doesNotMatch(rollback, /'financial_milestones'/, 'Rollback restores previous RPC response');
assert.match(client, /external_policy_id\?: string \| null/, 'Model explicit external-policy identity');
assert.match(client, /financial_milestones\?: PartnerClaimFinancialMilestone\[\]/, 'Missing old-RPC data must fail closed');

// Stage 4 must actually be recorded; status-label-only progress is not sufficient.
assert.match(screen, /if \(!data\.claim\.external_policy_id\) return \[\]/, 'Internal claims never show the card');
assert.match(screen, /if \(!Array\.isArray\(milestones\)\) return \[\]/, 'Before the RPC migration, hide card rather than show blank rows');
assert.match(screen, /item\.key === 'work_approval' && item\.status === 'completed'/, 'Work Approval completion is the gate');
assert.match(screen, /recordedStage\(data, 'work_approval'\)/, 'Support completed Operations Work Approval records');
assert.match(screen, /entry\.key === item\.key && entry\.status === 'completed'/, 'Do not reveal incomplete financial milestones');
assert.match(screen, /Number\.isFinite\(amount\) && amount >= 0/, 'Reject missing, invalid, and negative amount data while preserving zero');
assert.match(screen, /financialRows\.length > 0 \? <View style=\{styles\.financeCard\}>/, 'No empty Financial Progress card');
assert.match(screen, /financialRows\.map\(item =>/, 'Only saved financial amounts are rendered');
assert.doesNotMatch(screen, /formatRupees\(stageMoney\(data,item\.key\)\)/, 'Do not render four unconditional blank amount rows');
assert.match(screen, /PartnerClaimDocuments documents=\{data\.documents\}/, 'Preserve claim documents');
assert.match(screen, /CLAIM_STAGES\.map/, 'Preserve Claim Journey');

console.log('Partner external-only, Stage-4-gated, recorded-value financial progress contracts passed.');
