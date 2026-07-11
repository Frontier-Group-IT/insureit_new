import type { ReactNode } from "react";
import Link from "next/link";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
  activeNav?: "dashboard" | "claims" | "master-data" | "tasks" | "reports" | "none";
};

type NotificationRow = {
  id: string;
  event_type: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "seen" | "in_progress" | "handled" | "dismissed";
  created_at: string;
};

type NotificationGroup = {
  key: string;
  label: string;
  count: number;
  urgentCount: number;
  oldestAt: string;
  href: string;
};

const logoUrl = "https://raw.githubusercontent.com/antnish1/insureit_new/main/apps/mobile-app/assets/brand/insureit-stitch-logo.png";

export async function ClaimManagerShell({ title, backHref = "/dashboard", children, activeNav = "claims" }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);
  const notificationRows = await getNotificationRows();
  const notificationGroups = buildNotificationGroups(notificationRows);
  const notificationCount = notificationRows.length;

  return (
    <div className="min-h-screen bg-[#F7FAFE] text-[#071D49]">
      <aside className="group fixed left-0 top-0 z-50 h-screen w-[56px] overflow-hidden border-r border-[#DFE7F2] bg-white shadow-[3px_0_18px_rgba(7,29,73,0.05)] transition-all duration-200 hover:w-[220px] focus-within:w-[220px]">
        <div className="flex h-14 items-center gap-3 border-b border-[#E7EDF5] px-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#071D49] text-xs font-semibold text-white">IT</div>
          <span className="whitespace-nowrap text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Claim Manager</span>
        </div>
        <nav className="mt-3 space-y-1 px-2 text-sm">
          <SideNavItem href="/dashboard" icon="▦" label="Dashboard" active={activeNav === "dashboard"} />
          <SideNavItem href="/claims" icon="▤" label="Claims" active={activeNav === "claims"} />
          <MasterDataNav active={activeNav === "master-data"} />
          <SideNavItem href="/tasks" icon="☑" label="Tasks" active={activeNav === "tasks"} />
          <SideNavItem href="/reports" icon="▥" label="Reports" active={activeNav === "reports"} />
        </nav>
      </aside>

      <div className="pl-[56px]">
        <header className="sticky top-0 z-30 border-b border-[#DFE7F2] bg-white/95 shadow-[0_2px_12px_rgba(7,29,73,0.035)] backdrop-blur">
          <div className="mx-auto flex h-[68px] max-w-[1580px] items-center justify-between px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={backHref} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[24px] font-light leading-none text-[#071D49] transition hover:bg-[#F1F6FF]" aria-label="Back">‹</Link>
              <div className="flex shrink-0 items-center pr-1"><img src={logoUrl} alt="InsureIT" className="h-[38px] w-[142px] object-contain object-left" /></div>
              <div className="hidden h-8 w-px bg-[#D7DEE9] md:block" />
              <h1 className="hidden truncate text-[17px] font-semibold tracking-tight text-[#071D49] md:block">{title}</h1>
            </div>
            <div className="flex h-full shrink-0 items-center gap-5 py-2">
              <NotificationMenu groups={notificationGroups} count={notificationCount} />
              <div className="flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-[#1E2A44]">
                <div className="scale-[0.82]"><UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} /></div>
                <span className="hidden leading-none sm:block">Profile</span>
              </div>
            </div>
          </div>
          <div className="mx-auto block max-w-[1580px] px-5 pb-1 md:hidden"><h1 className="truncate text-base font-semibold text-[#071D49]">{title}</h1></div>
        </header>
        <main className="mx-auto max-w-[1580px] px-5 py-2 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

function MasterDataNav({ active }: { active: boolean }) {
  return (
    <details className="group/master" open={active}>
      <summary className={`flex h-10 cursor-pointer list-none items-center gap-3 rounded-xl px-3 transition [&::-webkit-details-marker]:hidden ${active ? "bg-[#EAF3FF] text-[#003A83]" : "text-[#344256] hover:bg-[#F5F8FC] hover:text-[#003A83]"}`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center text-[17px] leading-none">⌘</span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Master Data <span className="text-[11px] transition group-open/master:rotate-90">›</span></span>
      </summary>
      <div className="ml-9 mt-1 hidden space-y-1 group-hover:block group-focus-within:block group-open/master:block">
        <SubNavItem href="/customers" label="Customers" />
        <SubNavItem href="/vehicles" label="Vehicles" />
        <SubNavItem href="/policies" label="Policies" />
      </div>
    </details>
  );
}

function SubNavItem({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="block rounded-lg px-3 py-2 text-[12px] font-medium text-[#526176] transition hover:bg-[#F1F6FF] hover:text-[#003A83]">{label}</Link>;
}

function NotificationMenu({ groups, count }: { groups: NotificationGroup[]; count: number }) {
  const displayCount = count > 99 ? "99+" : String(count);
  return (
    <details className="relative flex h-[52px] flex-col items-center justify-center gap-0.5 text-[#071D49]">
      <summary className="flex cursor-pointer list-none flex-col items-center justify-center gap-0.5 [&::-webkit-details-marker]:hidden" aria-label="Open action inbox">
        <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white text-[16px] shadow-[0_0_0_1px_rgba(7,29,73,0.08)] transition hover:bg-[#F1F6FF]">🔔{count ? <span className="absolute -right-2 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#E21D35] px-1 text-[9px] font-semibold text-white ring-1 ring-white">{displayCount}</span> : null}</span>
        <span className="hidden text-[10.5px] font-medium leading-none text-[#1E2A44] sm:block">Notifications</span>
      </summary>
      <div className="absolute right-0 top-[54px] z-50 w-[360px] rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_18px_42px_rgba(7,29,73,0.14)]">
        <div className="flex items-center justify-between border-b border-[#E6EEF7] px-4 py-3"><div><p className="text-[13px] font-semibold text-[#071D49]">Action Inbox</p><p className="mt-0.5 text-[11px] text-[#68758A]">New, seen and in-progress customer actions</p></div><span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11px] font-semibold text-[#A85D00]">{count} pending</span></div>
        {groups.length ? <div className="divide-y divide-[#E8EEF6]">{groups.slice(0, 6).map((group) => <Link key={group.key} href={group.href} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#FAFCFF]"><div className="min-w-0"><p className="text-[12px] font-semibold text-[#071D49]">{group.label}</p><p className="mt-0.5 text-[10.5px] text-[#68758A]">Oldest {relativeTime(group.oldestAt)}</p></div><div className="flex shrink-0 items-center gap-1.5">{group.urgentCount ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">{group.urgentCount} urgent</span> : null}<span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#F2F6FB] px-2 text-[11px] font-semibold text-[#071D49]">{group.count}</span></div></Link>)}</div> : <div className="px-4 py-8 text-center"><p className="text-[13px] font-semibold text-[#071D49]">No pending actions</p><p className="mt-1 text-[11.5px] text-[#7A8797]">New uploads, replies and KYC updates will appear here.</p></div>}
        <div className="border-t border-[#E6EEF7] px-4 py-2.5 text-right"><Link href="/claims" className="text-[11.5px] font-semibold text-[#174EA6] hover:text-[#071D49]">Open claims queue</Link></div>
      </div>
    </details>
  );
}

async function getNotificationRows() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("customer_activity_events").select("id, event_type, title, priority, status, created_at").in("status", ["new", "seen", "in_progress"]).order("created_at", { ascending: false }).limit(80).returns<NotificationRow[]>();
  return data ?? [];
}

function buildNotificationGroups(rows: NotificationRow[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const row of rows) {
    const definition = notificationGroupDefinition(row.event_type);
    const existing = groups.get(definition.key);
    if (!existing) { groups.set(definition.key, { ...definition, count: 1, urgentCount: isUrgent(row), oldestAt: row.created_at }); continue; }
    existing.count += 1;
    existing.urgentCount += isUrgent(row);
    if (Date.parse(row.created_at) < Date.parse(existing.oldestAt)) existing.oldestAt = row.created_at;
  }
  return Array.from(groups.values()).sort((a, b) => b.urgentCount - a.urgentCount || b.count - a.count || Date.parse(a.oldestAt) - Date.parse(b.oldestAt));
}

function notificationGroupDefinition(eventType: string): Pick<NotificationGroup, "key" | "label" | "href"> {
  if (eventType === "claim_document_reuploaded") return { key: "reupload", label: "Rejected Docs Reuploaded", href: "/dashboard?activity=replacements#manager-action" };
  if (eventType === "claim_document_uploaded" || eventType === "claim_documents_completed") return { key: "documents", label: "Documents Uploaded", href: "/dashboard?activity=documents#manager-action" };
  if (eventType.startsWith("support_ticket")) return { key: "support", label: "Support Replies / Tickets", href: "/dashboard?activity=support#manager-action" };
  if (eventType.startsWith("customer_kyc")) return { key: "kyc", label: "KYC / Profile Updates", href: "/dashboard?activity=kyc#customer-activity" };
  if (eventType === "roadside_call_started") return { key: "roadside", label: "Roadside Assistance", href: "/dashboard?activity=roadside#manager-action" };
  return { key: "customer-updates", label: "Customer Updates", href: "/dashboard#manager-action" };
}

function isUrgent(row: NotificationRow) { return row.priority === "critical" || row.priority === "high" ? 1 : 0; }
function relativeTime(value: string) { const diffMs = Date.now() - Date.parse(value); if (!Number.isFinite(diffMs)) return "-"; const minutes = Math.max(0, Math.floor(diffMs / 60000)); if (minutes < 1) return "just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days === 1 ? "1d ago" : `${days}d ago`; }

function SideNavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return <Link href={href} className={`flex h-10 items-center gap-3 rounded-xl px-3 transition ${active ? "bg-[#EAF3FF] text-[#003A83]" : "text-[#344256] hover:bg-[#F5F8FC] hover:text-[#003A83]"}`}><span className="grid h-6 w-6 shrink-0 place-items-center text-[17px] leading-none">{icon}</span><span className="whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{label}</span></Link>;
}
