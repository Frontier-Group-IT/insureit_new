import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  await requireCapability("manage_system", "approve");
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  const canManagePermissions = await hasEffectiveCapability(profile, "manage_system", "approve");

  return (
    <AppShell title="Settings">
      <section className="mx-auto max-w-[1240px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Application settings</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">Manage system configuration and administrative access.</p>
        </div>
        {canManagePermissions ? <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3"><Link href="/system/access-control" className="rounded-2xl border border-[#DCE5EF] bg-[#F8FAFF] p-4 transition hover:border-[#8B83FF] hover:bg-white hover:shadow-[0_12px_28px_rgba(79,70,229,.10)]"><p className="text-[12px] font-semibold text-[#17203A]">Employees & Access</p><p className="mt-1 text-[10px] leading-4 text-[#64748B]">Review role permissions, employee overrides, data scope and permission history.</p><span className="mt-3 inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[8.5px] font-semibold text-[#4338CA]">IT Super User</span></Link></div> : <div className="p-5 text-[10.5px] text-[#64748B]">No additional settings are available for your role.</div>}
      </section>
    </AppShell>
  );
}
