"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requestSpotSurveyDocumentReupload } from "@/app/claims/[id]/spot-survey-actions";

type Result = { ok: boolean; message?: string };

export function RequestReuploadButton({ claimId, documentId, documentTitle }: { claimId: string; documentId: string; documentTitle: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const button = triggerRef.current;
    if (!button) return;

    const actions = button.parentElement as HTMLElement | null;
    const content = actions?.parentElement as HTMLElement | null;
    const row = content?.parentElement as HTMLElement | null;

    if (actions && content && row) {
      row.style.position = "relative";
      content.style.paddingRight = "112px";
      actions.style.position = "absolute";
      actions.style.right = "8px";
      actions.style.top = "50%";
      actions.style.transform = "translateY(-50%)";
      actions.style.display = "flex";
      actions.style.width = "auto";
      actions.style.gap = "4px";
      actions.style.marginTop = "0";

      const iconTile = row.firstElementChild as HTMLElement | null;
      if (iconTile) {
        iconTile.style.background = "transparent";
        iconTile.style.borderRadius = "0";
      }

      const filename = content.firstElementChild as HTMLElement | null;
      const metaRow = Array.from(content.children).find((element) => element.querySelector?.('a[target="_blank"]')) as HTMLElement | undefined;
      const previewLink = metaRow?.querySelector<HTMLAnchorElement>('a[target="_blank"]') ?? null;

      if (filename && previewLink && filename.tagName !== "A") {
        const filenameLink = document.createElement("a");
        filenameLink.href = previewLink.href;
        filenameLink.target = "_blank";
        filenameLink.rel = "noreferrer";
        filenameLink.textContent = filename.textContent;
        filenameLink.className = `${filename.className} block cursor-pointer transition hover:text-[#174EA6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/25`;
        filenameLink.setAttribute("aria-label", `Open ${filename.textContent?.trim() || documentTitle}`);
        filenameLink.title = "Open uploaded document";
        filename.replaceWith(filenameLink);
      }

      if (metaRow) metaRow.style.display = "none";
    }

    const article = button.closest("article") as HTMLElement | null;
    if (!article) return;

    const details = Array.from(article.children).find((element) => element.tagName === "DETAILS") as HTMLDetailsElement | undefined;
    if (!details) return;

    const header = article.firstElementChild as HTMLElement | null;
    const titleGroup = header?.firstElementChild as HTMLElement | null;
    if (!header || !titleGroup) return;

    let badge = article.querySelector<HTMLElement>("[data-multi-file-count]");
    if (!badge) {
      badge = header.lastElementChild as HTMLElement | null;
      if (!badge || badge === titleGroup) return;
      badge.dataset.multiFileCount = "true";
      titleGroup.appendChild(badge);
    }

    const summary = details.querySelector<HTMLElement>(":scope > summary");
    if (!summary) return;

    badge.className = "inline-flex shrink-0 cursor-pointer items-center rounded-full border border-[#B9D2FF] bg-[#EEF5FF] px-2 py-0.5 text-[9px] font-semibold text-[#174EA6] transition hover:bg-[#E4EFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/25";
    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");
    badge.setAttribute("aria-expanded", String(details.open));
    badge.setAttribute("aria-label", `Show ${badge.textContent?.trim() || "uploaded files"}`);
    badge.setAttribute("title", "Show uploaded files");

    summary.style.display = "none";
    details.style.marginTop = details.open ? "8px" : "0";

    const toggleFiles = () => {
      details.open = !details.open;
      details.style.marginTop = details.open ? "8px" : "0";
      badge?.setAttribute("aria-expanded", String(details.open));
    };

    badge.onclick = (event) => {
      event.preventDefault();
      toggleFiles();
    };
    badge.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFiles();
      }
    };
  }, [documentTitle]);

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#071D49]/45 px-4 py-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              void (async () => {
                const formData = new FormData(event.currentTarget);
                formData.set("claimId", claimId);
                formData.set("documentId", documentId);
                try {
                  const response = await requestSpotSurveyDocumentReupload(formData);
                  setResult(response);
                  if (response.ok) router.refresh();
                } finally {
                  setPending(false);
                }
              })();
            }}
            className="w-[min(520px,calc(100vw-32px))] max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.26)]"
          >
            <div className="border-b border-[#E6EEF7] px-5 py-4">
              <h2 className="text-[18px] font-semibold text-[#071D49]">Reupload Request</h2>
              <p className="mt-1 text-[13px] text-[#4B596B]">Ask the customer to upload a fresh copy of {documentTitle}.</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="text-[12px] font-semibold text-[#071D49]">Reason shown to customer</span>
                <textarea name="reason" defaultValue={`${documentTitle} is not clear/valid. Please reupload a fresh copy.`} className="mt-1 min-h-[90px] w-full resize-none rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] text-[#071D49] outline-none focus:border-[#174EA6]" />
              </label>
              {result ? <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? "Reupload requested." : "Request failed.")}</p> : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#E6EEF7] px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#B8C5D6] px-6 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={pending || Boolean(result?.ok)} className="h-10 rounded-lg bg-[#D08700] px-7 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? "Sending..." : result?.ok ? "Requested" : "Send Reupload Request"}</button>
            </div>
          </form>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setResult(null); setOpen(true); }}
        data-document-action="reupload"
        aria-label="Request reupload"
        title="Request reupload"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-[#A35B00] transition hover:bg-[#FFF8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D08700]/30"
      >
        <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {modal}
    </>
  );
}
