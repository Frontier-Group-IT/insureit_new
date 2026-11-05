import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const register = read("../app/customer/(protected)/renewals/customer-renewals-register.tsx");
const motion = read("../app/customer/(protected)/renewals/renewals-motion.module.css");

// Category cards always use a clean white surface; alerts remain in their count badges.
assert.ok(register.includes("const cardTone = selected"), "Card tone must depend on selection, not alert counts");
assert.ok(register.includes('border-[#6050E5] bg-white shadow-sm hover:bg-[#F8FAFF]'), "Selected category remains white with a purple outline");
assert.ok(register.includes('border-[#E2E9F5] bg-white hover:bg-[#F7F8FF]'), "Unselected category remains white");
for (const tone of ['bg-[#FFF0F3]', 'bg-[#FFF3F5]', 'bg-[#FFEDF1]', 'bg-[#FFECEF]']) {
  assert.ok(!register.includes(tone), "Old pink/red card fill must not return: " + tone);
}
assert.match(register, /aria-pressed=\{selected\}/);
assert.match(register, /\$\{cardTone\}/);

// Category badges remain number-only, with no added text within either span.
assert.match(register, />\{cat\.due\}<\/span>/);
assert.match(register, />\{cat\.expired\}<\/span>/);
assert.match(register, /cat\.due > 0 \?/);
assert.match(register, /cat\.expired > 0 \?/);
assert.match(register, /role="group" aria-label="Renewal categories"/);

// The table and its renewal status copy must remain unchanged.
assert.match(register, /Due in \$\{item\.daysUntil\} days/);
assert.match(register, /<table className=/);
assert.match(register, /status==="expired"\?item\.daysUntil<0/);

// Keep the count pulse calm and accessible, with motion disabled when requested.
assert.match(motion, /@keyframes countGlowDue/);
assert.match(motion, /@keyframes countGlowExpired/);
assert.match(motion, /transform: scale\(1\.035\)/);
assert.doesNotMatch(motion, /scale\(1\.14\)/);
assert.match(motion, /countPulseDue \{ animation: countGlowDue 2\.6s/);
assert.match(motion, /countPulseExpired \{ animation: countGlowExpired 2\.6s/);
assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(motion, /\.countPulseDue, \.countPulseExpired \{ animation: none !important; \}/);
console.log("Customer Renewals white summary cards and count-only alert badges regression passed.");
