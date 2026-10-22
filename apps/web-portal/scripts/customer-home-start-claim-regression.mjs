import fs from "node:fs";
import assert from "node:assert/strict";
const home=fs.readFileSync("app/customer/(protected)/home/page.tsx","utf8");
assert.match(home, /pathname: "\/customer\/start-claim", query: accountQuery/);
assert.match(home, /Start New Claim/);
assert.doesNotMatch(home, /Track Existing Claims/);
assert.match(home, /pathname:"\/customer\/claims",query:accountQuery/);
assert.doesNotMatch(home, /openClaims\.length \? "\/customer\/claims" : "\/customer\/start-claim"/);
assert.match(home, /resolveCustomerWebScope\(params\.account\)/);
assert.match(home, /loadCustomerClaimListContext\(account\.id\)/);
console.log("Customer Home permanent Start Claim regression passed.");

const selector=fs.readFileSync("components/customer-portal/customer-start-claim-selector.tsx","utf8");
const claimAction=fs.readFileSync("app/customer/(protected)/start-claim/actions.ts","utf8");
assert.match(selector,/confirmationGrantedRef\.current = true/,"Confirmation must grant form submission independently of React render state");
assert.match(selector,/claimFormRef\.current\?\.requestSubmit\(\)/,"Confirmation must submit the selected vehicle form");
assert.match(selector,/!hasActivePolicy && !confirmationGrantedRef\.current/,"No-policy claims must proceed after confirmation");
assert.match(selector,/disabled=\{confirming\}/,"Confirmation must block repeat clicks");
assert.match(selector,/Preparing claim\.\.\./,"Show a loading state during submission");
assert.match(claimAction,/\.eq\("vehicle_id", vehicleId\)\.is\("policy_id", null\)\.is\("external_policy_id", null\)/,"No-policy draft recovery must remain scoped to vehicle and policy-free drafts");
assert.match(claimAction,/policy_id: policy\?\.id \?\? null/,"No-policy draft creation must use a null policy");
console.log("Customer no-policy Continue claim submission contract passed.");

assert.match(selector,/useActionState\(prepareCustomerClaim/,"Claim server errors must return to the start-claim form");
assert.match(selector,/role="alert"/,"Claim errors must be visible inline");
assert.match(claimAction,/error\?\.code === "23514"/,"Policyless database constraint errors should be reported clearly");
assert.match(claimAction,/console\.error\("Customer claim draft creation failed"/,"Database failures must be logged server-side");

const startClaimPage=fs.readFileSync("app/customer/(protected)/start-claim/page.tsx","utf8");
assert.match(startClaimPage,/vehicle_id: claim\.vehicle_id/,"Selected-vehicle draft detection must include vehicle ID");
assert.match(selector,/claim\.vehicle_id === vehicleId && !claim\.policy_id && !claim\.external_policy_id/,"Policy-free existing claims must be discovered");
assert.match(selector,/existingClaim\.current_status === "Draft" \? "\/customer\/spot-intimation"/,"Existing drafts should resume at Spot Intimation");
assert.match(claimAction,/active\.current_status === "Draft"/,"Server must resume drafts at Spot Intimation");
assert.match(claimAction,/recoveryCode: recoveryError\?\.code/,"Log the actual recovery failure code");
console.log("Policy-free claim draft resume and recovery diagnostics regression passed.");

const claimLogo=fs.readFileSync("components/customer-portal/customer-claim-logo.tsx","utf8");
const spotPage=fs.readFileSync("app/customer/(protected)/spot-intimation/page.tsx","utf8");
assert.match(claimLogo,/getVehicleBrandLogo\(value\)/,"Customer header vehicle mark must use managed manufacturer resolver");
assert.match(claimLogo,/getInsurerLogo\(value\)/,"Customer header insurer mark must use managed insurer resolver");
assert.match(claimLogo,/kind === "insurer"[\s\S]*<Shield/,"Missing insurer must show a neutral icon");
assert.match(spotPage,/<CustomerClaimLogo value=\{claim.vehicle_make\} size=\{40\}/,"Spot header manufacturer mark retained");
assert.match(spotPage,/<CustomerClaimLogo value=\{claim.insurer_name\} kind="insurer" size=\{40\}/,"Spot header insurer mark retained");
console.log("Spot Intimation managed logo resolution regression passed.");

const spotLayout=fs.readFileSync("app/customer/(protected)/spot-intimation/page.tsx","utf8");
const voiceRecorder=fs.readFileSync("components/customer-portal/customer-claim-voice-recorder.tsx","utf8");
const claimUpload=fs.readFileSync("app/customer/(protected)/claims/[id]/stage/[stage]/upload-action.ts","utf8");
assert.match(spotLayout,/<CustomerClaimStageStrip/,"Spot Intimation must display nine-stage progress");
assert.match(spotLayout,/<CustomerClaimEvidenceWorkspace/,"Spot Intimation must offer existing authenticated documents");
assert.match(spotLayout,/<CustomerClaimVoiceRecorder/,"Spot Intimation must offer browser voice recording");
assert.match(spotLayout,/\/stage\/spot_status\?account=/,"Spot Intimation should continue to stage 2");
assert.match(voiceRecorder,/MediaRecorder/,"Voice note recording must use supported browser recording");
assert.match(voiceRecorder,/uploadCustomerClaimDocument/,"Voice note must use existing authorized upload action");
assert.match(claimUpload,/returnToSpotIntimation && stage==="spot_intimation"/,"Evidence uploads must stay on draft intimation");
console.log("Spot Intimation nine-stage layout, evidence and voice note regression passed.");
