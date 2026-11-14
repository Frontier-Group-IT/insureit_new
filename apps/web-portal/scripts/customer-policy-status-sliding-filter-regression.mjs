import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const page = read("app/customer/(protected)/policies/page.tsx");
const filter = read("app/customer/(protected)/policies/policy-status-sliding-filter.tsx");
const css = read("app/customer/(protected)/customer-register-motion.css");

assert.match(page, /<PolicyStatusSlidingFilter accountId=\{account.id\}/, "Policies must use the client sliding status filter");
assert.doesNotMatch(page, /<div aria-label="Policy status filter"/, "Old per-link status backgrounds must not return");
assert.match(filter, /\["all", "active", "due", "expired"\]/, "Status order and default all must remain");
assert.match(filter, /useState<PolicyStatus>\(normalized\)/, "Initial active status must reflect URL");
assert.match(filter, /setSelected\(next\)/, "Click must start visible movement before navigation");
assert.match(filter, /translateX\(\$\{currentIndex \* 100\}%\)/, "One indicator must move continuously in either direction");
assert.match(filter, /const SLIDE_MS = 1050/, "Slow slider duration must be explicit");
assert.match(filter, /router\.push\(/, "Status selection must still navigate to filtered policy rows");
assert.match(filter, /params\.set\("q", query\)/, "Search filter must remain intact");
assert.match(filter, /params\.set\("source", source\)/, "Source filter must remain intact");
assert.match(filter, /params\.set\("account", accountId\)|new URLSearchParams\(\{ account: accountId \}\)/, "Account scope must be retained");
assert.match(filter, /aria-pressed=\{selected === value\}/, "Each status retains accessible selected state");
assert.match(css, /\.policy-status-sliding-indicator[\s\S]*transition: transform 1050ms/, "Shared indicator must animate its position");
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.customer-policies-page \.policy-status-sliding-indicator[\s\S]*transition: none/, "Reduced motion must disable slider animation");
console.log("Customer Policy status slow sliding filter regression passed");
