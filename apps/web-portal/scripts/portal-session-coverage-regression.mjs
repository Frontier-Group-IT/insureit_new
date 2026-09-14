import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, "..");
const appRoot = path.join(portalRoot, "app");
const portalRoutesPath = path.join(portalRoot, "lib", "portal-routes.ts");
const middlewarePath = path.join(portalRoot, "middleware.ts");
const masterDataServerPath = path.join(portalRoot, "lib", "master-data-server.ts");

const portalRoutesSource = fs.readFileSync(portalRoutesPath, "utf8");
const middlewareSource = fs.readFileSync(middlewarePath, "utf8");
const masterDataServerSource = fs.readFileSync(masterDataServerPath, "utf8");

function quotedValuesBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker after: ${startMarker}`);
  return [...source.slice(start, end).matchAll(/"([^"\n]+)"/g)].map((match) => match[1]);
}

function containsPageFile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === "page.tsx") return true;
    if (entry.isDirectory() && containsPageFile(fullPath)) return true;
  }
  return false;
}

const protectedRoots = new Set(
  quotedValuesBetween(portalRoutesSource, "export const protectedPortalRoots = [", "] as const")
    .filter((value) => value.startsWith("/")),
);
const matcherEntries = quotedValuesBetween(middlewareSource, "matcher: [", "],\n};");
const matcherRoots = new Set(
  matcherEntries
    .filter((value) => value.endsWith("/:path*"))
    .map((value) => value.slice(0, -"/:path*".length)),
);

const intentionallyPublicPageRoots = new Set([
  "access-denied",
  "account-deletion",
  "forgot-password",
  "invite",
  "login",
  "privacy-policy",
  "redesign-demo",
  "reset-password",
]);

const appPageRoots = fs.readdirSync(appRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => containsPageFile(path.join(appRoot, entry.name)))
  .map((entry) => entry.name)
  .sort();

const internalPageRoots = appPageRoots
  .filter((root) => !intentionallyPublicPageRoots.has(root))
  .map((root) => `/${root}`);

const failures = [];

for (const root of internalPageRoots) {
  if (!protectedRoots.has(root)) failures.push(`${root} has an app page but is missing from protectedPortalRoots`);
  if (!matcherRoots.has(root)) failures.push(`${root} has an app page but is missing from middleware matcher session-refresh coverage`);
}

for (const root of protectedRoots) {
  if (!matcherRoots.has(root)) failures.push(`${root} is protected but is missing from middleware matcher`);
}

for (const root of matcherRoots) {
  if (!protectedRoots.has(root)) failures.push(`${root} is in middleware matcher but is not declared as a protected portal root`);
}

if (!matcherEntries.includes("/") || !matcherEntries.includes("/login")) {
  failures.push("middleware must continue covering / and /login for session bootstrap/refresh behavior");
}

if (!masterDataServerSource.includes('if (!profile) redirect("/login")')) {
  failures.push("server capability guards must distinguish a missing session from an access-denied permission result");
}

if (failures.length) {
  console.error("Portal session coverage regression failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Portal session coverage regression passed for ${internalPageRoots.length} authenticated top-level page roots.`);
console.log(`Protected roots and middleware matcher are in parity (${protectedRoots.size} roots).`);
