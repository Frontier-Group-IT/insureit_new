import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=(p)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const migration=read('../../../supabase/migrations/20261021164000_partner_claim_stage_drafts.sql');
const editor=read('../components/partner-claim-stage-draft.tsx');
assert.match(migration,/partner_app_claim_in_scope\(p_claim_id\)/);
assert.match(migration,/partner_draft/);
assert.match(migration,/if v_status in \('Settled','Closed','Rejected','Claim Complete'\)/);
assert.doesNotMatch(migration,/update public\.claims set current_status/);
for(const key of ['spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment']) assert.ok(editor.includes(key),key);
for(const file of ['partner-claim-reference-stages','partner-work-approval','partner-claim-workshop-stages','partner-vehicle-delivery','partner-payment-encashment']) assert.match(read('../components/'+file+'.tsx'),/PartnerClaimStageDraft/);

const uploadEdge=read('../../../supabase/functions/partner-claim-document/index.ts');
const picker=read('../lib/claim-uploads.ts');
const stageOne=read('../components/partner-spot-intimation.tsx');
const inventory=read('../../../supabase/migrations/20261021170000_partner_claim_document_inventory.sql');
assert.match(uploadEdge,/scoped\.rpc\("partner_app_claim_in_scope"/);
assert.match(uploadEdge,/auth\.getUser\(\)/);
assert.match(uploadEdge,/storage\.from\("claim-documents"\)\.upload/);
assert.match(uploadEdge,/claim_documents"\)\.insert/);
assert.match(uploadEdge,/claim\.current_status/);
assert.match(picker,/expo-document-picker/);
assert.match(stageOne,/pickAndUploadPartnerClaimDocument/);
assert.match(inventory,/partner_app_claim_in_scope\(p_claim_id\)/);

console.log('Partner draft stages and scoped document upload contracts verified');