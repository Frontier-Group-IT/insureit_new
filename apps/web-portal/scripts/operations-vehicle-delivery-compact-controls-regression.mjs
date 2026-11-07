import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stages = readFileSync(fileURLToPath(new URL("../components/claim-manager/operations-claim-stages.tsx", import.meta.url)), "utf8");

assert.match(stages, /selected\.key === "vehicle_delivery" \? "h-\[34px\]" : "h-\[40px\]"/, "Vehicle Delivery Yes/Not Yet controls must be 34px while others remain unchanged");
assert.match(stages, /selected\.key === "vehicle_delivery" \? "max-w-\[335px\]" : "max-w-\[260px\]"/, "Vehicle Delivery date keeps the reference width");
assert.match(stages, /compact=\{selected\.key === "vehicle_delivery"\}/, "Compact date sizing must apply only to Vehicle Delivery");
assert.match(stages, /style=\{compact \? \{ height: 34, maxWidth: 335 \} : undefined\}/, "Vehicle Delivery date must be 34px tall");
assert.match(stages, /label=\{selected\.key === "work_approval" \? "Save & Continue" : selectedSaveOnly \? "Save Details"/, "Save Details navigation must remain unchanged");
console.log("Operations Vehicle Delivery 34px compact controls regression passed.");
