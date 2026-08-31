import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "../components/backoffice-customer-register.tsx",
  "../components/backoffice-vehicle-register.tsx",
  "../components/backoffice-policy-register.tsx",
];

for (const path of files) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const links = source.match(/<Link\b[^>]*>/g) ?? [];
  assert.ok(links.length > 0, `${path} should contain register links.`);
  for (const link of links) {
    assert.ok(
      link.includes("prefetch={false}"),
      `${path} contains a Link that can prefetch an expensive protected route: ${link}`,
    );
  }
}

console.log("Backoffice register prefetch regression passed.");
