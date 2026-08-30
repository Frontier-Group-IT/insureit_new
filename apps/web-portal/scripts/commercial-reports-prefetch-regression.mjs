import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const file of [
  "../app/policies/commercial-review/commercial-review-client.tsx",
  "../app/reports/page.tsx",
  "../app/accounts/page.tsx",
  "../components/reports/report-navigation.tsx",
]) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const links = source.match(/<Link\b[^>]*>/gs) ?? [];
  assert.ok(links.length > 0, `${file}: expected navigation links`);
  for (const link of links) {
    assert.match(
      link,
      /prefetch=\{false\}/,
      `${file}: heavy authenticated navigation must not auto-prefetch`,
    );
  }
}

console.log("Commercial/reports prefetch regression passed.");
