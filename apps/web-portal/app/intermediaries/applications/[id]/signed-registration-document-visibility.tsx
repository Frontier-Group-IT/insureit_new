"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { DocumentVisualCard } from "@/components/document-visual-card";
import { secondaryActionClassName } from "@/components/action-styles";

type SignedDocument = {
  file_name: string;
  verification_status: string;
  created_at: string;
  signed_url: string | null;
};

export function SignedRegistrationDocumentVisibility({ applicationId }: { applicationId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [document, setDocument] = useState<SignedDocument | null>(null);

  useEffect(() => {
    const reviewPath = `/intermediaries/applications/${applicationId}`;
    const workflowPath = `${reviewPath}/workflow`;
    const onReviewPage = pathname === reviewPath;
    const onDocumentsPage = pathname === workflowPath && searchParams.get("stage") === "documents";

    if (!onReviewPage && !onDocumentsPage) {
      setTarget(null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/intermediary-registration/signed?application_id=${encodeURIComponent(applicationId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as { document?: SignedDocument | null } | null;
        if (!response.ok) throw new Error("Signed registration form could not be loaded.");
        return result;
      })
      .then((result) => {
        if (!cancelled) setDocument(result?.document ?? null);
      })
      .catch(() => {
        if (!cancelled) setDocument(null);
      });

    const locate = () => {
      if (window.document.querySelector('[data-document-type="signed_registration_form"]')) {
        setTarget(null);
        return true;
      }

      const firstDocumentCard = window.document.querySelector<HTMLElement>(".document-visual-card[data-document-type]");
      const grid = firstDocumentCard?.parentElement;
      if (grid && grid.classList.contains("grid")) {
        setTarget(grid);
        return true;
      }
      return false;
    };

    locate();
    const observer = new MutationObserver(() => locate());
    observer.observe(window.document.body, { childList: true, subtree: true });
    const stop = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(stop);
      setTarget(null);
    };
  }, [applicationId, pathname, searchParams]);

  if (!target || !document) return null;

  return createPortal(
    <DocumentVisualCard
      type="signed_registration_form"
      title="Signed Registration Certificate"
      fileName={document.file_name}
      required
      tone="uploaded"
      status="Uploaded"
      meta={document.created_at}
      compact
      action={document.signed_url ? (
        <a
          href={document.signed_url}
          target="_blank"
          rel="noreferrer"
          className={`${secondaryActionClassName} h-8 rounded-lg px-3 text-[9px]`}
        >
          Open
        </a>
      ) : null}
    />,
    target,
  );
}
