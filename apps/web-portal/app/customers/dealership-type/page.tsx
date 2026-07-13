import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";

export default async function DealershipTypePage() {
  await requireMasterDataManager();

  return (
    <AppShell title="Select Dealership Type">
      <div className="fixed inset-0 z-[120] grid place-items-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-[620px] rounded-2xl border border-white/60 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6366F1]">Dealership onboarding</p>
              <h2 className="mt-1 text-[18px] font-semibold text-[#0F172A]">Choose dealership type</h2>
              <p className="mt-1 text-[11px] text-[#64748B]">Select the operating model before opening the onboarding form.</p>
            </div>
            <Link href="/customers?choose_partner=1" className="grid h-8 w-8 place-items-center rounded-md border border-[#E2E8F0] text-[#64748B]">×</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/customers/new?partner_type=dealership&dealership_type=posp" className="group rounded-xl border border-[#CBD5E1] p-4 transition hover:border-[#6366F1] hover:bg-[#F8FAFF]">
              <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-[#0F172A]">POSP</p><span className="text-[#4F46E5]">→</span></div>
              <p className="mt-1 text-[10.5px] leading-4 text-[#64748B]">Point of Sales Person dealership onboarding.</p>
            </Link>
            <Link href="/customers/new?partner_type=dealership&dealership_type=misp" className="group rounded-xl border border-[#CBD5E1] p-4 transition hover:border-[#6366F1] hover:bg-[#F8FAFF]">
              <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-[#0F172A]">MISP</p><span className="text-[#4F46E5]">→</span></div>
              <p className="mt-1 text-[10.5px] leading-4 text-[#64748B]">Motor Insurance Service Provider dealership onboarding.</p>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
