import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stages = readFileSync(fileURLToPath(new URL("../components/claim-manager/operations-claim-stages.tsx", import.meta.url)), "utf8");

assert.ok(stages.includes('flex h-[34px] cursor-pointer'), "All Operations yes/no controls use 34px including Vehicle Delivery");
assert.match(stages, /selected\.key === "vehicle_delivery" \? "max-w-\[335px\]" : "max-w-\[260px\]"/, "Vehicle Delivery date keeps the reference width");
assert.match(stages, /vehicleDeliveryCompact=\{selected\.key === "vehicle_delivery"\}/, "Vehicle Delivery retains its date-specific compact variant");
assert.match(stages, /vehicleDeliveryCompact \? "h-\[34px\] max-w-\[335px\] px-3"/, "Vehicle Delivery date must be 34px tall");
assert.match(stages, /label=\{selected\.key === "work_approval" \? "Save & Continue" : selectedSaveOnly \? "Save Details"/, "Save Details navigation must remain unchanged");
console.log("Operations Vehicle Delivery 34px compact controls regression passed.");
