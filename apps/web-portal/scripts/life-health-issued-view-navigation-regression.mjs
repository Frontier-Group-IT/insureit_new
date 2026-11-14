import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const button = read("../components/life-health-issued-policy-button.tsx");
const register = read("../components/life-health-case-register.tsx");
const detail = read("../components/life-health-case-detail.tsx");
const edit = read("../app/policies/[id]/edit/page.tsx");

assert.match(register, /<LifeHealthIssuedPolicyButton policyId=\{row\.finalPolicyId\}/, "Issued cases must pass the linked policy ID to the View control.");
assert.match(button, /policyId \}: \{ policyId: string \}/, "View popup must use the actual linked policy ID.");
assert.match(button, /href=\{\`\/policies\/\$\{encodeURIComponent\(policyId\)\}\/edit\`\}/, "View Policy must open the exact issued policy editor.");
assert.doesNotMatch(button, /<Link href="\/policies"/, "View Policy must not redirect to general Policy Register.");
assert.match(button, /import \{ createPortal \} from "react-dom"/, "Issued policy popup must use a document-level portal.");
assert.match(button, /open && typeof document !== "undefined" \? createPortal\(/, "Popup must be rendered in a portal only when open.");
assert.match(button, /document\.body\)/, "Modal must escape table and scroll container positioning.");
assert.match(button, /fixed inset-0 z-\[1000\] flex min-h-\[100dvh\] items-center justify-center/, "Popup backdrop must center in the visible viewport.");
assert.match(button, /max-h-\[calc\(100dvh-32px\)\] overflow-y-auto/, "Popup must fit within short viewports.");
assert.match(button, /onClick=\{\(\) => setOpen\(false\)\}/, "Original Close interaction remains.");
assert.match(button, /onMouseDown=\{\(event\) => \{ if \(event\.currentTarget === event\.target\) setOpen\(false\); \}\}/, "Backdrop dismiss interaction remains.");

assert.match(detail, /href=\{\`\/policies\/\$\{encodeURIComponent\(caseData\.finalPolicyId\)\}\/edit\`\}>View issued policy/, "Issued case read-only details must link to the exact issued policy editor.");
assert.match(edit, /requirePolicyEditor\(resolvedParams\.id\)/, "Editor authorization must remain enforced.");
assert.match(edit, /life_health_cases/, "Life and Health issued policies must retain the dedicated edit form.");
console.log("Issued Life/Health case View Policy direct editor regression passed.");
