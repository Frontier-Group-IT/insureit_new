import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { IntermediaryPortalUsersWorkspace } from "../portal-users-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Account = {
  id: string;
  intermediary_id: string;
  application_id: string | null;
  email: string;
  status: string;
  invited_at: string | null;
  created_at: string;
};

type Intermediary = {
  id: string;
  display_name: string;
  intermediary_code: string | null;
  intermediary_type: string;
  portal_access_status: string;
  email: string | null;
  application_id: string | null;
  updated_at: string;
};

export type PortalUserRow = {
  intermediary: Intermediary;
  account: Account | null;
};

type StatusFilter = "all" | "active" | "inactive";

export default async function IntermediaryPortalUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requirePospMispManager();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const statusFilter: StatusFilter = query.status === "active" || query.status === "inactive" ? query.status : "all";
  const admin = createSupabaseAdminClient();

  const [accountsResult, intermediariesResult] = await Promise.all([
    admin
      .from("intermediary_portal_accounts")
      .select("id,intermediary_id,application_id,email,status,invited_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Account[]>(),
    admin
      .from("intermediaries")
      .select("id,display_name,intermediary_code,intermediary_type,portal_access_status,email,application_id,updated_at")
      .eq("intermediary_type", "partner")
      .not("application_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Intermediary[]>(),
  ]);

  const loadError = accountsResult.error ?? intermediariesResult.error;
  const accountMap = new Map((accountsResult.data ?? []).map((item) => [item.intermediary_id, item]));
  const allRows: PortalUserRow[] = (intermediariesResult.data ?? []).map((intermediary) => ({
    intermediary,
    account: accountMap.get(intermediary.id) ?? null,
  }));

  return (
    <AppShell title="Intermediary Portal Users">
      <IntermediaryPortalUsersWorkspace rows={allRows} initialQuery={q} initialStatus={statusFilter} loadError={Boolean(loadError)} />
    </AppShell>
  );
}
