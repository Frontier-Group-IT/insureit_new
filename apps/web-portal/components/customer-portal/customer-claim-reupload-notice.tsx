import Link from "next/link";
import { ArrowRight, FileWarning } from "lucide-react";
import type { ClaimReuploadRequest } from "@/lib/customer-claim-reupload";

/** Same action-needed wording and amber treatment as the Customer App. */
export function CustomerClaimReuploadNotice({
  requests, accountId, claimId,
}: {
  requests: ClaimReuploadRequest[];
  accountId: string;
  claimId: string;
}) {
  if (!requests.length) return null;
  const actionNeeded = requests.some(request => request.status === "action_required");
  return <section aria-label="Claim document re-upload requests"
    className={`rounded-2xl border px-4 py-4 shadow-[0_4px_20px_rgba(90,65,15,.05)] ${actionNeeded ? "border-[#E9BB77] bg-[#FFF8EF]" : "border-[#B9D1EC] bg-[#F4F8FF]"}`}>
    <div className="flex items-start gap-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${actionNeeded ? "bg-[#FFEBCA] text-[#995C00]" : "bg-[#E5EFFC] text-[#225AA3]"}`}>
        <FileWarning className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className={`text-[16px] font-bold ${actionNeeded ? "text-[#804700]" : "text-[#174A87]"}`}>
          {actionNeeded ? "Action needed: replace a claim document" : "Replacement submitted — awaiting verification"}
        </h2>
        <div className="mt-2 space-y-3">
          {requests.map(request => <div key={request.id} className="text-[13px] text-[#644525]">
            <p className="font-bold">{request.documentType}</p>
            <p className="mt-1 break-words">{request.status === "action_required" ? request.reason : "Replacement uploaded. Awaiting Operations verification."}</p>
            {request.status === "action_required" ? <Link
              href={{
                pathname: `/customer/claims/${encodeURIComponent(claimId)}/stage/${request.stage}`,
                query: { account: accountId, mode: "edit", request: request.id },
              }}
              className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold text-[#8A4B00] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A4B00]">
              Open stage <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link> : null}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
