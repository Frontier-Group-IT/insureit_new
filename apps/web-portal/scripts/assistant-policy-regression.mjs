import assert from "node:assert/strict";
import {
  isInternalEmployeeRole,
  validateAssistantOutput,
  validateAssistantRequest,
  validateRequestEnvelope,
} from "../lib/assistant/policy.ts";
import { acquireDistributedAssistantLease, createInMemoryAssistantLimiter } from "../lib/assistant/limits.ts";

let now = 1_000;
const limiter = createInMemoryAssistantLimiter({ maxRequests: 2, windowMs: 1_000, maxConcurrent: 1, now: () => now });
const firstLease = limiter.acquire("employee-1");
assert.equal(firstLease.ok, true);
assert.deepEqual(limiter.acquire("employee-1"), { ok: false, reason: "concurrency" });
if (firstLease.ok) firstLease.release();
const secondLease = limiter.acquire("employee-1");
assert.equal(secondLease.ok, true);
if (secondLease.ok) secondLease.release();
assert.deepEqual(limiter.acquire("employee-1"), { ok: false, reason: "rate" });
now += 1_001;
assert.equal(limiter.acquire("employee-1").ok, true);

const distributedCalls = [];
const distributedLease = await acquireDistributedAssistantLease({
  async rpc(name, args) {
    distributedCalls.push({ name, args });
    return name === "acquire_assistant_request_lease"
      ? { data: [{ status: "allowed", lease_id: "11111111-1111-4111-8111-111111111111" }], error: null }
      : { data: true, error: null };
  },
}, "employee-1");
assert.equal(distributedLease.ok, true);
if (distributedLease.ok) await distributedLease.release();
assert.deepEqual(distributedCalls.map((call) => call.name), ["acquire_assistant_request_lease", "release_assistant_request_lease"]);

const valid = validateAssistantRequest({
  messages: [{ role: "user", content: "Where can I find active policies?" }],
  currentPath: "/dashboard",
});
assert.equal(valid.ok, true);

const oversized = validateAssistantRequest({
  messages: [{ role: "user", content: "x".repeat(4001) }],
  currentPath: "/dashboard",
});
assert.deepEqual(oversized, { ok: false, code: "message_too_large" });

assert.equal(isInternalEmployeeRole("relationship_manager"), true);
assert.equal(isInternalEmployeeRole("customer"), false);
assert.equal(isInternalEmployeeRole("intermediary"), false);

const originRequest = (headers) => new Request("https://portal.insureit.in/api/assistant/chat", {
  method: "POST",
  headers,
  body: JSON.stringify({ messages: [{ role: "user", content: "hello" }], currentPath: "/" }),
});
assert.deepEqual(validateRequestEnvelope(originRequest({ origin: "https://evil.example", "content-type": "application/json" })), { ok: false, status: 403, code: "cross_origin" });
assert.deepEqual(validateRequestEnvelope(originRequest({ origin: "https://portal.insureit.in", "content-type": "text/plain" })), { ok: false, status: 415, code: "unsupported_media_type" });
assert.equal(validateRequestEnvelope(originRequest({ origin: "https://portal.insureit.in", "content-type": "application/json; charset=utf-8" })).ok, true);
assert.deepEqual(validateRequestEnvelope(originRequest({ origin: "https://portal.insureit.in", "content-type": "application/jsonx" })), { ok: false, status: 415, code: "unsupported_media_type" });

const safeOutput = validateAssistantOutput({
  answer: "Open the policy register [1].",
  links: [{ label: "Policies", href: "/policies" }],
  citations: [{ id: "1", title: "Policy guide", href: "/knowledge/policy-guide" }],
});
assert.equal(safeOutput.ok, true);
assert.deepEqual(validateAssistantOutput({ answer: "External", links: [{ label: "Bad", href: "https://evil.example" }], citations: [] }), { ok: false, code: "unsafe_output" });
assert.deepEqual(validateAssistantOutput({ answer: "Unsupported [9]", links: [], citations: [] }), { ok: false, code: "unsafe_output" });
assert.deepEqual(validateAssistantOutput({ answer: "x".repeat(8_001), links: [], citations: [] }), { ok: false, code: "unsafe_output" });

console.log(JSON.stringify({ cases: 20, status: "ok" }));
