import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.join(here, "..", "app", "api", "insurer-logo", "route.ts");
const source = fs.readFileSync(routePath, "utf8");

assert.match(
  source,
  /function withoutCache\(response: NextResponse\)[\s\S]*Cache-Control", "no-store, max-age=0"/,
  "Managed insurer-logo responses must define an explicit no-store cache policy.",
);

assert.match(
  source,
  /if \(managedPath\)[\s\S]*return withoutCache\(NextResponse\.redirect\(data\.publicUrl, 307\)\)/,
  "Managed Master Data logos must bypass the name-based redirect cache after replacement.",
);

assert.match(
  source,
  /if \(staticLogo\) return withCache\(NextResponse\.redirect\(new URL\(staticLogo, request\.nextUrl\.origin\), 307\)\)/,
  "Static catalog insurer logos should retain the existing cache policy.",
);

console.log("Insurer managed-logo cache regression passed.");
