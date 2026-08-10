import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[assistant-foundation-migration] ${message}`);
}

const migrationName = "20260810153000_assistant_knowledge_foundation.sql";
const sql = readFileSync(resolve(process.cwd(), `../../supabase/migrations/${migrationName}`), "utf8");
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
if (!normalized.includes("revoke all on function public.search_approved_assistant_knowledge") || !normalized.includes("from public, anon, authenticated")) {
  fail("approved knowledge RPC must not be executable by browser roles");
}
if (!normalized.includes("p_capabilities text[]") || !normalized.includes("required_capabilities <@ coalesce(p_capabilities")) fail("knowledge search must pre-filter rows by server-derived capabilities");
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
for (const key of ["assistant.use", "assistant.knowledge.manage"]) {
  if (!sql.includes(`('${key}'`)) fail(`shadow V2 seed is missing ${key}`);
}
if (normalized.includes("insert into public.access_role_permissions_v2")) fail("shadow V2 assistant entries must not create grants");
if (!normalized.includes("legacy permission resolution remains authoritative")) fail("migration must state the V2 non-authorization boundary");

console.log(JSON.stringify({ migrationName, denyByDefaultTables: 5, fts: "gin", rawPromptOrAnswerColumns: 0, v2GrantRows: 0, status: "ok" }, null, 2));
