import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stages = readFileSync(fileURLToPath(new URL("../components/claim-manager/operations-claim-stages.tsx", import.meta.url)), "utf8");

assert.ok(stages.includes('flex h-[34px] cursor-pointer'), "All Operations yes/no controls use 34px including Vehicle Delivery");
assert.match(stages, /selected\.key === "vehicle_delivery" \? "" : "max-w-\[260px\]"/, "Vehicle Delivery date keeps the reference width");
assert.match(stages, /vehicleDeliveryCompact=\{selected\.key === "vehicle_delivery"\}/, "Vehicle Delivery retains its date-specific compact variant");
assert.match(stages, /vehicleDeliveryCompact \? "h-\[34px\] max-w-full px-3"/, "Vehicle Delivery date must be 34px tall");
assert.match(stages, /selected\.key === "payment_encashment" \|\| selected\.key === "delivery_order" \|\| selected\.key === "vehicle_delivery" \|\| selected\.key === "work_approval" \? "" : "max-w-\[254px\]"/, "Vehicle Received choices use full left column.");
assert.match(stages, /selected\.key === "vehicle_delivery" \? "lg:grid-cols-2"/, "Vehicle Delivery keeps two equal columns.");
assert.match(stages, /selected\.key === "spot_status" \|\| selected\.key === "delivery_order" \|\| selected\.key === "vehicle_delivery" \|\| selected\.key === "payment_encashment" \|\| selected\.key === "work_approval" \? "mt-3 flex min-h-10 flex-wrap items-center justify-end gap-2"/, "Vehicle Delivery footer has no divider.");
assert.match(stages, /label=\{selected\.key === "work_approval" \? "Save & Continue" : selectedSaveOnly \? "Save Details"/, "Save Details navigation must remain unchanged");
console.log("Operations Vehicle Delivery 34px compact controls regression passed.");
