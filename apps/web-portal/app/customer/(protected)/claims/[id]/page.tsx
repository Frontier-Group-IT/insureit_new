import Link from "next/link";
import { ArrowLeft, ExternalLink, FileDown, FileText, Pencil } from "lucide-react";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** A customer-facing, read-only claim document preview. Editing remains in the stage workflow. */
export default async function CustomerClaimDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const q = searchParams ? await searchParams : {};
  const { account } = await resolveCustomerWebScope(q.account);
  const { claim } = await loadCustomerClaimDetail(account.id, id);
  const documentUrl = `/customer/claims/${encodeURIComponent(claim.id)}/download?account=${encodeURIComponent(account.id)}`;
  const source = isExternalCustomerClaim(claim) ? "External" : "Internal";

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={{ pathname: "/customer/claims", query: { account: account.id } }}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#245DAB] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Claims
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a href={documentUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B9CBE2] bg-white px-4 text-[12px] font-semibold text-[#174A87]">
            <ExternalLink className="h-4 w-4" /> Open PDF
          </a>
          <a href={documentUrl}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B9CBE2] bg-white px-4 text-[12px] font-semibold text-[#174A87]">
            <FileDown className="h-4 w-4" /> Download Claim Form
          </a>
          <Link href={{ pathname: `/customer/claims/${claim.id}/stage/spot_intimation`, query: { account: account.id, mode: "edit" } }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0B3884] px-4 text-[12px] font-semibold text-white">
            <Pencil className="h-4 w-4" /> Edit Claim
          </Link>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white shadow-[0_8px_35px_rgba(22,49,83,.05)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E0E8F3] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2FF] text-[#225AA3]"><FileText className="h-5 w-5" /></span>
            <div>
              <h1 className="text-[17px] font-bold text-[#102B54]">Claim Form</h1>
              <p className="text-[11px] text-[#61748F]">{claim.claim_no || "Claim"} · {source} claim · Read-only document</p>
            </div>
          </div>
          <span className="rounded-full bg-[#EFF5FC] px-3 py-1.5 text-[11px] font-semibold text-[#31557F]">{claim.current_status || "Pending"}</span>
        </header>
        <div className="bg-[#EEF2F8] p-3 sm:p-6">
          <div className="mx-auto max-w-[850px] overflow-hidden rounded-lg border border-[#D7DFEA] bg-white shadow-[0_12px_40px_rgba(15,35,65,.11)]">
            <iframe title="Claim Form PDF Preview" src={documentUrl + "#toolbar=0&navpanes=0"}
              className="block h-[76vh] min-h-[570px] w-full border-0" />
          </div>
          <p className="mt-3 text-center text-[11px] text-[#64748B]">
            If the document preview is not supported in your browser, use Open PDF or Download Claim Form above.
          </p>
        </div>
      </section>
    </div>
  );
}
