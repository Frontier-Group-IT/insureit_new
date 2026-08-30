import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cases = [
  {
    file: "../app/customers/applications/page.tsx",
    patterns: [
      /<Link\b[^>]*prefetch=\{false\}[^>]*href=\{\`\/customers\/\$\{application\.customer_id\}\/edit\`\}/s,
      /<Link\b[^>]*prefetch=\{false\}[^>]*href=\{\`\/customers\/applications\/\$\{application\.id\}\`\}/s,
    ],
  },
  {
    file: "../app/policies/external/external-policy-workspace.tsx",
    patterns: [
      /<Link\b[^>]*prefetch=\{false\}[^>]*href="\/policies\/external\/new"/s,
      /<Link\b[^>]*prefetch=\{false\}[^>]*href=\{\`\/policies\/external\/\$\{policy\.id\}\/edit\`\}/s,
    ],
  },
  {
    file: "../app/intermediaries/portal-users-workspace.tsx",
    patterns: [
      /<Link\b[^>]*prefetch=\{false\}[^>]*href=\{\`\/intermediaries\/applications\/\$\{intermediary\.application_id\}\`\}/s,
    ],
  },
];

for (const item of cases) {
  const source = await readFile(new URL(item.file, import.meta.url), "utf8");
  for (const pattern of item.patterns) {
    assert.match(source, pattern, `${item.file}: expensive workflow links must not auto-prefetch`);
  }
}

console.log("Remaining register prefetch regression passed.");
