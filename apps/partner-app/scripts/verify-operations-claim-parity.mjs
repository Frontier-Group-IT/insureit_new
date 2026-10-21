import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const read=(path)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),'utf8');
const stages=read('../app/claim/edit-stage.tsx');
const spot=read('../components/partner-spot-intimation.tsx');
const client=read('../lib/claims.ts');
const stageDb=read('../../../supabase/migrations/20261021170000_partner_claim_stage_drafts.sql');
const docDb=read('../../../supabase/migrations/20261021171000_partner_claim_document_inventory.sql');
const edge=read('../../../supabase/functions/partner-claim-upload/index.ts');
assert.match(stages,/savePartnerStageDraft\(/);
assert.match(stages,/does not advance claim status/);
for(const key of ['spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment']){
 assert.ok(stages.includes(key),'missing stage form '+key);
}
assert.match(spot,/pickAndUpload/);
assert.match(spot,/Upload multiple documents/);
assert.match(spot,/pickAndUpload\("additional_document",true\)/);
assert.match(spot,/Attach voice note/);
assert.match(client,/uploadToSignedUrl/);
assert.match(client,/partner_app_claim_document_list/);
assert.match(stageDb,/partner_app_claim_in_scope\(p_claim_id\)/);
assert.match(stageDb,/v_target>v_active/);
assert.doesNotMatch(stageDb,/update public\.claims/);
assert.match(docDb,/partner_app_claim_in_scope\(p_claim_id\)/);
assert.match(edge,/partner_app_claim_in_scope/);
assert.match(edge,/createSignedUploadUrl/);
assert.match(edge,/actualSize>max/);
console.log('Partner claim stage drafts and scoped document workflows verified');
