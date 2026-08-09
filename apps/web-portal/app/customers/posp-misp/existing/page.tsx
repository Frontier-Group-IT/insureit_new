import Link from "next/link";
import { UserRound, Building2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExistingIntermediaryChooserPage() {
  await requirePospMispManager();

  return (
    <AppShell title="Add Existing POSP / MISP">
      <div className="mx-auto max-w-[980px] space-y-4">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Existing intermediary onboarding</p>
          <h2 className="mt-1 text-[18px] font-semibold text-[#0F172A]">Choose account type</h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#64748B]">Use this flow when the POSP or MISP already exists outside InsureIT and needs to be brought into the portal with its existing registration details.</p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/customers/posp-misp/existing/new?partner_type=posp"
            prefetch={false}
            className="group rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8B83FF] hover:shadow-[0_14px_34px_rgba(79,70,229,.12)]"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-[#17203A]">Existing POSP</h3>
                <p className="mt-1 text-[10.5px] leading-5 text-[#64748B]">Add an already registered individual POSP and continue its portal onboarding.</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#4F46E5]">Continue <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
              </div>
            </div>
          </Link>

          <Link
            href="/customers/posp-misp/existing/new?partner_type=misp"
            prefetch={false}
            className="group rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0F9FA7] hover:shadow-[0_14px_34px_rgba(15,159,167,.12)]"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E8FBFB] text-[#0F8C94]"><Building2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-[#17203A]">Existing MISP</h3>
                <p className="mt-1 text-[10.5px] leading-5 text-[#64748B]">Add an already registered MISP organisation and continue its portal onboarding.</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0F8C94]">Continue <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
