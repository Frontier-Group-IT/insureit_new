import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[assistant-foundation-migration] ${message}`);
}

const migrationNames = [
  "20260810153000_assistant_knowledge_foundation.sql",
  "20260811020000_assistant_authorization_hardening.sql",
];
const sql = migrationNames.map((migrationName) => readFileSync(resolve(process.cwd(), `../../supabase/migrations/${migrationName}`), "utf8")).join("\n");
const normalized = sql.toLowerCase();

for (const table of ["assistant_knowledge_imports", "assistant_knowledge_import_rows", "assistant_knowledge_entries", "assistant_usage_events", "assistant_request_limits"]) {
  if (!normalized.includes(`create table if not exists public.${table}`)) fail(`missing ${table}`);
  if (!normalized.includes(`alter table public.${table} enable row level security`)) fail(`${table} must enable RLS`);
  if (!normalized.includes(`revoke all on table public.${table} from anon, authenticated`)) fail(`${table} must deny normal clients by default`);
}
if (normalized.includes("create policy")) fail("Phase 1 tables must not add permissive client policies");
if (!normalized.includes("tsvector") || !normalized.includes("using gin") || !normalized.includes("to_tsvector('english'")) {
  fail("knowledge entries must provide PostgreSQL full-text search with a GIN index");
}
for (const contract of ["required_capabilities", "effective_from", "effective_to", "is_revoked", "search_approved_assistant_knowledge", "websearch_to_tsquery", "security invoker", "to service_role"]) {
  if (!normalized.includes(contract)) fail(`approved knowledge search contract is missing ${contract}`);
}
for (const rpc of ["stage_assistant_knowledge_import", "transition_assistant_knowledge_entry"]) {
  if (!normalized.includes(`function public.${rpc}`) || !normalized.includes(`revoke all on function public.${rpc}`)) fail(`${rpc} must be an atomic service-only RPC`);
}
for (const rpc of ["acquire_assistant_request_lease", "release_assistant_request_lease"]) {
  if (!normalized.includes(`function public.${rpc}`)) fail(`${rpc} must provide a shared server-side request boundary`);
}
if (!normalized.includes("active_until = v_now + interval '90 seconds'")) fail("shared concurrency lease must cover the maximum bounded provider/tool runtime");
if (!normalized.includes("revoke all on function public.search_approved_assistant_knowledge") || !normalized.includes("from public, anon, authenticated")) {
  fail("approved knowledge RPC must not be executable by browser roles");
}
if (!normalized.includes("p_capability_access jsonb") || !normalized.includes("required_access")) fail("knowledge search must pre-filter rows by server-derived capability access levels");
if (!normalized.includes("route_required_permissions jsonb") || !normalized.includes("jsonb_each_text(entry.route_required_permissions)")) fail("route section, group and item floors must be filtered inside the fixed RPC");
if (!normalized.includes("cardinality(required_capabilities) > 0")) fail("knowledge rows must require at least one capability");
if (normalized.includes("security definer")) fail("approved knowledge search must not be security definer");
if (!normalized.includes("content_version integer") || !normalized.includes("unique(route, title, version)")) {
  fail("knowledge imports and entries must retain explicit content versions");
}
if (!normalized.includes("assistant_knowledge_entries_one_published_idx") || !normalized.includes("where status = 'published' and is_revoked = false")) {
  fail("only one published version may be active for a route and title");
}
for (const forbidden of ["raw_prompt", "prompt_text", "raw_answer", "answer_text", "conversation_body", "provider_payload"]) {
  if (normalized.includes(forbidden)) fail(`usage schema must not contain ${forbidden}`);
}
for (const metadataColumn of ["actor_profile_id", "capability", "decision", "tool_name", "row_count", "latency_ms", "error_code"]) {
  if (!normalized.includes(metadataColumn)) fail(`usage events are missing metadata column ${metadataColumn}`);
}
if (!normalized.includes("assistant_usage_events_request_idx") || !normalized.includes("request_id, created_at")) fail("correlated request/tool audit events require a request index");
for (const grant of [
  "grant select, insert on table public.assistant_knowledge_imports to service_role",
  "grant select, insert on table public.assistant_knowledge_import_rows to service_role",
  "grant select, insert, update on table public.assistant_knowledge_entries to service_role",
  "grant insert on table public.assistant_usage_events to service_role",
  "grant select, insert, update on table public.assistant_request_limits to service_role",
]) if (!normalized.includes(grant)) fail(`service-role minimum table privilege is missing: ${grant}`);
for (const key of ["assistant.use", "assistant.knowledge.manage"]) {
  if (!sql.includes(`('${key}'`)) fail(`shadow V2 seed is missing ${key}`);
}
if (normalized.includes("insert into public.access_role_permissions_v2")) fail("shadow V2 assistant entries must not create grants");
if (!normalized.includes("legacy permission resolution remains authoritative")) fail("migration must state the V2 non-authorization boundary");

console.log(JSON.stringify({ migrationNames, denyByDefaultTables: 5, fts: "gin", rawPromptOrAnswerColumns: 0, v2GrantRows: 0, status: "ok" }, null, 2));
