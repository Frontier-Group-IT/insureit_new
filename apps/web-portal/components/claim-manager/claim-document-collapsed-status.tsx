import { CheckCircle2, Clock } from "lucide-react";

type ClaimDocumentCollapsedStatusProps = {
  verifiedCount: number;
  pendingCount: number;
};

export function ClaimDocumentCollapsedStatus({ verifiedCount, pendingCount }: ClaimDocumentCollapsedStatusProps) {
  return (
    <div
      className="flex min-h-11 items-center gap-2 px-1 py-1.5"
      aria-label={`${verifiedCount} verified files, ${pendingCount} pending files`}
      data-claim-document-collapsed-status="true"
    >
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#F0FAF4] px-2.5 text-[#071D49]"
        aria-label={`${verifiedCount} verified files`}
      >
        <CheckCircle2 aria-hidden="true" size={17} strokeWidth={2.4} className="text-[#16A34A]" />
        <span className="text-[12px] font-semibold leading-none">{verifiedCount}</span>
      </span>
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#FFF6EA] px-2.5 text-[#071D49]"
        aria-label={`${pendingCount} pending files`}
      >
        <Clock aria-hidden="true" size={17} strokeWidth={2.4} className="text-[#F97316]" />
        <span className="text-[12px] font-semibold leading-none">{pendingCount}</span>
      </span>
    </div>
  );
}
