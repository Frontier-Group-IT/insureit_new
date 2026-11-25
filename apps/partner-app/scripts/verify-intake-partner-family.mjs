// Pure, no production data: validated Partner/Branch family predicates.
import assert from 'node:assert/strict';
import { partnerFamilyPredicates } from '../../../supabase/functions/partner-intake-document/intake-partner-family.ts';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const parents = [{id:id(1),partner_code:'PT00071'}];
const branches = [{id:id(2),partner_code:'PT00072'}];
const profiles = [{profile_id:id(3)}, {profile_id:null}];
const intermediaries = [{id:id(4)}];
const accounts = [{id:id(5)}];
const p = partnerFamilyPredicates(parents,branches,profiles,intermediaries,accounts);
assert.deepEqual(p, [
  'lead_source_code.in.(PT00071,PART-2026-00071,PT00072,PART-2026-00072)',
  `submitted_by_profile_id.in.(${id(3)})`,
  `lead_source_id.in.(${id(4)})`,
  `submitted_by_portal_account_id.in.(${id(5)})`,
]);
assert.deepEqual(partnerFamilyPredicates([],[],[],[],[]),[]);
assert.deepEqual(partnerFamilyPredicates(parents,[],[],[],[]),[
  'lead_source_code.in.(PT00071,PART-2026-00071)',
]);
assert.deepEqual(partnerFamilyPredicates([
  {id:id(1),partner_code:'PT00071'},
  {id:id(2),partner_code:'PT00071'},
],[],[],[],[]),['lead_source_code.in.(PT00071,PART-2026-00071)']);
assert.throws(() => partnerFamilyPredicates([{id:id(1),partner_code:'PT00071),submitted_by_profile_id.eq.'}],[],[],[],[]), /Invalid Partner family code/);
assert.throws(() => partnerFamilyPredicates([{id:'bad',partner_code:'PT00071'}],[],[],[],[]), /Invalid Partner family identifier/);
assert.throws(() => partnerFamilyPredicates(parents,[],[{profile_id:'bad'}],[],[]), /Invalid Partner family linked identity/);
assert.throws(() => partnerFamilyPredicates(parents,[],[],[{id:'bad'}],[]), /Invalid Partner family linked identity/);
assert.throws(() => partnerFamilyPredicates(parents,[],[],[],[{id:'bad'}]), /Invalid Partner family linked identity/);
console.log('Partner Intake verified family scope unit tests passed');
