import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const form=readFileSync("components/life-health-policy-form.tsx","utf8");
const detail=readFileSync("components/life-health-case-detail.tsx","utf8");
const modal=readFileSync("components/document-delete-confirmation.tsx","utf8");
const nonMotor=readFileSync("components/non-motor-document-picker.tsx","utf8");
assert.match(form,/DocumentDeleteConfirmation/);
assert.ok(form.includes('Replace ${file.name}'), 'Life/Health new policy uses uploaded name for Replace label');
assert.match(form,/Trash2/);
assert.match(detail,/onDelete=\{deleteDocument\}/);
assert.match(detail,/Delete document\?/);
assert.doesNotMatch(detail,/window\.confirm\(/);
assert.match(nonMotor,/DocumentDeleteConfirmation/);
assert.match(nonMotor,/Replace \$\{label\}/);
assert.match(nonMotor,/onClick=\{\(\) => setShowDeleteConfirmation\(true\)\}/);
assert.match(modal,/role="alertdialog"/);
assert.match(modal,/Are you sure you want to delete/);
console.log("Unified Life/Health document actions regression passed");

const issued=readFileSync("components/life-health-issued-policy-edit-form.tsx","utf8");
const policyCopy=readFileSync("components/policy-edit-copy-footer-actions.tsx","utf8");
for (const [name,source] of [["Life/Health Policy Add",form],["Life/Health Case",detail],["Life/Health Issued Edit",issued],["Non-Motor Add/Edit",nonMotor],["Motor Policy Edit",policyCopy]]) {
  assert.doesNotMatch(source, /<Eye(?:\\s|>)/, name+" must not show redundant eye icon for uploaded file");
}
assert.match(detail,/existing\\.file_name/, "Case document shows actual uploaded filename");
assert.match(detail,/RefreshCw/, "Case documents offer Replace after Delete");
assert.match(issued,/doc\\.fileName/, "Issued policy filename is clickable");
assert.match(policyCopy,/policyCopy\\.fileName/, "Motor edit filename is clickable");
assert.match(nonMotor,/viewSavedDocument/, "Non-Motor existing filename remains clickable");
console.log("Unified document row: filename, Delete, Replace regression passed");

const intakeNew=readFileSync("components/policy-intake-form.tsx","utf8");
const intakeReplacement=readFileSync("components/policy-intake-response-upload.tsx","utf8");
const intakeDocument=readFileSync("components/policy-intake-document-button.tsx","utf8");
const intakePage=readFileSync("app/policy-intakes/[id]/page.tsx","utf8");
const ocr=readFileSync("components/policy-ocr-import-panel.tsx","utf8");
const customerVault=readFileSync("components/customer-portal/customer-document-vault.tsx","utf8");
for(const [name,src] of [["New Policy Intake",intakeNew],["Policy Intake replacement",intakeReplacement],["Policy OCR import",ocr]]){
  for(const action of ["Open ","Delete selected","Replace"]) assert.ok(src.includes(action),name+" should provide selected-document "+action);
  assert.match(src,/previewUrl/,name+" should support previewing selected filename");
}
assert.match(intakeDocument,/fileName\|\|/, "Policy Intake saved copy must use the actual filename where available");
assert.match(intakePage,/fileName=\{data\.file_name\}/, "Policy Intake detail passes its stored file name to document action");
assert.doesNotMatch(customerVault,/>Open<\/a>/, "Customer vault should not duplicate filename and Open link");
assert.match(customerVault,/title=\{doc\.file_name\}/, "Customer vault filename must be clickable");
console.log("Policy and Intake document filenames replace duplicate view controls");
