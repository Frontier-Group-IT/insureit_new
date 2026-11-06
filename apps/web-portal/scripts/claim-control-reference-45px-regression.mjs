import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const operations=read("../components/claim-manager/operations-claim-stages.tsx");
const customer=read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const choice=read("../components/customer-portal/customer-claim-boolean-choice.tsx");

// User-defined visual dimensions: text 320x45, date 260x45, Yes/No 122x45 each + 10px gap.
assert.match(operations,/field\.type === "date" \? "max-w-\[260px\]" : "max-w-\[320px\]"/);
assert.match(operations,/relative flex h-\[40px\] w-full max-w-\[260px\]/);
assert.match(operations,/max-w-\[254px\] grid-cols-2 gap-\[10px\]/);
assert.match(operations,/flex h-\[40px\] cursor-pointer/g);
assert.match(operations,/max-w-\[320px\] rounded-lg/);
assert.match(operations,/grid h-\[40px\] w-full max-w-\[320px\]/);
assert.match(customer,/field\.type==="date"\?"max-w-\[260px\]"/);
assert.match(customer,/"max-w-\[254px\]":"max-w-\[320px\]"/);
assert.match(customer,/className="mt-1 h-\[40px\] w-full rounded-md/);
assert.match(choice,/max-w-\[254px\] grid-cols-2 gap-\[10px\]/);
assert.match(choice,/h-\[40px\] rounded-md/);

// Ensure this remains a presentation change: native date field, values, and field validations.
assert.match(operations,/name=\{field\.name\} value=\{value\} required=\{required\}/);
assert.match(operations,/type="date"/);
assert.match(operations,/required=\{required\}/);
assert.match(operations,/defaultChecked=\{yesChecked\}/);
assert.match(operations,/defaultChecked=\{noChecked\}/);
assert.match(customer,/name=\{field\.key\} type=\{field\.type\} required=\{!field\.optional\}/);
assert.match(choice,/name=\{name\} value=\{value\}/);
assert.match(choice,/onClick=\{\(\)=>setValue\(key\)\}/);
assert.match(customer,/className="flex min-h-9 items-center gap-2 rounded-md border border-\[#D9E3F0\] bg-\[#F1F4F9\]/);
console.log("Claim forms 320/260/122 x40 responsive sizing regression passed.");
