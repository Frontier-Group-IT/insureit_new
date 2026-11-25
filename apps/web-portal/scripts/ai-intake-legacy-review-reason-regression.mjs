import assert from "node:assert/strict";
import {inferLegacyAiReviewReason as infer} from "../lib/ai-intake-legacy-review.ts";
const base={sourceInsuredName:"Test Fleet Company",draftInsuredName:"Test Fleet Company",
  intakeMobile:"9999999999",hasCurrentVehicle:true,
  currentVehicleOwnerName:"Test Fleet Company",currentVehicleOwnerMobile:"9999999999"};
assert.equal(infer({...base,draftInsuredName:""}),"insured_name_mismatch");
assert.equal(infer({...base,currentVehicleOwnerName:"Different Fleet Company"}),"vehicle_ownership");
assert.equal(infer({...base,currentVehicleOwnerMobile:"8888888888"}),"customer_identity");
assert.equal(infer(base),null);
assert.equal(infer({...base,hasCurrentVehicle:false}),null);
assert.equal(infer({...base,sourceInsuredName:"Different Fleet Company"}),null);
assert.equal(infer({...base,sourceInsuredName:"",draftInsuredName:""}),null);
console.log("Legacy review reason inference passed strict positive/negative cases");
