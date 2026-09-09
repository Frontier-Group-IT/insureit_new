import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve("app/claims/[id]/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

const removedCopy = [
  "Customer external journey",
  "Customer journey complete",
  "Customer progress",
  "Latest customer milestone",
  "Operations processing",
  "Customer completion does not auto-advance or overwrite the Operations workflow.",
];

for (const text of removedCopy) {
  if (source.includes(text)) {
    throw new Error(`Removed External Claim summary copy is still rendered: ${text}`);
  }
}

if (!source.includes("<OperationsClaimStages")) {
  throw new Error("OperationsClaimStages must remain after removing the summary section.");
}

if (!source.includes("externalCustomerFallbackRows")) {
  throw new Error("External customer milestone fallback data must remain available to Operations stages.");
}

console.log("External Claim customer journey summary removal regression passed.");
