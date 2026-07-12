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

type SecondaryItem = { href: string; label: string };

const logoUrl = "https://raw.githubusercontent.com/antnish1/insureit_new/main/apps/mobile-app/assets/brand/insureit-stitch-logo.png";

const secondaryNavigation: Partial<Record<NonNullable<Props["activeNav"]>, { title: string; items: SecondaryItem[] }>> = {
  claims: {
    title: "Claims",
    items: [
      { href: "/claims", label: "All Claims" },
      { href: "/claims?stage=documents", label: "Documents" },
      { href: "/claims?stage=verification", label: "Verification" },
      { href: "/claims?stage=survey", label: "Survey" },
      { href: "/claims?stage=repair", label: "Repair" },
      { href: "/claims?stage=settlement", label: "Settlement" }
    ]
  },
  "master-data": {
    title: "Master Data",
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/vehicles", label: "Vehicles" },
      { href: "/policies", label: "Policies" }
    ]
  },
  tasks: {
    title: "Tasks",
    items: [
      { href: "/tasks", label: "My Tasks" },
      { href: "/tasks?view=team", label: "Team Tasks" },
      { href: "/tasks?status=completed", label: "Completed" }
    ]
  },
  reports: {
    title: "Reports",
    items: [
      { href: "/reports", label: "Overview" },
      { href: "/reports?view=claims", label: "Claims Reports" },
      { href: "/reports?view=operations", label: "Operations" }
    ]
  }
};

export async function ClaimManagerShell({ title, backHref = "/dashboard", children, activeNav = "claims" }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);
  const notificationRows = await getNotificationRows();
  const notificationGroups = buildNotificationGroups(notificationRows);
  const notificationCount = notificationRows.length;
  const secondary = secondaryNavigation[activeNav];
  const hasSecondary = Boolean(secondary);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#101828]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-16 border-r border-white/10 bg-[#15183B] text-white lg:flex lg:flex-col">
        <Link href="/dashboard" className="grid h-14 place-items-center border-b border-white/10" aria-label="InsureIt home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/12 text-[11px] font-bold tracking-wide">IT</span>
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1.5 px-2 py-3">
          <RailItem href="/dashboard" icon="⌂" label="Dashboard" active={activeNav === "dashboard"} />
          <RailItem href="/claims" icon="▤" label="Claims" active={activeNav === "claims"} />
          <RailItem href="/customers" icon="▦" label="Master Data" active={activeNav === "master-data"} />
          <RailItem href="/tasks" icon="✓" label="Tasks" active={activeNav === "tasks"} />
          <RailItem href="/reports" icon="▥" label="Reports" active={activeNav === "reports"} />
        </nav>
        <div className="border-t border-white/10 px-2 py-3">
          <RailItem href="/settings" icon="⚙" label="Settings" active={false} />
        </div>
      </aside>

      {secondary ? (
        <aside className="fixed inset-y-0 left-16 z-40 hidden w-48 border-r border-[#D9E0EA] bg-[#E9EBFF] lg:block">
          <div className="flex h-14 items-center border-b border-[#D3D7EF] px-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#454A76]">{secondary.title}</p>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {secondary.items.map((item) => (
              <SecondaryNavItem key={item.href} href={item.href} label={item.label} active={matchesTitle(title, item.label)} />
            ))}
          </nav>
        </aside>
      ) : null}

      <div className={hasSecondary ? "lg:pl-64" : "lg:pl-16"}>
        <header className="sticky top-0 z-30 border-b border-[#DDE3EC] bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={backHref} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#E1E6EE] text-lg text-[#344054] transition hover:bg-[#F6F8FB]" aria-label="Back">‹</Link>
              <img src={logoUrl} alt="InsureIT" className="h-8 w-[118px] shrink-0 object-contain object-left" />
              <div className="hidden h-6 w-px bg-[#E3E7EE] sm:block" />
              <h1 className="truncate text-[16px] font-semibold tracking-tight text-[#17203A]">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
              <label className="relative hidden md:block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#98A2B3]">⌕</span>
                <input aria-label="Global search" placeholder="Search" className="h-8 w-56 rounded-md border border-[#D8DEE8] bg-[#FAFBFC] py-1 pl-8 pr-3 text-[12px] focus:border-[#5965C8] focus:ring-2 focus:ring-[#E3E6FF]" />
              </label>
              <NotificationMenu groups={notificationGroups} count={notificationCount} />
              <div className="ml-1 border-l border-[#E4E7EC] pl-2">
                <UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} />
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-56px)] px-3 py-3 sm:px-4 lg:px-5">{children}</main>
      </div>
    </div>
  );
}

function matchesTitle(title: string, label: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === "all claims") return normalizedTitle.includes("claim");
  if (normalizedLabel === "my tasks") return normalizedTitle.includes("task");
  if (normalizedLabel === "overview") return normalizedTitle.includes("report");
  return normalizedTitle.includes(normalizedLabel.replace(/s$/, ""));
}

function RailItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} title={label} aria-label={label} className={`group relative grid h-10 w-10 place-items-center rounded-lg text-[17px] transition ${active ? "bg-[#7067E8] text-white shadow-[0_5px_16px_rgba(74,65,190,0.35)]" : "text-white/68 hover:bg-white/10 hover:text-white"}`}>
      {icon}
      <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded-md bg-[#10132F] px-2 py-1 text-[10px] font-medium text-white shadow-lg group-hover:block">{label}</span>
    </Link>
  );
}

function SecondaryNavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return <Link href={href} className={`block rounded-md px-3 py-2 text-[12px] font-medium transition ${active ? "bg-[#242653] text-white shadow-sm" : "text-[#454A68] hover:bg-white/70 hover:text-[#242653]"}`}>{label}</Link>;
}

function NotificationMenu({ groups, count }: { groups: NotificationGroup[]; count: number }) {
  const displayCount = count > 99 ? "99+" : String(count);
  return (
    <details className="relative">
      <summary className="relative grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md border border-[#E1E6EE] bg-white text-[14px] text-[#344054] transition hover:bg-[#F6F8FB] [&::-webkit-details-marker]:hidden" aria-label="Open action inbox">
        ♧
        {count ? <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#E5484D] px-1 text-[8px] font-bold text-white ring-2 ring-white">{displayCount}</span> : null}
      </summary>
      <div className="absolute right-0 top-10 z-50 w-[350px] overflow-hidden rounded-xl border border-[#DCE3EC] bg-white shadow-[0_18px_45px_rgba(16,24,40,0.16)]">
        <div className="flex items-center justify-between border-b border-[#E7ECF2] px-4 py-3">
          <div><p className="text-[12px] font-semibold text-[#17203A]">Action Inbox</p><p className="mt-0.5 text-[10px] text-[#667085]">Items requiring attention</p></div>
          <span className="rounded-full bg-[#FFF3E8] px-2 py-0.5 text-[10px] font-semibold text-[#A45A08]">{count} pending</span>
        </div>
        {groups.length ? <div className="divide-y divide-[#EDF0F4]">{groups.slice(0, 6).map((group) => <Link key={group.key} href={group.href} className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-[#F8FAFC]"><div className="min-w-0"><p className="text-[11px] font-semibold text-[#17203A]">{group.label}</p><p className="mt-0.5 text-[9.5px] text-[#7A8699]">Oldest {relativeTime(group.oldestAt)}</p></div><div className="flex shrink-0 items-center gap-1.5">{group.urgentCount ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700">{group.urgentCount} urgent</span> : null}<span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#EEF1F5] px-1.5 text-[10px] font-semibold text-[#344054]">{group.count}</span></div></Link>)}</div> : <div className="px-4 py-7 text-center"><p className="text-[12px] font-semibold text-[#17203A]">No pending actions</p><p className="mt-1 text-[10px] text-[#7A8699]">New customer and claim updates will appear here.</p></div>}
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
