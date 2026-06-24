import { reviewClaimDocument } from "@/app/actions";
import { VerificationModalLauncher } from "@/components/claim-manager/verification-modal";
import { saveClaimDocumentVerification } from "@/app/claims/[id]/verification-actions";

export type VerificationDocument = {
  id: string;
  document_type: string;
  file_name: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string | null;
  signedUrl: string | null;
};

export type VerificationItem = {
  key: string;
  title: string;
  body: string;
  icon: string;
  document?: VerificationDocument;
  detailValue?: string | null;
  verified?: boolean;
};

export function VerificationCard({ item, index, claimId, canReviewDocuments }: { item: VerificationItem; index: number; claimId: string; canReviewDocuments: boolean }) {
  const document = item.document;
  const isVerified = item.verified || document?.verification_status === "verified";
  const isRejected = document?.verification_status === "rejected";
  const verificationKind = document ? verificationKindForDocument(document.document_type) : null;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-lg font-black text-[#174EA6]">{index}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-black text-[#071D49]">{item.title}</h3>
            <StatusPill verified={isVerified} rejected={isRejected} hasDocument={Boolean(document)} />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="grid h-24 w-28 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-[#EAF3FF] to-[#F4F8FF] text-4xl">{item.icon}</div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-black text-[#071D49]">{document?.file_name ?? item.detailValue ?? "No file uploaded"}</p>
              <p className={`mt-1 font-black ${document?.signedUrl || isVerified ? "text-emerald-700" : "text-slate-500"}`}>{document?.signedUrl ? "Preview available" : isVerified ? "Verified" : item.body}</p>
              <p className="mt-3 font-semibold text-slate-500">{document?.created_at ? `Uploaded on ${formatDate(document.created_at)}` : item.detailValue ? "Claim detail available" : "Awaiting customer upload"}</p>
              {document?.rejection_reason ? <p className="mt-2 text-xs font-bold text-red-600">{document.rejection_reason}</p> : null}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <VerifyAction claimId={claimId} document={document} kind={verificationKind} canReview={canReviewDocuments} isVerified={isVerified} title={item.title} />
            {document?.signedUrl ? <a className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-center text-sm font-black text-[#174EA6]" href={document.signedUrl} target="_blank" rel="noreferrer">Reload</a> : <button className="rounded-xl border border-blue-100 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-400" type="button" disabled>Reload</button>}
            <ReplaceAction claimId={claimId} document={document} canReview={canReviewDocuments} isVerified={isVerified} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ verified, rejected, hasDocument }: { verified: boolean; rejected: boolean; hasDocument: boolean }) {
  const style = verified ? "bg-emerald-50 text-emerald-700" : rejected ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  const label = verified ? "Verified" : rejected ? "Replacement" : hasDocument ? "Pending" : "Missing";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${style}`}>{label}</span>;
}

function VerifyAction({ claimId, document, kind, canReview, isVerified, title }: { claimId: string; document?: VerificationDocument; kind: "rc" | "insurance" | null; canReview: boolean; isVerified: boolean; title: string }) {
  if (canReview && document && !isVerified && kind) {
    return <VerificationModalLauncher kind={kind} title={title} action={saveClaimDocumentVerification.bind(null, claimId, document.id, kind)} />;
  }
  if (canReview && document && !isVerified) {
    return <form action={reviewClaimDocument.bind(null, claimId, document.id, "verified")}><button className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-black text-emerald-700" type="submit">Verify</button></form>;
  }
  return <button className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-sm font-black text-emerald-700" type="button" disabled>{isVerified ? "Verified" : "Verify"}</button>;
}

function ReplaceAction({ claimId, document, canReview, isVerified }: { claimId: string; document?: VerificationDocument; canReview: boolean; isVerified: boolean }) {
  if (canReview && document && !isVerified) {
    return <form action={reviewClaimDocument.bind(null, claimId, document.id, "rejected")}><input type="hidden" name="reason" value={`Replacement requested for ${document.document_type}.`} /><button className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-black text-red-700" type="submit">Replace</button></form>;
  }
  return <button className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2.5 text-sm font-black text-red-400" type="button" disabled>Replace</button>;
}

function verificationKindForDocument(type: string): "rc" | "insurance" | null {
  if (type === "Registration certificate") return "rc";
  if (type === "Policy copy") return "insurance";
  return null;
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
}
