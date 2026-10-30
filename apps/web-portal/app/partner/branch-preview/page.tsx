import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Isolated smoke-test route; does not enable downstream legacy Partner APIs.
export default async function CanonicalBranchPreview() {
  if (process.env.INSUREIT_CANONICAL_BRANCH_PREVIEW !== "enabled") redirect("/access-denied");
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !profile.is_active || profile.role !== "intermediary") redirect("/access-denied");
  const db = await createServerSupabaseClient();
  const { data: identity, error } = await db.rpc("partner_branch_portal_identity");
  if (error || !identity || identity.portal_access_type !== "branch" || !identity.branch_id) redirect("/access-denied");
  const { data: scope, error: scopeError } = await db.rpc("partner_branch_canonical_access");
  if (scopeError || !Array.isArray(scope) || scope.length !== 1 || scope[0].branch_id !== identity.branch_id) redirect("/access-denied");
  const { data: policies, error: policyError } = await db.rpc("partner_branch_authorized_policy_ids");
  if (policyError || !Array.isArray(policies)) redirect("/access-denied");
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-5 py-10">
      <h1 className="text-2xl font-bold">Branch access verification</h1>
      <p className="text-sm text-slate-600">Limited identity check only; this does not enable the full Partner portal.</p>
      <dl className="rounded-xl border p-4">
        <dt className="text-xs font-medium text-slate-500">Your Branch</dt>
        <dd className="text-lg font-semibold">{String(identity.display_name || identity.branch_code)}</dd>
        <dt className="mt-3 text-xs font-medium text-slate-500">Authorized policies</dt>
        <dd className="text-lg font-semibold">{new Set(policies.map((row: { policy_id: string }) => row.policy_id)).size}</dd>
      </dl>
    </main>
  );
}
