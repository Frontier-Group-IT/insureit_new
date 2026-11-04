import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const form = read("../components/policy-unified-form.tsx");
const css = read("../components/policy-form-motion.module.css");
const commercial = read("../components/policy-commercial-shell.tsx");
const edit = read("../app/policies/[id]/edit/policy-edit-standard.tsx");
const claims = read("../app/customer/(protected)/claims/[id]/stage/[stage]/customer-claim-reference.css");
assert.match(form, /import motionStyles from "\.\/policy-form-motion\.module\.css"/, "Policy form must load scoped styles");
for (const token of ["policyPage", "policyHeader", "policySection", "policyNavStep", "policyCheck", "policySummary", "policySummaryAction", "policyRing"]) {
  assert.match(form, new RegExp("motionStyles\\." + token), "Missing policy motion hook: " + token);
  assert.match(css, new RegExp("\\." + token + "\\b"), "Missing policy motion style: " + token);
}
assert.match(css, /200ms ease/, "Match Customer Claims' 200ms hover transitions");
assert.match(css, /330ms cubic-bezier/, "Match Customer Claims' completion timing");
assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)/, "Hover effects should be limited to hover-capable devices");
assert.match(css, /prefers-reduced-motion:reduce/, "Respect reduced-motion accessibility");
assert.match(css, /:is\(\.policyHeader,\.policySection,\.policyNavStep,\.policyCheck,\.policySummary,\.policySummaryAction,\.policyRing\)/, "Disable motion even on portal-mounted summary");
assert.match(claims, /transition: transform 200ms ease/, "Customer Claims timings remain reference");
assert.match(commercial, /<PolicyUnifiedForm/, "Add Policy must retain the shared form");
assert.match(edit, /PolicyCommercialShell|PolicyUnifiedForm/, "Edit Policy must retain shared form");
assert.match(form, /scrollIntoView\(\{behavior:"smooth"/, "Section navigation must retain smooth scrolling");
assert.match(form, /const calculations=/, "Financial calculations must remain in the form");
assert.match(form, /<PolicyDateApprovalDialog/, "Policy-date OTP path must remain intact");
assert.match(form, /<LiveSummary/, "Summary functionality must remain intact");
console.log("Add/Edit Policy Claims-style animation regression passed.");
