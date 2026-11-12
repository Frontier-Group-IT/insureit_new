import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SemiAutoPolicyWorkspace, type SemiAutoIntakeRow } from "@/components/development/semi-auto-policy-workspace";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_SIZE = 75;
type Params = { page?: string };

export default async function SemiAutoPolicyOnboardingPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user" && profile.role !== "super_admin") redirect("/access-denied");
  const params = searchParams ? await searchParams : {};
  const parsed = Number(params.page || "1");
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 1;
  const admin = createSupabaseAdminClient();
  const { data, error, count } = await admin.from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,lead_source_name,customer_mobile,ocr_status,created_at,assigned_to_profile_id", { count: "exact" })
    .eq("policy_type", "motor")
    .in("status", ["ready_for_review", "in_review", "needs_attention", "processing"])
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .returns<SemiAutoIntakeRow[]>();

  const total = count ?? 0;
  return (
    <AppShell title="AI Policy Onboarding">
      <main className="mx-auto max-w-[1500px] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#446ca4]">Development / Motor policies</p>
            <h1 className="mt-1 text-[19px] font-bold tracking-tight text-[#122b4a]">Semi-Automated Policy Onboarding</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#54667e]">
              Select an existing Policy Intake to run a read-only eligibility check. Correct individual errors in its saved onboarding draft.
              Verified policies can then be booked through the existing transactional workflow with your explicit confirmation.
            </p>
          </div>
          <Link href="/policy-intakes" className="inline-flex h-9 items-center rounded-lg border border-[#c9d7e8] px-3 text-[11px] font-semibold text-[#183b66]">Policy Intake Register</Link>
        </div>
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[12px] font-semibold text-rose-800">
            Existing Policy Intakes could not be loaded. Refresh this page or contact your administrator.
          </div>
        ) : (
          <>
            <SemiAutoPolicyWorkspace rows={data ?? []} profileId={profile.id} />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e0e6ed] bg-white px-4 py-3 text-[11px] text-[#52657f]">
              <span>{total} pending Motor Intake(s) · page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
              <div className="flex items-center gap-2">
                {page > 1 ? <Link href={"/development/ai-policy-onboarding?page=" + (page - 1)} className="rounded-lg border border-[#d9e2ed] px-3 py-1.5 font-semibold">Previous</Link> : null}
                {page * PAGE_SIZE < total ? <Link href={"/development/ai-policy-onboarding?page=" + (page + 1)} className="rounded-lg border border-[#d9e2ed] px-3 py-1.5 font-semibold">Next</Link> : null}
              </div>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
