"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [document, setDocument] = useState<SignedDocument | null>(null);

  useEffect(() => {
    if (pathname !== `/intermediaries/applications/${applicationId}`) {
      setTarget(null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/intermediary-registration/signed?application_id=${encodeURIComponent(applicationId)}`, { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((result: { document?: SignedDocument | null }) => {
        if (!cancelled) setDocument(result.document ?? null);
      })
      .catch(() => undefined);

    const locate = () => {
      const grid = window.document.querySelector<HTMLElement>("section#documents div.grid");
      if (grid) setTarget(grid);
    };
    locate();
    const timer = window.setInterval(locate, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(stop);
      setTarget(null);
    };
  }, [applicationId, pathname]);

  if (!target || !document) return null;
  return createPortal(
    <DocumentVisualCard
      type="signed_registration_form"
      title="Signed Registration Form"
      fileName={document.file_name}
      required
      tone="uploaded"
      status="Uploaded"
      compact
      action={document.signed_url ? <a href={document.signed_url} target="_blank" rel="noreferrer" className={`${secondaryActionClassName} h-8 rounded-lg px-3 text-[9px]`}>Open</a> : null}
    />,
    target,
  );
}
