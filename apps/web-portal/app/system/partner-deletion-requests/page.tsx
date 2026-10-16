import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PartnerDeletionQueue } from "./queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerDeletionRequestsPage() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user") redirect("/access-denied");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("partner_account_deletion_requests")
    .select("id,auth_user_id,actor_kind,actor_id,intermediary_id,status,requested_at,updated_at,completed_at,resolution_note")
    .order("requested_at", { ascending: false }).limit(100);
  return <AppShell title="Partner privacy requests">
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold text-slate-900">Partner account deletion requests</h1>
        <p className="mt-2 text-sm text-slate-600">IT Super User only. Requests are reviewed individually; no account or business records are automatically deleted.</p>
        <p className="mt-1 text-xs text-amber-700">Do not mark any request fulfilled without verified identity deletion, lawful retention assessment, and requester notification.</p>
      </section>
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-red-700">Unable to load deletion requests. Verify that the migration is applied.</div> : <PartnerDeletionQueue initial={data ?? []}/>}
    </main>
  </AppShell>;
}
