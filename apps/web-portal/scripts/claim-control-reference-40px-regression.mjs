import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const operations=read("../components/claim-manager/operations-claim-stages.tsx");
const customer=read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const choice=read("../components/customer-portal/customer-claim-boolean-choice.tsx");
const spot=read("../app/customer/(protected)/spot-intimation/page.tsx");
const start=read("../components/customer-portal/customer-start-claim-selector.tsx");
const operationsStart=read("../app/claims/new/add-claim-form.tsx");

// Operations claim stage controls use the requested 34px rectangular inputs; Customer portal keeps its separate 40px design.
assert.ok(operations.includes('selected.key === "work_approval" ? "lg:grid-cols-3 xl:grid-cols-5 lg:items-start"'));
assert.ok(operations.includes('relative flex h-[34px] w-full items-center justify-between rounded-[4px]'));
assert.ok(operations.includes('flex h-[34px] cursor-pointer'));
assert.ok(operations.includes('grid h-[34px] w-full grid-cols-[1.15fr_0.85fr]'));
assert.ok(operations.includes('mt-1 h-[34px] w-full rounded-[4px]'));
assert.ok(operations.includes('min-[1440px]:grid-cols-5'));
assert.ok(operations.includes('text-[14px] font-semibold tracking-[-0.01em] text-[#071D49]">Accident'));
assert.match(customer,/selected\.key==="payment_encashment"\?"":field\.type==="date"\?"max-w-\[260px\]"/,"Stage 9 fills available grid cell; other stages retain date width.");
assert.match(customer,/"max-w-\[254px\]":"max-w-\[320px\]"/);
assert.match(customer,/className="mt-1 h-\[40px\] w-full rounded-md/);
assert.match(choice,/compact \? "gap-2" : "max-w-\[254px\] gap-\[10px\]"/,"Compact Stage 9 controls; other stages keep original sizing.");
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
assert.match(operations,/whitespace-nowrap max-sm:whitespace-normal/);
assert.match(operations,/text-\[9px\] font-semibold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(operations,/xl:grid-cols-5 lg:items-start/);
assert.match(customer,/whitespace-nowrap text-\[9px\] font-semibold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(customer,/2xl:grid-cols-5 lg:items-start/);
assert.match(operations,/stageOneLabelClassName = "block h-4 max-sm:h-auto whitespace-nowrap text-\[9px\]/);
assert.match(spot,/const textFieldClass = "block h-\[40px\] w-full max-w-\[320px\]/);
assert.match(spot,/const splitFieldClass = "block h-\[40px\]/);
assert.match(spot,/flex h-\[40px\] w-full max-w-\[320px\]/);
assert.match(spot,/text-\[9px\] font-bold uppercase leading-4 tracking-\[0\.01em\]/);
assert.match(spot,/2xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/);
assert.match(start,/h-\[40px\] w-full max-w-\[320px\] rounded-lg border/);
assert.match(operationsStart,/const inputClass = "h-10 w-full/);
assert.match(operationsStart,/const labelClass = "mb-1 block whitespace-nowrap text-\[9px\]/);
console.log("Operations 34px compact claim fields and unchanged Customer 40px field regression passed.");
