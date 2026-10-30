"use client";

import Link from "next/link";
import { ClaimDocumentDeleteConfirmation } from "@/components/claim-manager/claim-document-delete-confirmation";
import Image from "next/image";
import { Shield, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ClaimDocumentCollapsedStatus } from "@/components/claim-manager/claim-document-collapsed-status";
import { DocumentVerificationDetailsButton } from "@/components/spot-survey/document-verification-details-button";
import { ReplaceDocumentButton } from "@/components/spot-survey/replace-document-button";
import { deleteVerifiedSpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";
import { useRouter } from "next/navigation";
import { VerificationActionButton } from "@/components/spot-survey/verification-action-button";
import type { FinalVerificationDocument, FinalVerificationRow } from "./final-document-verification-data-actions";

export type Stage3DocumentVerificationItem = {
  key: string;
  visualKey: "spot" | "rc" | "insurance" | "dl" | "gr" | "video" | "audio" | "document";
  verificationKey: "spot" | "rc" | "insurance" | "dl" | "gr" | "document";
  title: string;
  icon: string;
  accent: string;
  documentType: string;
  documents: FinalVerificationDocument[];
};

type ClaimContext = {
  id: string;
  customer_id: string;
  accident_at?: string | null;
  policies: { start_date?: string | null; end_date?: string | null } | null;
};

export function Stage3DocumentVerificationGroup({ item, claim, verifications }: { item: Stage3DocumentVerificationItem; claim: ClaimContext; verifications: FinalVerificationRow[] }) {
  const selectableIds = useMemo(
    () => item.documents.filter((document) => !isDocumentVerified(document, verifications) && document.verification_status !== "rejected").map((document) => document.id),
    [item.documents, verifications],
  );
  const selectableKey = selectableIds.join("|");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const allowed = new Set(selectableIds);
    setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => allowed.has(id))));
  }, [selectableKey]);

  const selectedDocumentIds = selectableIds.filter((id) => selectedIds.has(id));
  const verifiedFileCount = item.documents.filter((document) => isDocumentVerified(document, verifications)).length;
  const pendingFileCount = item.documents.length - verifiedFileCount;
  const allVerified = item.documents.length > 0 && verifiedFileCount === item.documents.length;
  const hasNoFiles = item.documents.length === 0;
  const hasSingleFile = item.documents.length === 1;
  const hasMultipleFiles = item.documents.length > 1;
  const showDocumentRows = hasSingleFile || (hasMultipleFiles && isExpanded);
  const contentId = `claim-final-document-group-${claim.id}-${item.key}`;
  const toggleExpanded = () => {
    if (hasMultipleFiles) setIsExpanded((expanded) => !expanded);
  };
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (!hasMultipleFiles) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, label, select, textarea")) return;
    toggleExpanded();
  };

  return (
    <article
      onClick={handleCardClick}
      className={`rounded-xl border bg-white ${hasNoFiles ? "px-2.5 py-2" : "p-2.5"} shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${allVerified ? "border-green-200" : "border-[#E2EAF4]"} ${hasMultipleFiles ? "cursor-pointer" : ""}`}
    >
      <div className={`flex items-center justify-between gap-2 ${showDocumentRows ? "mb-2" : ""}`}>
        {hasMultipleFiles ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded();
            }}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.title}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 focus-visible:ring-offset-1"
          >
            <Stage3DocumentArtwork documentType={item.documentType} />
            <h2 className="truncate text-[13px] font-semibold leading-tight text-[#071D49]">{item.title}</h2>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Stage3DocumentArtwork documentType={item.documentType} />
            <h2 className="truncate text-[13px] font-semibold leading-tight text-[#071D49]">{item.title}</h2>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentType={item.documentType} label={item.title} actionLabel="Upload" iconOnly />
          {allVerified ? <StatusBadge tone="green" label="Verified" /> : (
            <VerificationActionButton
              claimId={claim.id}
              documentIds={selectedDocumentIds}
              itemKey={item.verificationKey}
              incidentDate={claim.accident_at}
              policyStartDate={claim.policies?.start_date}
              policyEndDate={claim.policies?.end_date}
              disabled={selectedDocumentIds.length === 0}
              variant="header"
              attention={selectableIds.length > 0}
            />
          )}
        </div>
      </div>

      {item.documents.length ? (
        showDocumentRows ? (
          <div id={contentId} className="space-y-2">
            {item.documents.map((document) => {
              const verification = latestVerificationForDocument(document, verifications);
              const verified = isDocumentVerified(document, verifications);
              const rejected = document.verification_status === "rejected";
              const selected = selectedIds.has(document.id);
              return (
                <DocumentFileRow
                  key={document.id}
                  item={item}
                  claim={claim}
                  document={document}
                  verification={verification}
                  verified={verified}
                  rejected={rejected}
                  selected={selected}
                  onSelectedChange={(checked) => setSelectedIds((previous) => {
                    const next = new Set(previous);
                    if (checked) next.add(document.id);
                    else next.delete(document.id);
                    return next;
                  })}
                />
              );
            })}
          </div>
        ) : hasMultipleFiles ? (
          <div id={contentId}>
            <ClaimDocumentCollapsedStatus verifiedCount={verifiedFileCount} pendingCount={pendingFileCount} showLabels />
          </div>
        ) : null
      ) : null}
    </article>
  );
}

function DocumentFileRow({ item, claim, document, verification, verified, rejected, selected, onSelectedChange }: { item: Stage3DocumentVerificationItem; claim: ClaimContext; document: FinalVerificationDocument; verification?: FinalVerificationRow; verified: boolean; rejected: boolean; selected: boolean; onSelectedChange: (checked: boolean) => void }) {
  const selectable = !verified && !rejected;
  const router = useRouter();
  const [deletePending, setDeletePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const confirmDelete = async () => {
    setDeletePending(true);
    try {
      const result = await deleteVerifiedSpotSurveyDocument(claim.id, document.id);
      if (!result.ok) window.alert(result.message ?? 'Document could not be deleted.');
      else { setDeleteOpen(false); router.refresh(); }
    } catch { window.alert('Document could not be deleted.'); }
    finally { setDeletePending(false); }
  };
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 transition ${verified ? "border-green-200 bg-green-50/75" : "border-[#E2EAF4] bg-white/80"}`}>
      {selectable ? (
        <button
          type="button"
          onClick={() => onSelectedChange(!selected)}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${document.file_name} for verification`}
          title={selected ? "Click to deselect" : "Click to select for verification"}
          className="grid h-8 w-8 place-items-center rounded-md bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/40"
        >
          {selected ? <ShieldCheck aria-hidden="true" size={22} strokeWidth={2.2} className="text-[#2563EB]" /> : <Shield aria-hidden="true" size={22} strokeWidth={2.2} className="text-[#2563EB]" />}
        </button>
      ) : (
        <span className="grid h-8 w-8 place-items-center" aria-label={verified ? "Verified document" : "Document unavailable for selection"} title={verified ? "Verified" : "Reupload requested"}>
          {verified ? <ShieldCheck aria-hidden="true" size={22} strokeWidth={2.2} className="text-[#16A34A]" /> : <Shield aria-hidden="true" size={22} strokeWidth={2.2} className="text-slate-400" />}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link href={document.signedUrl} target="_blank" className="block min-w-0 flex-1 truncate text-[11px] font-semibold text-[#071D49] hover:text-[#174EA6]" title={document.file_name}>{document.file_name}</Link>
        <span className="sr-only">{verified ? "Verified" : rejected ? "Reupload requested" : "Pending"} — {item.documentType}</span>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <button type="button" disabled={deletePending} aria-label={`Delete ${document.file_name}`} title="Delete document" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentId={document.id} documentType={item.documentType} label={item.title} actionLabel="Replace" iconOnly />
          {verified ? <DocumentVerificationDetailsButton document={document} verification={verification ?? fallbackVerification(claim, item, document)} title={item.title} /> : null}
        </div>
      </div>
      {rejected ? <p className="sr-only">{document.rejection_reason ?? "Customer reupload requested."}</p> : null}
      {deleteOpen ? <ClaimDocumentDeleteConfirmation filename={document.file_name} pending={deletePending} onCancel={() => setDeleteOpen(false)} onConfirm={() => void confirmDelete()} /> : null}
    </div>
  );
}

// Exact existing Customer App artwork; scoped exclusively to Operations Claim Intimation (Stage 3).
const STAGE3_DOCUMENT_ARTWORK: Record<string, string> = {
  "rccopy": "/assets/customer-claim/stage3-document-icons/glossy_green_vehicle_document_icon.png",
  "insurancecopy": "/assets/customer-claim/stage3-document-icons/glossy_blue_secure_policy_document_icon.png",
  "driverlicence": "/assets/customer-claim/stage3-document-icons/glossy_purple_id_card_icon.png",
  "grloadbill": "/assets/customer-claim/stage3-document-icons/glossy_orange_delivery_document_icon.png",
  "fitnesscopy": "/assets/customer-claim/stage3-document-icons/tasks-completed.png",
  "fasttagreportlast15days": "/assets/customer-claim/stage3-document-icons/reports-analytics.png",
  "spotreport": "/assets/customer-claim/stage3-document-icons/claim-survey.png",
  "estimatecopy": "/assets/customer-claim/stage3-document-icons/claim-assessment.png",
  "repairestimate": "/assets/customer-claim/stage3-document-icons/claim-assessment.png",
  "towingbill": "/assets/customer-claim/stage3-document-icons/fleet-vehicle.png",
  "ncbverification": "/assets/customer-claim/stage3-document-icons/claim-approval.png",
  "roadtax": "/assets/customer-claim/stage3-document-icons/receipts-posted.png",
  "localpermita": "/assets/customer-claim/stage3-document-icons/policy.png",
  "localpermitb": "/assets/customer-claim/stage3-document-icons/policy.png",
  "nationalpermit": "/assets/customer-claim/stage3-document-icons/policy.png",
  "driveraadhaarfront": "/assets/customer-claim/stage3-document-icons/kyc.png",
  "driveraadhaarback": "/assets/customer-claim/stage3-document-icons/kyc.png",
  "aadhaar": "/assets/customer-claim/stage3-document-icons/kyc.png",
  "pan": "/assets/customer-claim/stage3-document-icons/kyc.png",
  "kycform": "/assets/customer-claim/stage3-document-icons/kyc-completed.png",
  "gst": "/assets/customer-claim/stage3-document-icons/accounts-finance.png",
  "cancelledcheque": "/assets/customer-claim/stage3-document-icons/accounts-finance.png",
  "tpaffidavit": "/assets/customer-claim/stage3-document-icons/documents.png",
  "authorizationletter": "/assets/customer-claim/stage3-document-icons/claim-documents.png",
  "driverstatement": "/assets/customer-claim/stage3-document-icons/claim-documents.png",
  "claimform": "/assets/customer-claim/stage3-document-icons/claim-documents.png",
};

function Stage3DocumentArtwork({ documentType }: { documentType: string }) {
  const normalized = documentType.toLowerCase().replace(/[^a-z0-9]/g, "");
  const src = STAGE3_DOCUMENT_ARTWORK[normalized] ?? "/assets/customer-claim/stage3-document-icons/claim-documents.png";
  return <Image src={src} alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" unoptimized />;
}

function StatusBadge({ tone, label }: { tone: "green" | "amber" | "slate"; label: string }) {
  const className = tone === "green" ? "border-green-200 bg-green-100 text-green-700" : tone === "amber" ? "border-amber-200 bg-amber-100 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-600";
  return <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${className}`}>{label}</span>;
}

function latestVerificationForDocument(document: FinalVerificationDocument, verifications: FinalVerificationRow[]) {
  return verifications.find((verification) => verification.document_id === document.id);
}

function isDocumentVerified(document: FinalVerificationDocument, verifications: FinalVerificationRow[]) {
  const verification = latestVerificationForDocument(document, verifications);
  return document.verification_status === "verified" || Boolean(verification?.is_valid);
}

function fallbackVerification(claim: ClaimContext, item: Stage3DocumentVerificationItem, document: FinalVerificationDocument): FinalVerificationRow {
  return {
    id: `fallback-${document.id}`,
    claim_id: claim.id,
    document_id: document.id,
    document_type: document.document_type || item.documentType,
    verification_type: item.verificationKey === "rc" ? "rc" : item.verificationKey === "insurance" ? "insurance" : "document",
    incident_date: claim.accident_at ?? null,
    is_valid: true,
    invalid_reason: null,
    details: { document_type: document.document_type || item.documentType, document_id: document.id, file_name: document.file_name, verified: true, note: "This document is verified, but detailed fields were not found in verification history." },
    created_at: document.created_at ?? new Date().toISOString(),
  };
}
