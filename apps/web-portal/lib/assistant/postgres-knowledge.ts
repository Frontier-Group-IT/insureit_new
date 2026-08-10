import type { Capability } from "../roles.ts";
import type { PermissionAccess } from "../permission-management.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { navigationRoutePermitted } from "../navigation-catalogue.ts";
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
type FixedRpcClient = { rpc(name: typeof RPC_NAME, args: { p_query: string; p_capability_access: Partial<Record<Capability, PermissionAccess>>; p_limit: number }): PromiseLike<RpcResult> };
type KnowledgeRpcRow = {
  source_id?: unknown;
  title?: unknown;
  excerpt?: unknown;
  internal_path?: unknown;
  required_capabilities?: unknown;
  required_access?: unknown;
  route_required_permissions?: unknown;
};

const accessRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };

function mapRow(row: KnowledgeRpcRow, permissionAccess: Partial<Record<Capability, PermissionAccess>>): ApprovedKnowledgeSource | null {
  if (typeof row.source_id !== "string" || typeof row.title !== "string" || typeof row.excerpt !== "string") return null;
  const required = Array.isArray(row.required_capabilities)
    ? row.required_capabilities.filter((value): value is Capability => typeof value === "string" && capabilities.has(value as Capability))
    : [];
  if (Array.isArray(row.required_capabilities) && required.length !== row.required_capabilities.length) return null;
  if (row.required_access !== "view" && row.required_access !== "edit" && row.required_access !== "approve") return null;
  if (!row.route_required_permissions || typeof row.route_required_permissions !== "object" || Array.isArray(row.route_required_permissions)) return null;
  const routePermissions = Object.entries(row.route_required_permissions as Record<string, unknown>);
  if (!routePermissions.length || routePermissions.some(([capability, access]) => !capabilities.has(capability as Capability) || (access !== "view" && access !== "edit" && access !== "approve"))) return null;
  if (required.some((capability) => accessRank[permissionAccess[capability] ?? "none"] < accessRank[row.required_access as PermissionAccess])) return null;
  if (row.internal_path !== undefined && row.internal_path !== null && typeof row.internal_path !== "string") return null;
  if (typeof row.internal_path === "string" && !navigationRoutePermitted(permissionAccess, row.internal_path)) return null;
  return {
    id: row.source_id,
    title: row.title,
    excerpt: row.excerpt,
    href: typeof row.internal_path === "string" ? row.internal_path : undefined,
    requiredCapabilities: required,
    requiredAccess: row.required_access,
  };
}

export function createPostgresKnowledgeRepository(
  client: FixedRpcClient,
  resolvePermissionAccess: () => Promise<Partial<Record<Capability, PermissionAccess>>>,
): ApprovedKnowledgeRepository {
  return {
    async searchApprovedActive(query, limit) {
      const boundedLimit = Math.max(1, Math.min(MAX_RESULTS, Math.trunc(limit)));
      const resolved = await resolvePermissionAccess();
      const permissionAccess = Object.fromEntries(Object.entries(resolved).filter(([capability, access]) => capabilities.has(capability as Capability) && (access === "none" || access === "view" || access === "edit" || access === "approve"))) as Partial<Record<Capability, PermissionAccess>>;
      const { data, error } = await client.rpc(RPC_NAME, { p_query: query, p_capability_access: permissionAccess, p_limit: boundedLimit });
      if (error) throw new Error("knowledge_search_unavailable");
      if (!Array.isArray(data)) throw new Error("knowledge_search_invalid_response");
      return data.map((row) => mapRow(row as KnowledgeRpcRow, permissionAccess)).filter((row): row is ApprovedKnowledgeSource => row !== null).slice(0, boundedLimit);
    },
  };
}
