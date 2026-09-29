import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "app/customers/customer-workspace.tsx",
  "app/vehicles/vehicle-workspace.tsx",
  "app/policies/policy-workspace.tsx",
  "app/claims/claims-workspace.tsx",
];

for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const links = source.match(/<Link\b[^>]*>/gs) ?? [];
  const expensiveWorkflowLinks = links.filter((link) =>
    /href=(?:\{\`[^\`]*(?:\/edit|\/new|\/claims\/)[^\`]*\`\}|["'][^"']*(?:\/edit|\/new)[^"']*["'])/.test(link),
  );

  assert.ok(expensiveWorkflowLinks.length > 0, `${file}: expected create/edit workflow links`);
  for (const link of expensiveWorkflowLinks) {
    assert.match(link, /prefetch=\{false\}/, `${file}: create/edit workflow links must not auto-prefetch`);
  }
}

const customerSource = await readFile(new URL("../app/customers/customer-workspace.tsx", import.meta.url), "utf8");
const kycApplicationsLink = (customerSource.match(/<Link\b[^>]*href="\/customers\/applications"[^>]*>/s) ?? [])[0];
assert.equal(kycApplicationsLink, undefined, "Customer register should not expose the removed KYC Applications link.");

console.log("Register workflow prefetch regression passed.");
