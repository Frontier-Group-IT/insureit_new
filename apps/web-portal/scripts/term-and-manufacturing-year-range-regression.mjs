import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=(file)=>readFileSync(resolve(root,file),"utf8");
assert.match(read("components/life-health-case-detail.tsx"),/YEAR_OPTIONS=Array\.from\(\{length:100\}/);
assert.match(read("components/life-health-issued-policy-edit-form.tsx"),/const years = Array\.from\(\{length:100\}/);
assert.match(read("components/life-health-policy-form.tsx"),/YEAR_OPTIONS = Array\.from\(\{ length: 100 \}/);
for(const file of ["components/policy-form.tsx","components/policy-unified-form.tsx"]){
  const source=read(file);
  assert.match(source,/new Date\(\)\.getFullYear\(\)\s*-\s*1900\s*\+\s*1/);
}
console.log("PPT/PD 100-year and manufacturing 1900 range checks passed");
