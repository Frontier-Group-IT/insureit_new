import type { Capability } from "../roles.ts";
import type { ApprovedKnowledgeRepository, ApprovedKnowledgeSource } from "./knowledge.ts";

const RPC_NAME = "search_approved_assistant_knowledge" as const;
const MAX_RESULTS = 5;
const capabilities = new Set<Capability>([
  "view_dashboard", "view_claims", "manage_claims", "view_intermediaries", "create_intermediary_application",
  "review_intermediary_application", "approve_intermediary_application", "activate_intermediary", "view_customers",
  "manage_customers", "view_kyc", "review_kyc", "view_employees", "manage_employees", "view_org_tree",
  "view_vehicles", "view_policies", "view_tasks", "manage_tasks", "view_reports", "view_notifications",
  "manage_users", "manage_master_data", "manage_system",
]);

type RpcResult = { data: unknown; error: { message?: string } | null };
type FixedRpcClient = { rpc(name: typeof RPC_NAME, args: { p_query: string; p_limit: number }): PromiseLike<RpcResult> };
type KnowledgeRpcRow = {
  source_id?: unknown;
  title?: unknown;
  excerpt?: unknown;
  internal_path?: unknown;
  required_capabilities?: unknown;
};

function mapRow(row: KnowledgeRpcRow): ApprovedKnowledgeSource | null {
  if (typeof row.source_id !== "string" || typeof row.title !== "string" || typeof row.excerpt !== "string") return null;
  const required = Array.isArray(row.required_capabilities)
    ? row.required_capabilities.filter((value): value is Capability => typeof value === "string" && capabilities.has(value as Capability))
    : [];
  if (Array.isArray(row.required_capabilities) && required.length !== row.required_capabilities.length) return null;
  if (row.internal_path !== undefined && row.internal_path !== null && typeof row.internal_path !== "string") return null;
  return {
    id: row.source_id,
    title: row.title,
    excerpt: row.excerpt,
    href: typeof row.internal_path === "string" ? row.internal_path : undefined,
    requiredCapabilities: required,
  };
}

export function createPostgresKnowledgeRepository(client: FixedRpcClient): ApprovedKnowledgeRepository {
  return {
    async searchApprovedActive(query, limit) {
      const boundedLimit = Math.max(1, Math.min(MAX_RESULTS, Math.trunc(limit)));
      const { data, error } = await client.rpc(RPC_NAME, { p_query: query, p_limit: boundedLimit });
      if (error) throw new Error("knowledge_search_unavailable");
      if (!Array.isArray(data)) throw new Error("knowledge_search_invalid_response");
      return data.map((row) => mapRow(row as KnowledgeRpcRow)).filter((row): row is ApprovedKnowledgeSource => row !== null).slice(0, boundedLimit);
    },
  };
}
