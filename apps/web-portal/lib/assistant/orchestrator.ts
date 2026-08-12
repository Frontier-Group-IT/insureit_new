import type { Capability } from "../roles.ts";
import type { PermissionAccess } from "../permission-management.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { searchApprovedKnowledge, type ApprovedKnowledgeRepository, type CapabilityCheck } from "./knowledge.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { validateAssistantOutput, type AssistantInputMessage, type AssistantOutput } from "./policy.ts";
import type { AssistantProvider, AssistantProviderMessage, AssistantToolCall } from "./provider.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { isOperationalSummaryQuery, type OperationalSummaryRepository } from "./operational-contract.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { ASSISTANT_SYSTEM_PROMPT } from "./constitution.ts";

const MAX_TOOL_ROUNDS = 3;
const MAX_TOOL_RESULT_CHARACTERS = 10_000;

const AMBIGUOUS_TOPICS: Record<string, string> = {
  posp: "POSP",
  misp: "MISP",
  policy: "policies",
  policies: "policies",
  claim: "claims",
  claims: "claims",
  kyc: "KYC",
  customer: "customers",
  customers: "customers",
  vehicle: "vehicles",
  vehicles: "vehicles",
  task: "tasks",
  tasks: "tasks",
};

function normalizeIntent(value: string) {
  const corrections: Record<string, string> = {
    opent: "open", opne: "open", poen: "open", cliams: "claims", cliam: "claim",
    polciy: "policy", polcies: "policies", custmer: "customer", custmers: "customers",
    vechicle: "vehicle", vechicles: "vehicles", dashbord: "dashboard", onboardng: "onboarding",
  };
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).map((word) => corrections[word] ?? word).join(" ");
}

const DOMAIN_TOPIC = /\b(posp|misp|partner|customer|policy|claim|vehicle|fleet|task|kyc|dashboard|intermediar)/;

function contextualUserQuery(messages: AssistantInputMessage[]): string {
  const userMessages = messages.filter((message) => message.role === "user");
  const latest = userMessages.at(-1)?.content.trim() ?? "";
  const normalized = normalizeIntent(latest);
  if (userMessages.length < 2 || DOMAIN_TOPIC.test(normalized)) return latest;
  if (!/\b(it|that|there|this|those|they|them|active|pending)\b/.test(normalized)) return latest;
  const previous = userMessages.at(-2)?.content.trim() ?? "";
  return previous ? `${latest} (context: ${previous})` : latest;
}

function deterministicConversation(messages: AssistantInputMessage[]): AssistantOutput | null {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const normalized = normalizeIntent(latest);
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(normalized)) {
    return {
      answer: "Hello! I can help you find permitted portal pages and explain approved INSUREIT procedures. Try “Take me to POSP onboarding” or “How do I add a policy?”",
      links: [],
      citations: [],
    };
  }
  if (/\b(what can you do|how can you help|your capabilities|what do you do|help me use this portal)\b/.test(normalized)) {
    return {
      answer: "I can open portal pages, explain approved INSUREIT workflows, answer general customer-service questions, and report live permission-scoped totals for customers, Partners, POSP, MISP, vehicles, policies, claims, and tasks. I am read-only: I do not change records, reveal restricted data, or bypass your access permissions. Try “open the POSP page”, “how do I onboard a customer?”, or “how many Group customers do I have?”",
      links: [],
      citations: [],
    };
  }
  const topic = AMBIGUOUS_TOPICS[normalized];
  if (topic) {
    return {
      answer: `What would you like to do with ${topic}? For example, ask me to open the register, create a new record, or explain an approved procedure.`,
      links: [],
      citations: [],
    };
  }
  return null;
}

function explicitNavigationQuery(messages: AssistantInputMessage[]): string | null {
  const latest = contextualUserQuery(messages);
  if (!latest || latest.length > 500) return null;
  const normalized = normalizeIntent(latest);
  if (!/\b(open|go to|take me|where is|where can i|show me|find|navigate|create|add|new|onboard|upload)\b/.test(normalized)) return null;
  if (/\b(how|what|why|explain|procedure|steps)\b/.test(normalized)) return null;
  return latest;
}

function explicitKnowledgeQuery(messages: AssistantInputMessage[]): string | null {
  const latest = contextualUserQuery(messages);
  if (!latest || latest.length > 500) return null;
  const normalized = normalizeIntent(latest);
  if (!/\b(how|what|why|explain|procedure|steps|guide|know|password|login|renewal|coverage|document|replacement|support|customer service|help with)\b/.test(normalized)) return null;
  if (/\b(how many|count|total|right now|currently active|currently pending)\b/.test(normalized)) return null;
  return latest;
}

function liveOperationalQuery(messages: AssistantInputMessage[]): string | null {
  const latest = contextualUserQuery(messages);
  if (!latest || latest.length > 500) return null;
  const normalized = normalizeIntent(latest);
  if (/\b(open|go to|take me|navigate)\b/.test(normalized) && !/\b(how many|count|total|currently|active|inactive|pending|overdue|expired|expiring|overview|summary)\b/.test(normalized)) return null;
  return isOperationalSummaryQuery(latest) ? latest : null;
}

export type AssistantActor = { profileId: string; role: string };
export type NavigationCandidate = { label: string; href: string; requiredCapability?: Capability; requiredAccess?: Exclude<PermissionAccess, "none"> };
export interface NavigationResolver {
  search(query: string, actor: AssistantActor): Promise<NavigationCandidate[]>;
  diagnose?(query: string, actor: AssistantActor): Promise<NavigationAccessDiagnostic | null>;
}
export type NavigationAccessDiagnostic = {
  label: string;
  href: string;
  visible: boolean;
  requiredAccess?: Exclude<PermissionAccess, "none">;
  permissionLabel?: string;
  alternatives: NavigationCandidate[];
};

export type AssistantAuditEvent = {
  requestId: string;
  actorProfileId: string;
  capability: "use_assistant";
  eventType: "tool" | "request";
  toolName?: "search_navigation" | "search_approved_knowledge" | "get_operational_summary";
  allowed: boolean;
  decision: "allowed" | "denied" | "error";
  rowCount: number;
  latencyMs: number;
  errorCode?: string;
  route?: string;
};
export interface AssistantUsageAuditWriter { write(event: AssistantAuditEvent): Promise<void> }

export type AssistantRunResult = AssistantOutput & { code?: "no_approved_source" | "no_approved_destination" | "unsafe_provider_output" | "tool_budget_exceeded" };

function asksWhyNavigationIsMissing(messages: AssistantInputMessage[]) {
  const latest = contextualUserQuery(messages);
  const normalized = normalizeIntent(latest);
  return /\b(why|cant|cannot|dont|missing|not showing|not visible)\b/.test(normalized)
    && /\b(menu|button|option|page|navigation|sidebar)\b/.test(normalized);
}

function isGeneralCustomerSupportQuery(messages: AssistantInputMessage[]) {
  const latest = contextualUserQuery(messages);
  const normalized = normalizeIntent(latest);
  return /\b(insurance|policy|premium|coverage|claim|accident|renewal|document|customer|support|deductible|excess|nominee|endorsement|refund|cancellation)\b/.test(normalized);
}
function abstention(code: NonNullable<AssistantRunResult["code"]>, answer: string): AssistantRunResult {
  return { code, answer, links: [], citations: [] };
}

function safeNavigation(candidate: NavigationCandidate): boolean {
  return Boolean(candidate.label && candidate.href.startsWith("/") && !candidate.href.startsWith("//") && !/[\\\r\n]/.test(candidate.href));
}

async function auditRequired(writer: AssistantUsageAuditWriter, event: AssistantAuditEvent): Promise<void> {
  await writer.write(event);
}

export async function runAssistant(input: {
  requestId: string;
  actor: AssistantActor;
  messages: AssistantInputMessage[];
  currentPath: string;
  provider: AssistantProvider;
  knowledgeRepository: ApprovedKnowledgeRepository;
  navigationResolver: NavigationResolver;
  operationalRepository?: OperationalSummaryRepository;
  can: CapabilityCheck;
  audit: AssistantUsageAuditWriter;
}): Promise<AssistantRunResult> {
  const startedAt = Date.now();
  const providerMessages: AssistantProviderMessage[] = [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
    { role: "system", content: `Current internal path: ${input.currentPath}` },
    ...input.messages,
  ];
  const sourceById = new Map<string, { title: string; href?: string }>();
  const allowedHrefs = new Set<string>();
  let toolCharacters = 0;
  let usedTool = false;
  const allowGeneralAnswer = isGeneralCustomerSupportQuery(input.messages);
  let requestErrorCode: string | undefined;
  let requestDecision: AssistantAuditEvent["decision"] = "allowed";
  const fail = (code: NonNullable<AssistantRunResult["code"]>, answer: string) => {
    requestErrorCode = code;
    requestDecision = "denied";
    return abstention(code, answer);
  };

  try {
    const conversational = deterministicConversation(input.messages);
    if (conversational) return conversational;

    if (asksWhyNavigationIsMissing(input.messages) && input.navigationResolver.diagnose) {
      const diagnostic = await input.navigationResolver.diagnose(contextualUserQuery(input.messages), input.actor);
      if (diagnostic) {
        const links = diagnostic.alternatives.filter(safeNavigation).slice(0, 3).map(({ label, href }) => ({ label, href }));
        if (!diagnostic.visible) {
          const requirement = diagnostic.permissionLabel
            ? `${diagnostic.permissionLabel}${diagnostic.requiredAccess ? ` (${diagnostic.requiredAccess} access)` : ""}`
            : `${diagnostic.requiredAccess ?? "additional"} access`;
          return {
            answer: `${diagnostic.label} is hidden because your current account does not have the required ${requirement}. The portal only displays actions your effective role and employee permissions allow. You can use the available register, or ask an administrator to review your access if creating this record is part of your job.`,
            links,
            citations: [],
          };
        }
        return {
          answer: `Your current permissions allow ${diagnostic.label}, so it should be available. Refresh the page or sign in again to refresh your permission session. If it is still missing, ask an administrator to check your employee-specific permission override.`,
          links: [{ label: diagnostic.label, href: diagnostic.href }, ...links.filter((link) => link.href !== diagnostic.href)].slice(0, 3),
          citations: [],
        };
      }
    }

    const liveQuery = liveOperationalQuery(input.messages);
    if (liveQuery) {
      if (!input.operationalRepository) return fail("no_approved_source", "Live operational data is not available in this environment.");
      const toolStartedAt = Date.now();
      const summary = await input.operationalRepository.summarize(liveQuery);
      const candidates = await searchAllowedNavigation(liveQuery, input);
      await auditRequired(input.audit, {
        requestId: input.requestId,
        actorProfileId: input.actor.profileId,
        capability: "use_assistant",
        eventType: "tool",
        toolName: "get_operational_summary",
        allowed: summary.metrics.length > 0,
        decision: summary.metrics.length > 0 ? "allowed" : "denied",
        rowCount: summary.metrics.length,
        latencyMs: Date.now() - toolStartedAt,
        errorCode: summary.metrics.length > 0 ? undefined : "no_permitted_operational_metric",
        route: input.currentPath,
      });
      if (!summary.metrics.length) return fail("no_approved_source", "I couldn't find a permitted live metric for that request.");
      return {
        answer: formatOperationalAnswer(summary),
        links: operationalLinks(summary, candidates),
        citations: [],
      };
    }

    const navigationQuery = explicitNavigationQuery(input.messages);
    if (navigationQuery) {
      const toolStartedAt = Date.now();
      const candidates = await searchAllowedNavigation(navigationQuery, input);
      await auditRequired(input.audit, {
        requestId: input.requestId,
        actorProfileId: input.actor.profileId,
        capability: "use_assistant",
        eventType: "tool",
        toolName: "search_navigation",
        allowed: candidates.length > 0,
        decision: candidates.length > 0 ? "allowed" : "denied",
        rowCount: candidates.length,
        latencyMs: Date.now() - toolStartedAt,
        errorCode: candidates.length > 0 ? undefined : "no_approved_destination",
        route: input.currentPath,
      });
      if (!candidates.length) return fail("no_approved_destination", "I couldn't find a permitted portal destination for that request.");
      const primary = candidates[0];
      return {
        answer: `Open ${primary.label}.`,
        links: candidates.slice(0, 3).map(({ label, href }) => ({ label, href })),
        citations: [],
      };
    }

    const knowledgeQuery = explicitKnowledgeQuery(input.messages);
    if (knowledgeQuery) {
      const toolStartedAt = Date.now();
      const sources = await searchApprovedKnowledge({ query: knowledgeQuery, repository: input.knowledgeRepository, can: input.can });
      await auditRequired(input.audit, {
        requestId: input.requestId,
        actorProfileId: input.actor.profileId,
        capability: "use_assistant",
        eventType: "tool",
        toolName: "search_approved_knowledge",
        allowed: sources.length > 0,
        decision: sources.length > 0 ? "allowed" : "denied",
        rowCount: sources.length,
        latencyMs: Date.now() - toolStartedAt,
        errorCode: sources.length > 0 ? undefined : "no_approved_source",
        route: input.currentPath,
      });
      if (!sources.length && !allowGeneralAnswer) return fail("no_approved_source", "I couldn't find an approved source for that request. Please use the relevant portal module or ask an authorised colleague.");
      if (sources.length) {
        const destinations = await searchAllowedNavigation(knowledgeQuery, input);
        for (const source of sources) {
          sourceById.set(source.id, { title: source.title, href: source.href });
          if (source.href) allowedHrefs.add(source.href);
        }
        for (const destination of destinations) allowedHrefs.add(destination.href);
        usedTool = true;
        providerMessages.push({ role: "system", content: JSON.stringify({ untrusted_data: true, approved_sources: sources, permitted_destinations: destinations }) });
      }
    }

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const result = await input.provider.complete({ messages: providerMessages });
      if (result.kind === "final") {
        if (!usedTool && !allowGeneralAnswer) return fail("no_approved_source", "I couldn't find an approved source for that request. Please use the relevant portal module or ask an authorised colleague.");
        const validated = validateAssistantOutput(result.output);
        if (!validated.ok) return fail("unsafe_provider_output", "I couldn't safely verify that response. Please use the relevant portal module.");
        if (!usedTool && (validated.value.links.length || validated.value.citations.length)) {
          return fail("unsafe_provider_output", "I couldn't safely verify that response. Please use the relevant portal module.");
        }
        if (sourceById.size > 0 && validated.value.citations.length === 0) {
          return fail("unsafe_provider_output", "I couldn't safely verify that response. Please use the relevant portal module.");
        }
        for (const citation of validated.value.citations) {
          const source = sourceById.get(citation.id);
          if (!source || source.title !== citation.title || (citation.href !== undefined && citation.href !== source.href)) {
            return fail("unsafe_provider_output", "I couldn't safely verify that response. Please use the relevant portal module.");
          }
        }
        for (const link of validated.value.links) {
          if (!allowedHrefs.has(link.href)) {
            return fail("unsafe_provider_output", "I couldn't safely verify that response. Please use the relevant portal module.");
          }
        }
        return validated.value;
      }
      if (round === MAX_TOOL_ROUNDS) return fail("tool_budget_exceeded", "I couldn't complete that request within the safe lookup limit.");
      usedTool = true;
      providerMessages.push({ role: "assistant", content: "", toolCalls: result.calls });
      for (const call of result.calls) {
        const toolStartedAt = Date.now();
        let toolResult: Awaited<ReturnType<typeof executeTool>>;
        try {
          toolResult = await executeTool(call, input, sourceById, allowedHrefs);
        } catch {
          await auditRequired(input.audit, {
            requestId: input.requestId,
            actorProfileId: input.actor.profileId,
            capability: "use_assistant",
            eventType: "tool",
            toolName: call.name,
            allowed: false,
            decision: "error",
            rowCount: 0,
            latencyMs: Date.now() - toolStartedAt,
            errorCode: "tool_failed",
            route: input.currentPath,
          });
          throw new Error("assistant_tool_unavailable");
        }
        await auditRequired(input.audit, {
          requestId: input.requestId,
          actorProfileId: input.actor.profileId,
          capability: "use_assistant",
          eventType: "tool",
          toolName: call.name,
          allowed: toolResult.allowed,
          decision: toolResult.allowed ? "allowed" : "denied",
          rowCount: toolResult.rowCount,
          latencyMs: Date.now() - toolStartedAt,
          errorCode: toolResult.errorCode,
          route: input.currentPath,
        });
        if (call.name === "search_approved_knowledge" && toolResult.rowCount === 0) {
          return fail("no_approved_source", "I couldn't find an approved source for that request. Please use the relevant portal module or ask an authorised colleague.");
        }
        if (call.name === "search_navigation" && toolResult.rowCount === 0) {
          return fail("no_approved_destination", "I couldn't find an approved portal destination for that request.");
        }
        toolCharacters += toolResult.content.length;
        if (toolCharacters > MAX_TOOL_RESULT_CHARACTERS) return fail("tool_budget_exceeded", "I couldn't complete that request within the safe lookup limit.");
        providerMessages.push({ role: "tool", toolCallId: call.id, content: toolResult.content });
      }
    }
    return fail("tool_budget_exceeded", "I couldn't complete that request within the safe lookup limit.");
  } catch (error) {
    requestErrorCode = "assistant_request_failed";
    requestDecision = "error";
    throw error;
  } finally {
    await auditRequired(input.audit, { requestId: input.requestId, actorProfileId: input.actor.profileId, capability: "use_assistant", eventType: "request", allowed: requestDecision === "allowed", decision: requestDecision, rowCount: 0, latencyMs: Date.now() - startedAt, errorCode: requestErrorCode, route: input.currentPath });
  }
}

async function executeTool(
  call: AssistantToolCall,
  input: Parameters<typeof runAssistant>[0],
  sourceById: Map<string, { title: string; href?: string }>,
  allowedHrefs: Set<string>,
): Promise<{ allowed: boolean; rowCount: number; content: string; errorCode?: string }> {
  if (call.name === "search_approved_knowledge") {
    const sources = await searchApprovedKnowledge({ query: call.query, repository: input.knowledgeRepository, can: input.can });
    for (const source of sources) {
      sourceById.set(source.id, { title: source.title, href: source.href });
      if (source.href) allowedHrefs.add(source.href);
    }
    return { allowed: true, rowCount: sources.length, content: JSON.stringify({ untrusted_data: true, sources }) };
  }
  if (call.name === "search_navigation") {
    const allowed = await searchAllowedNavigation(call.query, input);
    for (const candidate of allowed) allowedHrefs.add(candidate.href);
    return { allowed: true, rowCount: allowed.length, content: JSON.stringify({ untrusted_data: true, destinations: allowed }) };
  }
  if (call.name === "get_operational_summary") {
    if (!input.operationalRepository) return { allowed: false, rowCount: 0, content: JSON.stringify({ untrusted_data: true, error: "operational_data_unavailable" }), errorCode: "operational_data_unavailable" };
    const summary = await input.operationalRepository.summarize(call.query);
    for (const item of summary.metrics) allowedHrefs.add(item.href);
    return { allowed: true, rowCount: summary.metrics.length, content: JSON.stringify({ untrusted_data: true, operational_summary: summary }) };
  }
  return { allowed: false, rowCount: 0, content: JSON.stringify({ untrusted_data: true, error: "tool_not_allowed" }), errorCode: "tool_not_allowed" };
}

async function searchAllowedNavigation(query: string, input: Parameters<typeof runAssistant>[0]): Promise<NavigationCandidate[]> {
  const candidates = (await input.navigationResolver.search(query, input.actor)).slice(0, 8);
  const allowed: NavigationCandidate[] = [];
  for (const candidate of candidates) {
    if (!safeNavigation(candidate)) continue;
    if (candidate.requiredCapability && !(await input.can(candidate.requiredCapability, candidate.requiredAccess))) continue;
    allowed.push(candidate);
  }
  return allowed;
}

function formatOperationalAnswer(summary: Awaited<ReturnType<OperationalSummaryRepository["summarize"]>>) {
  const facts = summary.metrics.map((item) => `${item.label}: ${item.value.toLocaleString("en-IN")}`).join("; ");
  const scope = summary.scope === "organization" ? "organization-wide" : "limited to records assigned or visible to you";
  return `${facts}. This is live data as of ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(summary.asOf))}, ${scope}.`;
}

function operationalLinks(summary: Awaited<ReturnType<OperationalSummaryRepository["summarize"]>>, candidates: NavigationCandidate[]) {
  const links = [...summary.metrics.map((item) => ({ label: item.label, href: item.href })), ...candidates.map(({ label, href }) => ({ label, href }))];
  return Array.from(new Map(links.map((item) => [item.href, item])).values()).slice(0, 3);
}
