"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { IntermediaryDocumentGrid } from "@/components/intermediary-document-grid";

type ContextPayload = {
  ok?: boolean;
  legacy?: boolean;
  has_gst?: boolean;
  documents?: Array<{
    document_type: string;
    document_label?: string | null;
    file_name: string;
    href?: string | null;
  }>;
};

export function IntermediaryDocumentReviewPortal() {
  const pathname = usePathname();
  const applicationId = pathname.match(/^\/intermediaries\/applications\/([^/]+)\/?$/)?.[1] ?? null;
  const [payload, setPayload] = useState<ContextPayload | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPayload(null);
    if (!applicationId) return;
    let cancelled = false;

    void fetch(`/api/intermediary-documents/context?application_id=${encodeURIComponent(applicationId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as ContextPayload | null;
        if (!response.ok || !result?.ok) throw new Error("Document context unavailable");
        return result;
      })
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch(() => {
        // Keep the server-rendered checklist when the enhancement cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    setTarget(null);
    if (!applicationId || !payload?.ok) return;
    const section = globalThis.document.getElementById("documents");
    if (!section) return;

    const existing = section.firstElementChild as HTMLElement | null;
    const mount = globalThis.document.createElement("div");
    mount.dataset.intermediaryDocumentPortal = "true";
    if (existing) existing.style.display = "none";
    section.appendChild(mount);
    setTarget(mount);

    return () => {
      setTarget(null);
      mount.remove();
      if (existing) existing.style.display = "";
    };
  }, [applicationId, payload]);

  if (!target || !applicationId || !payload?.ok) return null;

  return createPortal(
    <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#E1E7FF] bg-[#F1F4FF] text-[#4F46E5]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5" aria-hidden="true">
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M15 3v5h5M9 13h6M9 17h6" />
          </svg>
        </span>
        <div>
          <h2 className="text-[13px] font-semibold text-[#17203A]">Documents</h2>
          <p className="mt-0.5 text-[9.5px] font-medium text-[#64748B]">Ten-slot checklist for identity, bank, qualification and named supporting files.</p>
        </div>
      </div>
      <IntermediaryDocumentGrid
        applicationId={applicationId}
        documents={payload.documents ?? []}
        legacy={payload.legacy === true}
        hasGst={payload.has_gst === true}
        editable={false}
      />
    </section>,
    target,
  );
}
