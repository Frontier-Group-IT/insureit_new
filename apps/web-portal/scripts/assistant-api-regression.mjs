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
  requestId: "request-1",
  actor,
  messages: [{ role: "user", content: "Renew my policy" }],
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
assert.equal(auditEvents.every((event) => event.requestId === "request-1"), true, "one request id correlates tool and request audit events");

const uncitedKnowledge = await runAssistant({
  actor,
  messages: [{ role: "user", content: "Renew my policy" }],
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

const detachedCitation = await runAssistant({
  actor,
  messages: [{ role: "user", content: "Renew my policy" }],
  currentPath: "/policies",
  provider: createFakeAssistantProvider([
    { kind: "tool_calls", calls: [{ id: "detached-1", name: "search_approved_knowledge", query: "policy renewal" }] },
    { kind: "final", output: { answer: "Use an unrelated process.", links: [], citations: [{ id: "source-1", title: "Renewal guide" }] } },
  ]),
  knowledgeRepository: { async searchApprovedActive() { return [{ id: "source-1", title: "Renewal guide", excerpt: "Approved renewal steps.", requiredCapabilities: ["view_policies"] }]; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.equal(detachedCitation.code, "unsafe_provider_output", "citation IDs must be attached to the answer text");

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
assert.equal(noSourceFake.calls.length, 0, "explicit procedure questions abstain without spending provider quota when no source exists");

const deterministicKnowledgeAudit = [];
const deterministicKnowledgeProvider = createFakeAssistantProvider([]);
const deterministicKnowledge = await runAssistant({
  requestId: "request-approved-knowledge",
  actor,
  messages: [{ role: "user", content: "How can I onboard a POSP?" }],
  currentPath: "/dashboard",
  provider: deterministicKnowledgeProvider,
  knowledgeRepository: { async searchApprovedActive() { return [{ id: "posp-onboarding", title: "POSP onboarding", excerpt: "Open Add POSP and complete the approved onboarding form.", href: "/intermediaries/posp/new", requiredCapabilities: ["create_intermediary_application"], requiredAccess: "edit" }]; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write(event) { deterministicKnowledgeAudit.push(event); } },
});
assert.match(deterministicKnowledge.answer, /approved onboarding form\. \[posp-onboarding\]/);
assert.equal(deterministicKnowledge.links[0]?.href, "/intermediaries/posp/new");
assert.equal(deterministicKnowledge.citations[0]?.id, "posp-onboarding");
assert.equal(deterministicKnowledgeProvider.calls.length, 0, "approved procedure lookup is deterministic and quota-free");
assert.equal(deterministicKnowledgeAudit.some((event) => event.toolName === "search_approved_knowledge" && event.decision === "allowed"), true);

const liveCountAudit = [];
const liveCountProvider = createFakeAssistantProvider([]);
const liveCount = await runAssistant({
  requestId: "request-live-count",
  actor,
  messages: [{ role: "user", content: "How many POSP accounts are active right now?" }],
  currentPath: "/dashboard",
  provider: liveCountProvider,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: createStaticNavigationResolver([
    { label: "All POSP", href: "/intermediaries/posp", requiredCapability: "view_intermediaries" },
    { label: "Add POSP", href: "/intermediaries/posp/new", requiredCapability: "create_intermediary_application", requiredAccess: "edit" },
  ]),
  can: async () => true,
  audit: { async write(event) { liveCountAudit.push(event); } },
});
assert.match(liveCount.answer, /Live operational counts are not enabled/);
assert.equal(liveCount.links[0]?.href, "/intermediaries/posp");
assert.equal(liveCountProvider.calls.length, 0, "unsupported live counts do not call the model provider");
assert.equal(liveCountAudit.some((event) => event.errorCode === "live_operational_data_not_enabled"), true);

const greetingProvider = createFakeAssistantProvider([]);
const greeting = await runAssistant({
  requestId: "request-greeting",
  actor,
  messages: [{ role: "user", content: "Hi" }],
  currentPath: "/dashboard",
  provider: greetingProvider,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.match(greeting.answer, /Hello!/);
assert.equal(greetingProvider.calls.length, 0, "greetings do not spend provider quota");

const clarificationProvider = createFakeAssistantProvider([]);
const clarification = await runAssistant({
  requestId: "request-clarification",
  actor,
  messages: [{ role: "user", content: "POSP" }],
  currentPath: "/dashboard",
  provider: clarificationProvider,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: { async search() { return []; } },
  can: async () => true,
  audit: { async write() {} },
});
assert.match(clarification.answer, /What would you like to do with POSP/);
assert.equal(clarificationProvider.calls.length, 0, "ambiguous topics request clarification without model guessing");

const deterministicNavigationAudit = [];
const deterministicNavigationProvider = createFakeAssistantProvider([]);
const pospNavigation = createStaticNavigationResolver([
  { label: "All POSP", href: "/intermediaries/posp", requiredCapability: "view_intermediaries" },
  { label: "Add POSP", href: "/intermediaries/posp/new", requiredCapability: "create_intermediary_application", requiredAccess: "edit" },
]);
const deterministicNavigation = await runAssistant({
  requestId: "request-navigation",
  actor,
  messages: [{ role: "user", content: "Take me to POSP onboarding" }],
  currentPath: "/dashboard",
  provider: deterministicNavigationProvider,
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: pospNavigation,
  can: async () => true,
  audit: { async write(event) { deterministicNavigationAudit.push(event); } },
});
assert.equal(deterministicNavigation.links[0]?.href, "/intermediaries/posp/new");
assert.equal(deterministicNavigationProvider.calls.length, 0, "explicit navigation is deterministic and quota-free");
assert.equal(deterministicNavigationAudit.some((event) => event.toolName === "search_navigation" && event.decision === "allowed"), true);

await assert.rejects(() => runAssistant({
  actor,
  messages: [{ role: "user", content: "Where are policies?" }],
  currentPath: "/dashboard",
  provider: createFakeAssistantProvider([{ kind: "tool_calls", calls: [{ id: "audit-1", name: "search_navigation", query: "policies" }] }]),
  knowledgeRepository: { async searchApprovedActive() { return []; } },
  navigationResolver: { async search() { return [{ label: "Policies", href: "/policies", requiredCapability: "view_policies" }]; } },
  can: async () => true,
  audit: { async write() { throw new Error("audit_unavailable"); } },
}), /audit_unavailable/, "assistant access fails closed when required metadata auditing is unavailable");

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
    return { data: [{ source_id: "s1", title: "Approved", excerpt: "Safe", internal_path: "/policies/new", required_capabilities: ["view_policies"], required_access: "edit", route_required_permissions: { view_customers: "view", view_vehicles: "view", view_policies: "edit" } }], error: null };
  },
}, async () => ({ view_policies: "view" }));
assert.equal((await postgresRepository.searchApprovedActive("renewal", 99)).length, 0, "view-only access cannot receive edit-oriented knowledge");
assert.deepEqual(rpcCalls, [{ name: "search_approved_assistant_knowledge", args: { p_query: "renewal", p_capability_access: { view_policies: "view" }, p_limit: 5 } }]);

const editRepository = createPostgresKnowledgeRepository({
  async rpc() { return { data: [{ source_id: "s1", title: "Approved", excerpt: "Safe", internal_path: "/policies/new", required_capabilities: ["view_policies"], required_access: "edit", route_required_permissions: { view_customers: "view", view_vehicles: "view", view_policies: "edit" } }], error: null }; },
}, async () => ({ view_customers: "view", view_vehicles: "view", view_policies: "edit" }));
assert.equal((await editRepository.searchApprovedActive("renewal", 5)).length, 1);

const queried = [];
const repository = {
  async searchApprovedActive(query, limit) {
    queried.push({ query, limit });
    return [
      { id: "allowed", title: "Policy guide", excerpt: "Approved instructions", href: "/knowledge/policy", requiredCapabilities: ["view_policies"], requiredAccess: "edit" },
      { id: "denied", title: "Claim guide", excerpt: "Should never reach the model", href: "/knowledge/claim", requiredCapabilities: ["view_claims"], requiredAccess: "view" },
      { id: "bad-link", title: "External", excerpt: "Unsafe", href: "https://evil.example", requiredCapabilities: [], requiredAccess: "view" },
    ];
  },
};
const searched = await searchApprovedKnowledge({
  query: "policy",
  repository,
  can: async (capability, minimumAccess) => capability === "view_policies" && minimumAccess === "edit",
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

const rankedNavigation = createStaticNavigationResolver([
  { label: "All POSP", href: "/intermediaries/posp", requiredCapability: "view_intermediaries" },
  { label: "Add POSP", href: "/intermediaries/posp/new", requiredCapability: "create_intermediary_application", requiredAccess: "edit" },
]);
assert.equal((await rankedNavigation.search("create a new posp", actor))[0]?.href, "/intermediaries/posp/new", "action intent ranks creation above the register");
assert.equal((await rankedNavigation.search("show all posp", actor))[0]?.href, "/intermediaries/posp", "list intent ranks the register first");
assert.equal((await rankedNavigation.search("how many posp accounts are active right now", actor))[0]?.href, "/intermediaries/posp", "live-count wording resolves to the relevant register");

const auditRows = [];
const auditWriter = createMetadataOnlyAssistantAuditWriter({
  from(table) {
    assert.equal(table, "assistant_usage_events");
    return { async insert(row) { auditRows.push(row); return { error: null }; } };
  },
});
await auditWriter.write({
  requestId: "request-audit-1",
  actorProfileId: actor.profileId,
  capability: "use_assistant",
  eventType: "tool",
  toolName: "search_navigation",
  allowed: true,
  decision: "allowed",
  rowCount: 2,
  latencyMs: 12,
});
await auditWriter.write({
  requestId: "request-audit-2",
  actorProfileId: actor.profileId,
  capability: "use_assistant",
  eventType: "request",
  decision: "denied",
  allowed: false,
  rowCount: 0,
  latencyMs: 1,
  errorCode: "capability_denied",
});
assert.equal(auditRows.length, 2);
assert.deepEqual(Object.keys(auditRows[0]).sort(), ["actor_profile_id", "capability", "decision", "error_code", "latency_ms", "request_id", "route", "row_count", "tool_name"]);
assert.equal(auditRows[1].decision, "denied", "capability denial is not misclassified as an infrastructure error");
assert.equal(JSON.stringify(auditRows).includes("renewal policy"), false);

const routeSource = await readFile(new URL("../app/api/assistant/chat/route.ts", import.meta.url), "utf8");
assert.ok(routeSource.indexOf("const authenticated =") < routeSource.indexOf("const envelope = validateRequestEnvelope"), "envelope denials are classified after authentication");
assert.match(routeSource, /if \(!envelope\.ok\) return auditedResponse\("denied", envelope\.code/, "authenticated envelope denials require correlated auditing");
for (const required of [
  "validateRequestEnvelope", "maxBodyBytes", "getAuthenticatedProfile", "isInternalEmployeeRole",
  "use_assistant", "getEffectivePermissionAccessMap", "acquireDistributedAssistantLease", "createConfiguredAssistantProvider",
  "createPostgresKnowledgeRepository", "createMetadataOnlyAssistantAuditWriter", "Cache-Control", "no-store",
  "createPermissionAwareNavigationResolver", "capability_denied",
  "randomUUID", "requestId", "auditAuthenticatedRequest",
]) assert.equal(routeSource.includes(required), true, `route missing ${required}`);
assert.doesNotMatch(routeSource, /catch\s*\{\s*\/\* A failed audit write must not turn a denial into access/, "authenticated denial auditing must not be suppressed");
assert.match(routeSource, /createPostgresKnowledgeRepository\(admin,\s*resolvePermissionAccess\)/, "fixed knowledge RPC resolves fresh server-derived access levels for every search");
assert.match(routeSource, /getEffectivePermissionFresh\(currentProfile\.id, currentProfile\.role, capability\)/, "each tool authorization bypasses request caching");
assert.match(routeSource, /from\("profiles"\)\.select\("id,role,is_active"\)/, "each tool authorization revalidates current role and active status");
assert.doesNotMatch(routeSource, /createSupabaseWithAccessToken/, "deny-by-default knowledge tables are not queried with the browser-scoped client");
for (const forbidden of ["console.log", "console.error", "messages:", "answer:"]) {
  assert.equal(routeSource.includes(forbidden), false, `route must not log or persist content marker ${forbidden}`);
}

const navigationSource = await readFile(new URL("../lib/assistant/navigation.ts", import.meta.url), "utf8");
assert.match(navigationSource, /navigationCatalogue/, "server navigation resolver derives from the shared permission catalogue");

console.log(JSON.stringify({ cases: 49, status: "ok" }));
