import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/aadhaar-mask-normalizer.tsx", import.meta.url), "utf8");

assert.ok(
  source.includes('pathname.startsWith("/customers") || pathname.startsWith("/intermediaries")'),
  "Aadhaar masking should remain enabled for customer and intermediary routes.",
);

const guardIndex = source.indexOf("if (!routeCanRenderAadhaar(pathname)) return;");
const observerIndex = source.indexOf("new MutationObserver");
assert.ok(guardIndex >= 0, "Aadhaar normalizer should guard irrelevant routes.");
assert.ok(observerIndex > guardIndex, "MutationObserver must only be created after the route guard.");
assert.ok(
  !source.includes('pathname.startsWith("/policies")')
    && !source.includes('pathname.startsWith("/vehicles")')
    && !source.includes('pathname.startsWith("/claims")'),
  "Unrelated high-traffic routes should not activate Aadhaar DOM observation.",
);

console.log("Aadhaar mask observer performance regression passed.");
