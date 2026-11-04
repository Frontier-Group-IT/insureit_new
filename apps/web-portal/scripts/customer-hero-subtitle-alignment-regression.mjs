import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(resolve(root, "app/customer/(protected)", name, "page.tsx"), "utf8");
const cases = [
  { page: "policies", icon: "/assets/Custom-Icons/optimized-128/policy.png", heading: "My ", subtitle: "All your insurance covers and documents in one place." },
  { page: "support", icon: "/assets/customer-3d-icons/support.png", heading: "Need Help?", subtitle: "Get quick support, track your requests" },
  { page: "e-challan", icon: "/assets/customer-3d-icons/e_challan.png", heading: "Check and manage your", subtitle: "View your vehicle details, challan information and take action" },
  { page: "claims", icon: "/assets/Custom-Icons/optimized-128/claims.png", heading: "Claims", subtitle: "Track and manage your claims easily." },
];

for (const { page, icon, heading, subtitle } of cases) {
  const source = read(page);
  // The opening hero row must contain the image, a nested min-width-safe text
  // column, and the heading and paragraph together within that column.
  const imageAt = source.indexOf(`src="${icon}"`);
  assert.ok(imageAt >= 0, `${page}: original icon was retained`);
  const textColumnAt = source.indexOf('<div className="min-w-0">', imageAt);
  const headingAt = source.indexOf("<h1", textColumnAt);
  const paragraphAt = source.indexOf("<p", headingAt);
  const subtitleAt = source.indexOf(subtitle, paragraphAt);
  assert.ok(textColumnAt > imageAt && headingAt > textColumnAt && paragraphAt > headingAt && subtitleAt > paragraphAt,
    `${page}: subtitle follows heading within icon-adjacent text column`);
  assert.ok(source.slice(headingAt, paragraphAt).includes(heading), `${page}: heading retained`);
  assert.ok(!source.slice(imageAt, paragraphAt).includes("</div>"), `${page}: heading stays in nested text column`);
  assert.ok(!source.slice(paragraphAt, subtitleAt).includes("</div>"), `${page}: subtitle stays in same column`);
}
const claims = read("claims");
assert.match(claims, /Stay updated at every step\.<\/span><\/p>\s*<span className="mt-3 block h-1 w-14/, "Claims accent stays beneath text");
const support = read("support");
for (const phrase of ["Quick Response", "Trusted Support", "24/7 Assistance"]) {
  assert.ok(support.includes(phrase), `Support benefit preserved: ${phrase}`);
}
for (const page of ["policies", "support", "e-challan", "claims"]) {
  assert.match(read(page), /bg-\[url\('/, `${page}: existing hero artwork preserved`);
}
console.log("Customer hero icon/heading/subtitle alignment regression passed");
