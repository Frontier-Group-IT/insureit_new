import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { listManagementPackSnapshots } from "@/lib/reports/management-pack-archive";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManagementPackArchivePage() {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const snapshots = await listManagementPackSnapshots(profile.id);

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1200px] space-y-4 pb-8">
        <header className="portal-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">Management Pack Archive</h1>
            <Link href="/reports/management-pack" className="inline-flex h-9 items-center rounded-lg border border-[#dfe5ee] bg-white px-3 text-[10px] font-bold text-[#526174]">Management Pack</Link>
          </div>
        </header>

        <section className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[.08em] text-[#7c899b]"><th className="px-5 py-3 text-left">Month</th><th className="px-3 py-3 text-left">Scope</th><th className="px-3 py-3 text-left">Captured</th><th className="px-3 py-3 text-right">Version</th><th className="px-5 py-3 text-center">Open</th></tr></thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {snapshots.map((snapshot) => <tr key={snapshot.id} className="text-[10.5px]"><td className="px-5 py-3.5 font-bold text-[#24344f]">{formatMonth(snapshot.month)}</td><td className="px-3 py-3.5 font-semibold capitalize text-[#506077]">{snapshot.scopeMode}</td><td className="px-3 py-3.5 text-[#5f6d80]">{formatTimestamp(snapshot.capturedAt)}</td><td className="px-3 py-3.5 text-right tabular-nums">{snapshot.snapshotVersion}</td><td className="px-5 py-3.5 text-center"><Link href={`/reports/management-pack?snapshot=${encodeURIComponent(snapshot.id)}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f]"><ExternalLink className="h-3.5 w-3.5" /></Link></td></tr>)}
              </tbody>
            </table>
          </div>
          {!snapshots.length ? <div className="px-5 py-12 text-center text-[10px] font-semibold text-[#7a8798]">No snapshots</div> : null}
        </section>
      </div>
    </AppShell>
  );
}

function formatMonth(value: string) { return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}-01T00:00:00+05:30`)); }
function formatTimestamp(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
