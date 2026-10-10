import fs from "node:fs";

const commercialAccess = fs.readFileSync(new URL("../lib/policy-commercial-access.ts", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");

const requiredProfiles = [
  ["dd3a036f-2cca-4a1e-b639-21fc1cc807ef", "Nishant Mishra"],
  ["1b7cb2bb-e9a3-4713-ab42-56758dab10c9", "Ragini Gupta"],
  ["8c4ec4a2-d940-4394-b484-698e9ab70a69", "Nikhil Awadhwal"],
];

for (const [id, name] of requiredProfiles) {
  if (!commercialAccess.includes(id)) throw new Error(`${name} must remain in the commercial-access allowlist.`);
}

if (!dashboard.includes("const commercial = canAccessPolicyCommercials(profile);")) {
  throw new Error("Dashboard must continue to derive commercial visibility from the server-side commercial access guard.");
}
if (!dashboard.includes("viewAccounts: accountsCapability && commercial")) {
  throw new Error("Commercial Operations dashboard access must remain gated by accounts capability plus commercial access.");
}
if (!view.includes('label: "Commercial review"')) {
  throw new Error("Needs attention must continue to expose Commercial review when commercial dashboard data exists.");
}
if (!view.includes("<CommercialOperations")) {
  throw new Error("Dashboard must continue to render Commercial Operations when commercial data is available.");
}

console.log("IT Super User commercial dashboard parity regression passed.");
