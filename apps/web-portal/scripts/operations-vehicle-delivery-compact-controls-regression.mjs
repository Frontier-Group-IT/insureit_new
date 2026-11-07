import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stages = readFileSync(fileURLToPath(new URL("../components/claim-manager/operations-claim-stages.tsx", import.meta.url)), "utf8");

assert.match(stages, /selected\.key === "vehicle_delivery" \|\| selected\.key === "delivery_order" \|\| selected\.key === "payment_encashment" \? "h-\[34px\]" : "h-9"/, "Vehicle Delivery, DO and Payment controls use 34px without altering other stages");
assert.match(stages, /selected\.key === "vehicle_delivery" \? "max-w-\[335px\]" : "max-w-\[260px\]"/, "Vehicle Delivery date keeps the reference width");
assert.match(stages, /vehicleDeliveryCompact=\{selected\.key === "vehicle_delivery"\}/, "Compact date sizing must apply only to Vehicle Delivery");
assert.match(stages, /vehicleDeliveryCompact \? "h-\[34px\] max-w-\[335px\] px-3"/, "Vehicle Delivery date must be 34px tall");
assert.match(stages, /label=\{selected\.key === "work_approval" \? "Save & Continue" : selectedSaveOnly \? "Save Details"/, "Save Details navigation must remain unchanged");
console.log("Operations Vehicle Delivery 34px compact controls regression passed.");
