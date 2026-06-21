import Link from "next/link";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type DocumentRow = {
  id: string;
  claim_id: string;
  document_type: string;
  file_name: string;
  verification_status: string;
  created_at: string | null;
  claims: { claim_no: string; current_status: string } | null;
  customers: { company_name: string | null; contact_name: string } | null;
};

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id, claim_id, document_type, file_name, verification_status, created_at, claims(claim_no, current_status), customers(company_name, contact_name)")
    .order("created_at", { ascending: false })
    .returns<DocumentRow[]>();

  return (
    <AppShell title="Document verification">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Documents</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">Document verification</h1>
          <p className="mt-2 text-sm text-slate-500">Open a claim workspace to verify files or request reupload.</p>
        </div>
        <Link href="/claims?queue=documents" className="rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Open document queue</Link>
      </div>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Claim status</th><th className="px-4 py-3">Document status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(data ?? []).length ? (data ?? []).map((doc) => (
                <tr key={doc.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-4"><p className="font-bold text-navy-900">{doc.document_type}</p><p className="mt-1 text-xs text-slate-500">{doc.file_name}</p></td>
                  <td className="px-4 py-4 font-bold text-navy-900">{doc.claims?.claim_no ?? "-"}</td>
                  <td className="px-4 py-4 text-slate-700">{doc.customers?.company_name ?? doc.customers?.contact_name ?? "-"}</td>
                  <td className="px-4 py-4">{doc.claims?.current_status ? <StatusBadge status={doc.claims.current_status} /> : "-"}</td>
                  <td className="px-4 py-4"><StatusBadge status={doc.verification_status} /></td>
                  <td className="px-4 py-4"><Link href={`/claims/${doc.claim_id}`} className="font-bold text-blue-700">Review</Link></td>
                </tr>
              )) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={6}>No documents found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
