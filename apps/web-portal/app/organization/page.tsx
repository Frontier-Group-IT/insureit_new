import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canViewOrganizationTree, roleLabels } from "@/lib/roles";

type OrgProfile = {
  id: string;
  full_name: string;
  role: keyof typeof roleLabels;
  email: string | null;
  phone: string | null;
  employee_code: string | null;
  reporting_manager_id: string | null;
  is_active: boolean;
};

type OrgNode = OrgProfile & { children: OrgNode[] };

export default async function OrganizationPage() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canViewOrganizationTree(profile?.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, phone, employee_code, reporting_manager_id, is_active")
    .order("full_name")
    .returns<OrgProfile[]>();

  const tree = buildTree(data ?? [], profile?.id ?? null);

  return (
    <AppShell title="Organization">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy-900">Organization Tree</h1>
        <p className="mt-2 text-sm text-slate-600">Showing the hierarchy available to your role.</p>
      </div>
      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error.message}</div>
      ) : (
        <div className="space-y-3">
          {tree.length ? tree.map((node) => <OrgCard key={node.id} node={node} depth={0} />) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No organization users found.</div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function buildTree(rows: OrgProfile[], viewerId: string | null) {
  const nodes = new Map<string, OrgNode>();
  rows.forEach((row) => nodes.set(row.id, { ...row, children: [] }));

  const roots: OrgNode[] = [];
  nodes.forEach((node) => {
    const parent = node.reporting_manager_id ? nodes.get(node.reporting_manager_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const viewerNode = viewerId ? nodes.get(viewerId) : null;
  if (viewerNode && viewerNode.children.length) return [viewerNode];
  return roots;
}

function OrgCard({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft" style={{ marginLeft: depth ? Math.min(depth * 20, 60) : 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-navy-900">{node.full_name}</p>
          <p className="text-xs text-slate-500">{roleLabels[node.role] ?? node.role} {node.employee_code ? `- ${node.employee_code}` : ""}</p>
          <p className="text-xs text-slate-500">{node.email ?? node.phone ?? "No contact saved"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{node.children.length} direct</span>
          <StatusBadge status={node.is_active ? "Active" : "Closed"} />
        </div>
      </div>
      {node.children.length ? (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => <OrgCard key={child.id} node={child} depth={depth + 1} />)}
        </div>
      ) : null}
    </div>
  );
}
