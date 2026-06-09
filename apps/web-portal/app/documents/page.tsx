import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  verification_status: string;
  claims: { claim_no: string } | null;
  customers: { company_name: string | null; contact_name: string } | null;
};

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id, document_type, file_name, verification_status, claims(claim_no), customers(company_name, contact_name)")
    .order("created_at", { ascending: false })
    .returns<DocumentRow[]>();

  return (
    <AppShell title="Document verification">
      <PageHeader title="Document verification" />
      <SearchFilterBar searchPlaceholder="Search documents by claim no, customer, document type, or status" filterLabel="Document status" />
      {error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No documents are pending for review" emptyDescription="No documents are pending for review." columns={[
        { header: "Document", cell: (doc) => <><p className="font-semibold text-navy-900">{doc.document_type}</p><p className="text-xs text-slate-500">{doc.file_name}</p></> },
        { header: "Claim", cell: (doc) => doc.claims?.claim_no ?? "—" },
        { header: "Customer", cell: (doc) => doc.customers?.company_name ?? doc.customers?.contact_name ?? "—" },
        { header: "Status", cell: (doc) => <StatusBadge status={doc.verification_status} /> }
      ]} />}
    </AppShell>
  );
}
