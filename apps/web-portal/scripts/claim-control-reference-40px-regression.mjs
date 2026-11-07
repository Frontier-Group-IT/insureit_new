import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const operations=read("../components/claim-manager/operations-claim-stages.tsx");
const customer=read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const choice=read("../components/customer-portal/customer-claim-boolean-choice.tsx");
const spot=read("../app/customer/(protected)/spot-intimation/page.tsx");
const start=read("../components/customer-portal/customer-start-claim-selector.tsx");
const operationsStart=read("../app/claims/new/add-claim-form.tsx");

// Requested dimensions: text 320x40, date 260x40, Yes/No 122x40 each + 10px gap.
assert.match(operations,/selected\.key === "payment_encashment" \|\| selected\.key === "delivery_order" \? "" : field\.type === "date" \? "max-w-\[260px\]" : "max-w-\[320px\]"/,"Stages 7 and 9 use full cell width; other stages retain max widths.");
assert.match(operations,/compact \? "h-\[34px\]" : "h-\[40px\] max-w-\[260px\]"/,"Only compact delivery order dates use 34px controls; other date controls remain 40px.");
assert.match(operations,/selected\.key === "payment_encashment" \|\| selected\.key === "delivery_order" \? "gap-2" : "max-w-\[254px\] gap-\[10px\]"/,"Stages 7 and 9 compact controls; other stages retain 254px width and 10px gap.");
assert.match(operations,/selected\.key === "delivery_order" \|\| selected\.key === "payment_encashment" \? "h-\[34px\]" : "h-\[40px\]"/,"Delivery Order and Payment Encashment Yes/No choices are 34px; other stages retain 40px.");
assert.match(operations,/max-w-\[320px\] rounded-lg/);
assert.match(operations,/grid h-\[40px\] w-full max-w-\[320px\]/);
assert.match(customer,/selected\.key==="payment_encashment"\?"":field\.type==="date"\?"max-w-\[260px\]"/,"Stage 9 fills available grid cell; other stages retain date width.");
assert.match(customer,/"max-w-\[254px\]":"max-w-\[320px\]"/);
assert.match(customer,/selected\.key==="payment_encashment"\?"mt-1 h-\[34px\] w-full/,"Stage 9 input is 34px; other stages retain 40px.");
assert.match(choice,/compact \? "gap-2" : "max-w-\[254px\] gap-\[10px\]"/,"Compact Stage 9 controls; other stages keep original sizing.");
assert.match(choice,/compact \? "h-\[34px\]" : "h-\[40px\]"/,"Only Stage 9 has 34px Yes/No controls.");

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
assert.match(operations,/whitespace-nowrap max-sm:whitespace-normal/);
assert.match(operations,/text-\[9px\] font-semibold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(operations,/2xl:grid-cols-5 lg:items-start/);
assert.match(customer,/whitespace-nowrap text-\[9px\] font-semibold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(customer,/2xl:grid-cols-5 lg:items-start/);
assert.match(operations,/stageOneLabelClassName = "block h-4 max-sm:h-auto whitespace-nowrap text-\[9px\]/);
assert.match(spot,/const textFieldClass = "block h-\[40px\] w-full max-w-\[320px\]/);
assert.match(spot,/const splitFieldClass = "block h-\[40px\]/);
assert.match(spot,/flex h-\[40px\] w-full max-w-\[320px\]/);
assert.match(spot,/text-\[9px\] font-bold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(spot,/2xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/);
assert.match(start,/h-\[34px\] w-full rounded-lg border/,"Customer Start Claim selector is full-width and 34px high.");
assert.match(operationsStart,/const inputClass = "h-\[34px\] w-full/,"Operations Start Claim entry inputs use 34px height.");
assert.match(operationsStart,/const labelClass = "mb-1 block whitespace-nowrap text-\[9px\]/);
console.log("Claim forms 320/260/122 x40 and single-line labels regression passed.");
