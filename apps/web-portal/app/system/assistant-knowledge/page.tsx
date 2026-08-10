import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { publishAssistantKnowledgeEntry, retireAssistantKnowledgeEntry, uploadAssistantKnowledgeWorkbook } from "./actions";

type EntryRow = {
  id: string;
  route: string;
  title: string;
  content: string;
  source_reference: string;
  required_capabilities: string[];
  required_access: "view" | "edit" | "approve";
  version: number;
  status: "draft" | "published" | "retired";
  is_revoked: boolean;
  created_at: string;
  published_at: string | null;
  retired_at: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AssistantKnowledgePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const authenticated = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = authenticated.profile;
  if (!profile?.id || !profile.is_active || !(await hasEffectiveCapability(profile, "manage_assistant_knowledge", "approve"))) redirect("/access-denied");

  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("assistant_knowledge_entries")
    .select("id,route,title,content,source_reference,required_capabilities,required_access,version,status,is_revoked,created_at,published_at,retired_at")
    .order("created_at", { ascending: false })
    .limit(250)
    .returns<EntryRow[]>();
  if (error) throw new Error("assistant_knowledge_list_unavailable");
  const entries = data ?? [];

  return <AppShell title="Assistant Knowledge">
    <div className="mx-auto max-w-[1380px] space-y-4 pb-8">
      <PageHeader title="Assistant Knowledge" />
      {params.success ? <Notice tone="success">{params.success}</Notice> : null}
      {params.error ? <Notice tone="error">{params.error}</Notice> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Draft" value={entries.filter((entry) => entry.status === "draft").length} />
        <Metric label="Published" value={entries.filter((entry) => entry.status === "published" && !entry.is_revoked).length} />
        <Metric label="Retired" value={entries.filter((entry) => entry.status === "retired" || entry.is_revoked).length} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-[15px] font-semibold text-[#17203A]">Controlled workbook import</h2><p className="mt-1 max-w-2xl text-[10px] leading-4 text-[#64748B]">Only validated .xlsx files using the exact Metadata and Knowledge sheets are accepted. Imports are staged as Draft and are never immediately searchable.</p></div>
          <Link href="/api/templates/assistant-knowledge-v1" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white">Download controlled template</Link>
        </div>
        <form action={uploadAssistantKnowledgeWorkbook} className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 md:flex-row md:items-center">
          <input name="workbook" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="min-w-0 flex-1 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[10px]" />
          <button className="min-h-10 rounded-xl bg-[#6759ff] px-5 text-[10px] font-semibold text-white">Validate and stage draft</button>
        </form>
      </Card>

      <Card>
        <div><h2 className="text-[15px] font-semibold text-[#17203A]">Knowledge lifecycle</h2><p className="mt-1 text-[10px] text-[#64748B]">Published entries are searchable only while active and not revoked.</p></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-[10px]"><thead><tr className="border-y border-[#E2E8F0] bg-[#F8FAFC] text-[8px] uppercase tracking-[.05em] text-[#64748B]"><th className="px-3 py-3">Knowledge</th><th className="px-3 py-3">Route</th><th className="px-3 py-3">Capabilities</th><th className="px-3 py-3">Version</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EDF2F7]">
          {entries.map((entry) => <tr key={entry.id}><td className="px-3 py-3"><p className="font-semibold text-[#17203A]">{entry.title}</p><p className="mt-0.5 text-[8.5px] text-[#94A3B8]">{entry.source_reference}</p><details className="mt-2 max-w-xl rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2"><summary className="cursor-pointer font-semibold text-[#334155]">Review complete content before publication</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-[9px] leading-4 text-[#475569]">{entry.content}</pre></details></td><td className="px-3 py-3 font-mono text-[8.5px] text-[#475569]">{entry.route}</td><td className="px-3 py-3 text-[8.5px] text-[#64748B]">{entry.required_capabilities.join(", ")} · minimum {entry.required_access}</td><td className="px-3 py-3">v{entry.version}</td><td className="px-3 py-3"><Status value={entry.status} revoked={entry.is_revoked} /></td><td className="px-3 py-3 text-right">{entry.status === "draft" ? <LifecycleForm action={publishAssistantKnowledgeEntry} id={entry.id} label="Publish" /> : entry.status === "published" && !entry.is_revoked ? <LifecycleForm action={retireAssistantKnowledgeEntry} id={entry.id} label="Retire" /> : <span className="text-[#94A3B8]">No action</span>}</td></tr>)}
          {!entries.length ? <tr><td colSpan={6} className="px-4 py-10 text-center text-[#94A3B8]">No assistant knowledge has been staged.</td></tr> : null}
        </tbody></table></div>
      </Card>
    </div>
  </AppShell>;
}

function LifecycleForm({ action, id, label }: { action: (data: FormData) => Promise<void>; id: string; label: string }) {
  return <form action={action} className="inline-flex max-w-52 flex-col items-end gap-2"><input type="hidden" name="entry_id" value={id} />{label === "Publish" ? <label className="flex items-start gap-1.5 text-left text-[8px] leading-3 text-[#64748B]"><input name="content_reviewed" value="yes" required type="checkbox" className="mt-0.5" />I reviewed the complete content, route, source, capabilities, access level and version.</label> : null}<button className={`rounded-lg px-3 py-2 text-[9px] font-semibold ${label === "Publish" ? "bg-emerald-600 text-white" : "border border-red-200 bg-red-50 text-red-700"}`}>{label}</button></form>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/75 bg-white/90 p-4 shadow-sm"><p className="text-2xl font-semibold text-[#172554]">{value}</p><p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p></div>; }
function Status({ value, revoked }: { value: EntryRow["status"]; revoked: boolean }) { const label = revoked ? "Retired" : value === "published" ? "Published" : value === "draft" ? "Draft" : "Retired"; const style = label === "Published" ? "bg-emerald-50 text-emerald-700" : label === "Draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold uppercase ${style}`}>{label}</span>; }
function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) { return <div className={`rounded-xl border px-4 py-3 text-[10px] ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{children}</div>; }
