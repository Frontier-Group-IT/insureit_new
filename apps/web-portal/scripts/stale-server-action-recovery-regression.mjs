import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
for(const path of ["app/error.tsx","app/global-error.tsx"]){
  const source=readFileSync(resolve(root,path),"utf8");
  assert.match(source,/UnrecognizedActionError/);
  assert.match(source,/window\.location\.reload/);
  assert.match(source,/previous submission|previous action/i);
}
for(const path of ["components/life-health-case-detail.tsx","components/life-health-issued-policy-edit-form.tsx"]){
  const source=readFileSync(resolve(root,path),"utf8");
  assert.match(source,/UnrecognizedActionError/);
  assert.match(source,/Reload the page|Reload this page/i);
}
console.log("Stale Server Action recovery messaging checks passed");
