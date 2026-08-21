"use client";

import { Files, FileText, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPolicyCopyForEdit,
  removePolicyCopyForEdit,
  savePolicyCopyForEdit,
  type PolicyEditCopy,
} from "@/app/policies/policy-edit-document-actions";

const acceptedPolicyCopyTypes = ".pdf,.jpg,.jpeg,.png,.webp";

type Notice = { tone: "success" | "error"; message: string } | null;

function policyIdFromPath(pathname: string) {
  const match = pathname.match(/^\/policies\/([0-9a-f-]{36})\/edit\/?$/i);
  return match?.[1] ?? null;
}

function findEditFooter() {
  return document.querySelector<HTMLElement>("[data-policy-edit-action-footer]");
}

export function PolicyEditCopyFooterActions() {
  const pathname = usePathname();
  const policyId = policyIdFromPath(pathname);
  const inputRef = useRef<HTMLInputElement>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [policyCopy, setPolicyCopy] = useState<PolicyEditCopy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!policyId) {
      setFooter(null);
      return;
    }

    const bind = () => setFooter(findEditFooter());
    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [policyId]);

  useEffect(() => {
    if (!policyId) {
      setPolicyCopy(null);
      setNotice(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setNotice(null);
    void getPolicyCopyForEdit(policyId)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setPolicyCopy(result.document);
          return;
        }
        setNotice({ tone: "error", message: result.error });
      })
      .catch(() => {
        if (active) setNotice({ tone: "error", message: "Could not load the policy copy. Please try again." });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [policyId]);

  useEffect(() => {
    if (notice?.tone !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!removeConfirmOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRemoving) setRemoveConfirmOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeConfirmOpen, isRemoving]);

  function viewPolicy() {
    if (!policyCopy || isOpening || isRemoving) return;
    setIsOpening(true);
    setNotice(null);

    const openerUrl = `/policies/documents/${encodeURIComponent(policyCopy.id)}/open`;
    const previewWindow = window.open(openerUrl, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      setNotice({ tone: "error", message: "Could not open the policy copy. Allow pop-ups and try again." });
    }
    setIsOpening(false);
  }

  async function uploadPolicyCopy(file: File) {
    if (!policyId || isUploading || isRemoving) return;
    setIsUploading(true);
    setNotice(null);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const result = await savePolicyCopyForEdit(policyId, formData);
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error });
        return;
      }
      setPolicyCopy(result.document);
      setNotice({
        tone: "success",
        message: policyCopy ? "Policy copy replaced successfully." : "Policy copy added successfully.",
      });
    } catch {
      setNotice({ tone: "error", message: "Policy copy could not be uploaded. Please try again." });
    } finally {
      setIsUploading(false);
    }
  }

  async function removePolicyCopy() {
    if (!policyId || !policyCopy || isRemoving) return;
    setIsRemoving(true);
    setNotice(null);

    try {
      const result = await removePolicyCopyForEdit(policyId);
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error });
        return;
      }
      setPolicyCopy(null);
      setRemoveConfirmOpen(false);
      setNotice({ tone: "success", message: "Policy copy removed successfully." });
    } catch {
      setNotice({ tone: "error", message: "Policy copy could not be removed. Please try again." });
    } finally {
      setIsRemoving(false);
    }
  }

  if (!policyId || !footer) return null;

  return (
    <>
      {createPortal(
        <div className="order-first mr-auto flex min-w-0 items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={acceptedPolicyCopyTypes}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.currentTarget.value = "";
              if (file) void uploadPolicyCopy(file);
            }}
          />

          {isLoading ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D9E2F0] bg-white px-3 text-[10px] font-semibold text-[#667085]">
              <FileText className="h-3.5 w-3.5" />
              Policy Copy
            </span>
          ) : policyCopy ? (
            <div className="flex min-w-0 flex-col items-start gap-1">
              <div
                role="group"
                aria-label="Policy copy actions"
                className="inline-flex h-9 items-stretch overflow-hidden rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] text-[#174EA6]"
              >
                <button
                  type="button"
                  onClick={viewPolicy}
                  disabled={isOpening || isUploading || isRemoving}
                  aria-label="View policy copy"
                  title={policyCopy.fileName ? `View policy: ${policyCopy.fileName}` : "View policy copy"}
                  className="inline-flex min-w-0 items-center gap-2 px-3 text-[10px] font-semibold transition hover:bg-[#EEF5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9CB9E6] disabled:cursor-wait disabled:opacity-60"
                >
                  <Files className="h-3.5 w-3.5 shrink-0" />
                  {isOpening ? "Opening…" : "View Policy"}
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading || isOpening || isRemoving}
                  aria-label="Replace policy copy"
                  title="Replace policy copy"
                  className="inline-flex w-9 items-center justify-center bg-[#DBEAFE] text-[#2563EB] transition hover:bg-[#BFDBFE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#93C5FD] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isUploading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveConfirmOpen(true)}
                  disabled={isUploading || isOpening || isRemoving}
                  aria-label="Remove policy copy"
                  title="Remove policy copy"
                  className="inline-flex w-9 items-center justify-center border-l border-[#F2D5D1] bg-[#FFF5F3] text-[#B5534F] transition hover:bg-[#FDE9E6] hover:text-[#9E403C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9AAA3] disabled:cursor-wait disabled:opacity-60"
                >
                  {isRemoving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
              <span
                title={policyCopy.fileName}
                className="max-w-[190px] truncate pl-1 text-[8px] font-medium leading-3 text-[#6B7A90]"
              >
                {policyCopy.fileName}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || isRemoving}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] px-3 text-[10px] font-semibold text-[#174EA6] transition hover:bg-[#EEF5FF] disabled:cursor-wait disabled:opacity-60"
            >
              <Upload className={`h-3.5 w-3.5 ${isUploading ? "animate-pulse" : ""}`} />
              {isUploading ? "Uploading…" : "Add Policy Copy"}
            </button>
          )}
        </div>,
        footer,
      )}

      {removeConfirmOpen && policyCopy ? createPortal(
        <div className="fixed inset-0 z-[170] grid place-items-center bg-[#0F2544]/35 px-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isRemoving) setRemoveConfirmOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="remove-policy-copy-title" className="w-full max-w-[410px] overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white shadow-[0_24px_70px_rgba(15,37,68,.24)]">
            <div className="flex items-start gap-3 px-5 pb-4 pt-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#F3D8D4] bg-[#FFF5F3] text-[#B5534F]">
                <Trash2 className="h-[17px] w-[17px]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 id="remove-policy-copy-title" className="text-[13px] font-bold text-[#17203A]">Remove policy document?</h3>
                <p className="mt-1.5 text-[10px] leading-[1.55] text-[#667085]">
                  This will remove the attached policy copy from this policy. You can upload a new copy again at any time.
                </p>
                <p className="mt-2 max-w-[300px] truncate rounded-lg bg-[#F8FAFC] px-2.5 py-1.5 text-[9px] font-semibold text-[#526277]" title={policyCopy.fileName}>
                  {policyCopy.fileName}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#EDF1F5] bg-[#FBFCFE] px-5 py-3.5">
              <button type="button" onClick={() => setRemoveConfirmOpen(false)} disabled={isRemoving} className="rounded-xl border border-[#D8E0EA] bg-white px-3.5 py-2 text-[9.5px] font-semibold text-[#475467] transition hover:bg-[#F6F8FB] disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={() => void removePolicyCopy()} disabled={isRemoving} className="inline-flex min-w-[118px] items-center justify-center gap-1.5 rounded-xl border border-[#EDC9C5] bg-[#FFF1EF] px-3.5 py-2 text-[9.5px] font-bold text-[#A84843] transition hover:bg-[#FDE3E0] hover:text-[#913B37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3CBC7] disabled:cursor-wait disabled:opacity-65">
                {isRemoving ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Removing…</> : <><Trash2 className="h-3.5 w-3.5" />Remove document</>}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`fixed bottom-20 right-4 z-[140] flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.18)] ${notice.tone === "error" ? "border-amber-200" : "border-emerald-200"}`}
        >
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${notice.tone === "error" ? "bg-amber-500" : "bg-emerald-500"}`} />
          <p className="min-w-0 flex-1 text-[10px] font-semibold leading-4 text-[#334155]">{notice.message}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss policy copy notice" className="text-[16px] leading-none text-[#64748B]">×</button>
        </div>
      ) : null}
    </>
  );
}
