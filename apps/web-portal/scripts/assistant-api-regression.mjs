import assert from "node:assert/strict";
import { searchApprovedKnowledge } from "../lib/assistant/knowledge.ts";
import { createPostgresKnowledgeRepository } from "../lib/assistant/postgres-knowledge.ts";
import { createOpenAICompatibleProvider, AssistantProviderError } from "../lib/assistant/provider.ts";
import { createFakeAssistantProvider } from "../lib/assistant/fake-provider.ts";
import { runAssistant } from "../lib/assistant/orchestrator.ts";
import { createMetadataOnlyAssistantAuditWriter } from "../lib/assistant/audit.ts";
import { createStaticNavigationResolver } from "../lib/assistant/navigation.ts";
import { readFile } from "node:fs/promises";

const actor = { profileId: "employee-1", role: "relationship_manager" };
const auditEvents = [];
const fake = createFakeAssistantProvider([
  { kind: "tool_calls", calls: [{ id: "call-1", name: "search_approved_knowledge", query: "policy renewal" }] },
  { kind: "final", output: { answer: "Follow the approved renewal guide [source-1].", links: [{ label: "Renewal guide", href: "/knowledge/renewals" }], citations: [{ id: "source-1", title: "Renewal guide", href: "/knowledge/renewals" }] } },
]);
const orchestrated = await runAssistant({
  actor,
  messages: [{ role: "user", content: "How do I renew?" }],
  currentPath: "/dashboard",
  provider: fake,
  knowledgeRepository: { async searchApprovedActive() { return [{ id: "source-1", title: "Renewal guide", excerpt: "Open policies and review renewal.", href: "/knowledge/renewals", requiredCapabilities: ["view_policies"] }]; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write(event) { auditEvents.push(event); } },
});
assert.equal(orchestrated.answer.includes("approved renewal"), true);
assert.equal(fake.calls.length, 2);
assert.equal(fake.calls[1].messages.some((message) => message.role === "tool" && message.content.includes("untrusted_data")), true);
assert.equal(fake.calls[1].messages.some((message) => message.role === "assistant" && message.toolCalls?.[0]?.id === "call-1"), true);
assert.equal(auditEvents.some((event) => event.toolName === "search_approved_knowledge" && event.rowCount === 1), true);

const uncitedKnowledge = await runAssistant({
  actor,
  messages: [{ role: "user", content: "How do I renew?" }],
  currentPath: "/policies",
  provider: createFakeAssistantProvider([
    { kind: "tool_calls", calls: [{ id: "uncited-1", name: "search_approved_knowledge", query: "policy renewal" }] },
    { kind: "final", output: { answer: "Follow the renewal guide.", links: [], citations: [] } },
  ]),
  knowledgeRepository: { async searchApprovedActive() { return [{ id: "source-1", title: "Renewal guide", excerpt: "Approved renewal steps.", requiredCapabilities: ["view_policies"] }]; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.equal(uncitedKnowledge.code, "unsafe_provider_output", "knowledge answers require a verified citation");

const noSourceFake = createFakeAssistantProvider([{ kind: "tool_calls", calls: [{ id: "none", name: "search_approved_knowledge", query: "unknown" }] }]);
const abstained = await runAssistant({
  actor,
  messages: [{ role: "user", content: "Unknown procedure?" }],
  currentPath: "/",
  provider: noSourceFake,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.equal(abstained.code, "no_approved_source");
assert.equal(noSourceFake.calls.length, 1);

const inventedLinkFake = createFakeAssistantProvider([
  { kind: "tool_calls", calls: [{ id: "nav-1", name: "search_navigation", query: "policies" }] },
  { kind: "final", output: { answer: "Open administration.", links: [{ label: "Admin", href: "/system" }], citations: [] } },
]);
const inventedLinkResult = await runAssistant({
  actor,
  messages: [{ role: "user", content: "Where are policies?" }],
  currentPath: "/",
  provider: inventedLinkFake,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: { async search() { return [{ label: "Policies", href: "/policies", requiredCapability: "view_policies" }]; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.equal(inventedLinkResult.code, "unsafe_provider_output");

let providerRequest;
const provider = createOpenAICompatibleProvider({
  apiUrl: "https://provider.example/v1/chat/completions",
  apiKey: "server-secret",
  model: "test-model",
  fetchImpl: async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: "Use policies [1].", links: [{ label: "Policies", href: "/policies" }], citations: [{ id: "1", title: "Guide", href: "/knowledge/guide" }] }) } }] }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const providerResult = await provider.complete({ messages: [{ role: "user", content: "policy" }] });
assert.equal(providerResult.kind, "final");
assert.equal(providerRequest.model, "test-model");
assert.deepEqual(providerRequest.tools.map((tool) => tool.function.name), ["search_navigation", "search_approved_knowledge"]);

const failedProvider = createOpenAICompatibleProvider({ apiUrl: "https://provider.example", apiKey: "secret", model: "m", fetchImpl: async () => new Response("sensitive upstream body", { status: 500 }) });
await assert.rejects(() => failedProvider.complete({ messages: [] }), (error) => error instanceof AssistantProviderError && error.message === "provider_unavailable" && !error.message.includes("sensitive"));

const rpcCalls = [];
const postgresRepository = createPostgresKnowledgeRepository({
  async rpc(name, args) {
    rpcCalls.push({ name, args });
    return { data: [{ source_id: "s1", title: "Approved", excerpt: "Safe", internal_path: "/knowledge/s1", required_capabilities: ["view_policies"] }], error: null };
  },
}, ["view_policies"]);
assert.equal((await postgresRepository.searchApprovedActive("renewal", 99)).length, 1);
assert.deepEqual(rpcCalls, [{ name: "search_approved_assistant_knowledge", args: { p_query: "renewal", p_capabilities: ["view_policies"], p_limit: 5 } }]);

const queried = [];
const repository = {
  async searchApprovedActive(query, limit) {
    queried.push({ query, limit });
    return [
      { id: "allowed", title: "Policy guide", excerpt: "Approved instructions", href: "/knowledge/policy", requiredCapabilities: ["view_policies"] },
      { id: "denied", title: "Claim guide", excerpt: "Should never reach the model", href: "/knowledge/claim", requiredCapabilities: ["view_claims"] },
      { id: "bad-link", title: "External", excerpt: "Unsafe", href: "https://evil.example", requiredCapabilities: [] },
    ];
  },
};
const searched = await searchApprovedKnowledge({
  query: "policy",
  repository,
  can: async (capability) => capability === "view_policies",
});
assert.deepEqual(queried, [{ query: "policy", limit: 5 }]);
assert.deepEqual(searched.map((source) => source.id), ["allowed"]);
assert.equal(JSON.stringify(searched).includes("Should never reach"), false);

await assert.rejects(() => searchApprovedKnowledge({ query: "x".repeat(501), repository, can: async () => true }), /invalid_knowledge_query/);

const navigation = createStaticNavigationResolver([
  { label: "Policy Register", href: "/policies", requiredCapability: "view_policies", keywords: ["renewal"] },
  { label: "Unsafe", href: "https://evil.example", keywords: ["renewal"] },
]);
assert.deepEqual(await navigation.search("renewal policy", actor), [
  { label: "Policy Register", href: "/policies", requiredCapability: "view_policies" },
]);
assert.deepEqual(await navigation.search("x".repeat(501), actor), []);

const auditRows = [];
const auditWriter = createMetadataOnlyAssistantAuditWriter({
  from(table) {
    assert.equal(table, "assistant_usage_events");
    return { async insert(row) { auditRows.push(row); return { error: null }; } };
  },
});
await auditWriter.write({
  actorProfileId: actor.profileId,
  capability: "use_assistant",
  eventType: "tool",
  toolName: "search_navigation",
  allowed: true,
  rowCount: 2,
  latencyMs: 12,
});
assert.equal(auditRows.length, 1);
assert.deepEqual(Object.keys(auditRows[0]).sort(), ["actor_profile_id", "capability", "decision", "error_code", "latency_ms", "route", "row_count", "tool_name"]);
assert.equal(JSON.stringify(auditRows).includes("renewal policy"), false);

const routeSource = await readFile(new URL("../app/api/assistant/chat/route.ts", import.meta.url), "utf8");
for (const required of [
  "validateRequestEnvelope", "maxBodyBytes", "getAuthenticatedProfile", "isInternalEmployeeRole",
  "use_assistant", "getEffectivePermissionAccessMap", "assistantLimiter.acquire", "createConfiguredAssistantProvider",
  "createPostgresKnowledgeRepository", "createMetadataOnlyAssistantAuditWriter", "Cache-Control", "no-store",
  "createPermissionAwareNavigationResolver", "capability_denied",
]) assert.equal(routeSource.includes(required), true, `route missing ${required}`);
assert.match(routeSource, /createPostgresKnowledgeRepository\(admin,\s*allowedKnowledgeCapabilities\)/, "fixed knowledge RPC receives only server-derived capabilities");
assert.doesNotMatch(routeSource, /createSupabaseWithAccessToken/, "deny-by-default knowledge tables are not queried with the browser-scoped client");
for (const forbidden of ["console.log", "console.error", "messages:", "answer:"]) {
  assert.equal(routeSource.includes(forbidden), false, `route must not log or persist content marker ${forbidden}`);
}

const navigationSource = await readFile(new URL("../lib/assistant/navigation.ts", import.meta.url), "utf8");
assert.match(navigationSource, /navigationCatalogue/, "server navigation resolver derives from the shared permission catalogue");

console.log(JSON.stringify({ cases: 32, status: "ok" }));
