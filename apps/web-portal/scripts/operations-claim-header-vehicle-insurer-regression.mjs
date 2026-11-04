import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const header = read("../components/spot-survey/spot-survey-workspace-v2.tsx");
const claimPage = read("../app/claims/[id]/page.tsx");
const insurerLogo = read("../lib/insurer-logo.ts");

assert.match(header, /<Info label="Vehicle No\." title=\{vehicleNumber\}/, "Vehicle number must have its own field");
assert.match(header, /<Info label="Model" title=\{model\} logo=\{<ManufacturerLogo name=\{make\} \/>\}/, "Model must be separate and retain manufacturer icon");
assert.doesNotMatch(header, /label="Vehicle No\. & Model"/, "Combined vehicle/model field must be removed");
assert.match(header, /lg:grid-cols-7/, "Claim header must accommodate seven fields");
assert.match(header, /<Info label="Policy No\." title=\{claim\.policies\?\.policy_no \?\? "-"\} logo=\{<InsurerLogo name=\{insurerName\} \/>\}/, "Policy number must show insurer logo");
assert.match(header, /const insurerName = claim\.insurance_companies\?\.name/, "Insurer identity must come from the claim relation");
assert.match(header, /const src = getInsurerLogo\(name\)/, "Use canonical managed/static insurer-logo endpoint");
assert.match(header, /if \(!src\) return <HeaderIcon src=\{claimHeaderIcons\.policy\}/, "Missing insurer must retain generic policy icon");
assert.match(insurerLogo, /export function getInsurerLogo/, "Reuse existing insurer logo resolution");
assert.match(claimPage, /insurance_companies\(name, contact_email, contact_phone\)/, "Operations claim query must supply insurer name");
assert.match(claimPage, /<SpotClaimHeader/, "Same header is used by claim journey");
assert.match(header, /export function SpotClaimHeader/, "Internal and external flows share component");
console.log("Operations Claim Journey vehicle/model columns and insurer icon regression passed.");
