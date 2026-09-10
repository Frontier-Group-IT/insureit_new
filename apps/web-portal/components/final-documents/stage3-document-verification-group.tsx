"use client";

import Link from "next/link";
import { Camera, Check, ContactRound, FileText, Mic, ShieldCheck, Truck, Video } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ClaimDocumentCollapsedStatus } from "@/components/claim-manager/claim-document-collapsed-status";
import { DocumentVerificationDetailsButton } from "@/components/spot-survey/document-verification-details-button";
import { ReplaceDocumentButton } from "@/components/spot-survey/replace-document-button";
import { RequestReuploadButton } from "@/components/spot-survey/request-reupload-button";
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
      className={`rounded-xl border bg-white p-2.5 shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${allVerified ? "border-green-200" : "border-[#E2EAF4]"} ${hasMultipleFiles ? "cursor-pointer" : ""}`}
    >
      <div className={`flex items-center justify-between gap-2 ${showDocumentRows || hasNoFiles ? "mb-2" : ""}`}>
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
            <DocumentTypeHeaderIcon itemKey={item.visualKey} />
            <h2 className="truncate text-[13px] font-semibold leading-tight text-[#071D49]">{item.title}</h2>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DocumentTypeHeaderIcon itemKey={item.visualKey} />
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
            <ClaimDocumentCollapsedStatus verifiedCount={verifiedFileCount} pendingCount={pendingFileCount} />
          </div>
        ) : null
      ) : (
        <div id={contentId} className="flex min-h-11 items-center gap-2">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.accent}`}><div className="text-[22px] leading-none">{item.icon}</div></div>
          <ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentType={item.documentType} label={item.title} actionLabel="Upload" />
        </div>
      )}
    </article>
  );
}

function DocumentFileRow({ item, claim, document, verification, verified, rejected, selected, onSelectedChange }: { item: Stage3DocumentVerificationItem; claim: ClaimContext; document: FinalVerificationDocument; verification?: FinalVerificationRow; verified: boolean; rejected: boolean; selected: boolean; onSelectedChange: (checked: boolean) => void }) {
  const selectable = !verified && !rejected;
  return (
    <div className="grid grid-cols-[24px_32px_1fr] items-start gap-2 rounded-lg border border-[#E2EAF4] bg-white/80 p-2">
      <div className="grid min-h-8 place-items-center">
        {verified ? (
          <span className="grid h-5 w-5 place-items-center rounded border border-green-300 bg-green-50 text-green-700" aria-label="Verified file"><Check aria-hidden="true" size={14} strokeWidth={2.6} /></span>
        ) : (
          <label className={`grid h-5 w-5 place-items-center rounded border transition ${selectable ? selected ? "cursor-pointer border-[#174EA6] bg-[#174EA6] text-white" : "cursor-pointer border-[#AFC0D5] bg-white text-transparent hover:border-[#174EA6]" : "cursor-not-allowed border-slate-200 bg-slate-100 text-transparent"}`}>
            <input type="checkbox" className="sr-only" checked={selected} disabled={!selectable} onChange={(event) => onSelectedChange(event.target.checked)} aria-label={`Select ${document.file_name} for verification`} />
            <Check aria-hidden="true" size={13} strokeWidth={2.6} />
          </label>
        )}
      </div>
      <div className="grid h-8 w-8 place-items-center"><DocumentTypeHeaderIcon itemKey={item.visualKey} /></div>
      <div className="min-w-0">
        <p className="flex min-h-8 items-center truncate text-[11px] font-semibold text-[#071D49]">{document.file_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="rounded bg-[#F4F7FC] px-1.5 py-0.5 text-[9px] font-semibold text-[#526178]">{item.documentType}</span>
          <Link href={document.signedUrl} target="_blank" className="rounded bg-[#EAF7F0] px-1.5 py-0.5 text-[9px] font-semibold text-[#00875A]">Preview</Link>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${verified ? "bg-green-50 text-green-700" : rejected ? "bg-amber-50 text-amber-700" : "bg-[#F4F7FC] text-[#526178]"}`}>{verified ? "Verified" : rejected ? "Reupload requested" : "Pending"}</span>
        </div>
        {rejected ? <p className="mt-1 text-[9px] font-semibold text-amber-700">{document.rejection_reason ?? "Customer reupload requested."}</p> : null}
        <div className={`mt-2 grid gap-1.5 ${verified ? "grid-cols-3" : "grid-cols-2"}`}>
          {verified ? <DocumentVerificationDetailsButton document={document} verification={verification ?? fallbackVerification(claim, item, document)} title={item.title} /> : null}
          <RequestReuploadButton claimId={claim.id} documentId={document.id} documentTitle={item.title} />
          <ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentId={document.id} documentType={item.documentType} label={item.title} actionLabel="Replace" />
        </div>
      </div>
    </div>
  );
}

function DocumentTypeHeaderIcon({ itemKey }: { itemKey: Stage3DocumentVerificationItem["visualKey"] }) {
  const baseClassName = "h-5 w-5 shrink-0";
  if (itemKey === "spot") return <Camera aria-hidden="true" className={`${baseClassName} text-[#F037A5]`} strokeWidth={2.2} />;
  if (itemKey === "rc") return <FileText aria-hidden="true" className={`${baseClassName} text-[#16A36A]`} strokeWidth={2.2} />;
  if (itemKey === "insurance") return <ShieldCheck aria-hidden="true" className={`${baseClassName} text-[#2563EB]`} strokeWidth={2.2} />;
  if (itemKey === "dl") return <ContactRound aria-hidden="true" className={`${baseClassName} text-[#9333EA]`} strokeWidth={2.2} />;
  if (itemKey === "gr") return <Truck aria-hidden="true" className={`${baseClassName} text-[#EA7A16]`} strokeWidth={2.2} />;
  if (itemKey === "video") return <Video aria-hidden="true" className={`${baseClassName} text-[#EF233C]`} strokeWidth={2.2} />;
  if (itemKey === "audio") return <Mic aria-hidden="true" className={`${baseClassName} text-[#0A43A3]`} strokeWidth={2.2} />;
  return <FileText aria-hidden="true" className={`${baseClassName} text-[#071D49]`} strokeWidth={2.2} />;
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
