import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  await requireMasterDataManager();

  return (
    <AppShell title="Settings">
      <section className="mx-auto max-w-[1240px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Application settings</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">Configuration options will be available here as they are added.</p>
        </div>
      </section>
    </AppShell>
  );
}
