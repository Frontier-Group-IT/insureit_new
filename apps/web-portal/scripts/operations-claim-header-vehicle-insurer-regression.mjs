import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const header = read("../components/spot-survey/spot-survey-workspace-v2.tsx");
const headerCss = read("../components/spot-survey/claim-journey-header.module.css");
const claimPage = read("../app/claims/[id]/page.tsx");
const insurerLogo = read("../lib/insurer-logo.ts");

assert.match(header, /vehicle: "\/assets\/customer-3d-icons\/brand_new_vehicle\.png"/, "Use the existing dedicated 3D vehicle artwork.");
assert.match(header, /<Info label="Vehicle No\." title=\{vehicleNumber\} logo=\{<HeaderIcon src=\{claimHeaderIcons\.vehicle\} alt="Vehicle" \/>/, "Vehicle Number shows the 3D vehicle graphic in the existing white icon container.");
assert.doesNotMatch(header, /vehicle: "\/assets\/customer-3d-icons\/my_vehicles\.png"/, "Do not return to the old multi-vehicle icon.");
assert.match(header, /import \{ CarFront \} from "lucide-react"/, "Preserve the manufacturer-logo fallback.");
assert.match(header, /<Info label="Model" title=\{model\} singleLine logo=\{<ManufacturerLogo name=\{make\} \/>\}/, "Model must stay in one line and retain manufacturer icon");
assert.doesNotMatch(header, /label="Vehicle No\. & Model"/, "Combined vehicle/model field must be removed");
assert.match(header, /lg:grid-cols-7/, "Claim header must accommodate seven fields");
assert.match(header, /items-center justify-between gap-2 border-b border-white\/20 px-3 py-2 sm:px-4/, "Exactly the title and PDF/Back action row gets the horizontal divider.");
assert.match(header, /singleLine \? "truncate whitespace-nowrap" : "break-words"/, "Only model and policy values truncate to one line.");
assert.match(header, /title=\{singleLine \? title : undefined\}/, "Hover reveals the full model or policy number.");
assert.doesNotMatch(header, /label.*border-b/, "Do not place horizontal rules beneath individual field labels.");

assert.match(headerCss, /\.field:not\(:nth-child\(7n\)\) \{ border-right: 1px solid rgba\(255, 255, 255, \.20\); \}/, "Desktop claim header has light dividers after the first six items, not the seventh");
assert.match(headerCss, /\.field:nth-child\(odd\) \{ border-right: 1px solid rgba\(255, 255, 255, \.20\); \}/, "Tablet two-column header has a separator between each pair");
assert.match(headerCss, /\.field \{[^}]*border: 0;/, "Mobile single-column header retains no dividers");
assert.doesNotMatch(headerCss, /nth-child\(5n\)/, "Header separators must match the actual seven-column grid");

assert.match(header, /<Info label="Policy No\." title=\{claim\.policies\?\.policy_no \?\? "-"\} singleLine logo=\{<InsurerLogo name=\{insurerName\} \/>\}/, "Policy number must stay in one line with insurer logo");
assert.match(header, /const insurerName = claim\.insurance_companies\?\.name/, "Insurer identity must come from the claim relation");
assert.match(header, /const src = getInsurerLogo\(name\)/, "Use canonical managed/static insurer-logo endpoint");
assert.match(header, /if \(!src\) return <HeaderIcon src=\{claimHeaderIcons\.policy\}/, "Missing insurer must retain generic policy icon");
assert.match(insurerLogo, /export function getInsurerLogo/, "Reuse existing insurer logo resolution");
assert.match(claimPage, /insurance_companies\(name, contact_email, contact_phone\)/, "Operations claim query must supply insurer name");
assert.match(claimPage, /<SpotClaimHeader/, "Same header is used by claim journey");
assert.match(header, /export function SpotClaimHeader/, "Internal and external flows share component");
// Completed PDF actions belong beside Back inside the blue Operations claim header.
assert.match(claimPage, /const allNineCompletedForPdf = !pdfMilestonesError && INTERNAL_JOURNEY_STAGES\.every/, "PDF still requires all nine persisted milestones");
assert.match(claimPage, /const claimPdfActions = allNineCompletedForPdf \? \(/, "PDF actions remain completion-gated");
assert.match(claimPage, /<SpotClaimHeader headerActions=\{claimPdfActions\}/, "Pass PDF actions into the blue claim header");
assert.doesNotMatch(claimPage, /\{claimPdfActions\}\s*<div>/, "No separate PDF action row above header");
assert.match(header, /return <InfoStrip claim=\{claim\} heading=\{heading\} headerActions=\{headerActions\}/, "Header forwards optional actions");
assert.match(header, /\{headerActions\}\s*<Link prefetch=\{false\} href="\/claims"/, "PDF controls appear immediately to the left of Back");
assert.match(claimPage, /pdfUrl \+ "\?preview=1"[^]*?target="_blank" rel="noopener noreferrer"/, "Preview link remains a new-tab action");
assert.match(claimPage, /<FileDown className="h-4 w-4" \/> Download PDF/, "Download link remains unchanged");
console.log("Operations Claim Journey vehicle/model columns and insurer icon regression passed.");
