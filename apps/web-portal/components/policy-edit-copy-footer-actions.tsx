"use client";

import { Files, FileText, RefreshCw, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openPolicyCopy } from "@/app/policies/policy-document-actions";
import {
  getPolicyCopyForEdit,
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
  const saveButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const label = button.textContent?.trim() ?? "";
    return label === "Save Policy Changes" || label.toLowerCase().includes("saving policy");
  });
  return saveButton?.parentElement ?? null;
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
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!policyId) {
      setFooter(null);
      return;
    }

    let boundFooter: HTMLElement | null = null;
    let previousAlignItems = "";
    const bind = () => {
      const nextFooter = findEditFooter();
      if (nextFooter !== boundFooter) {
        if (boundFooter) boundFooter.style.alignItems = previousAlignItems;
        boundFooter = nextFooter;
        previousAlignItems = nextFooter?.style.alignItems ?? "";
        if (nextFooter) nextFooter.style.alignItems = "center";
      }
      setFooter(nextFooter);
    };
    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (boundFooter) boundFooter.style.alignItems = previousAlignItems;
    };
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

  async function viewPolicy() {
    if (!policyCopy || isOpening) return;
    setIsOpening(true);
    setNotice(null);

    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;

    try {
      const result = await openPolicyCopy(policyCopy.id);
      if (!result.ok) {
        previewWindow?.close();
        setNotice({ tone: "error", message: result.error });
        return;
      }

      if (previewWindow) previewWindow.location.href = result.url;
      else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      previewWindow?.close();
      setNotice({ tone: "error", message: "Could not open the policy copy. Please try again." });
    } finally {
      setIsOpening(false);
    }
  }

  async function uploadPolicyCopy(file: File) {
    if (!policyId || isUploading) return;
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
                  onClick={() => void viewPolicy()}
                  disabled={isOpening || isUploading}
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
                  disabled={isUploading || isOpening}
                  aria-label="Replace policy copy"
                  title="Replace policy copy"
                  className="inline-flex w-9 items-center justify-center bg-[#EEF5FF] transition hover:bg-[#E2ECFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9CB9E6] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isUploading ? "animate-spin" : ""}`} />
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
              disabled={isUploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] px-3 text-[10px] font-semibold text-[#174EA6] transition hover:bg-[#EEF5FF] disabled:cursor-wait disabled:opacity-60"
            >
              <Upload className={`h-3.5 w-3.5 ${isUploading ? "animate-pulse" : ""}`} />
              {isUploading ? "Uploading…" : "Add Policy Copy"}
            </button>
          )}
        </div>,
        footer,
      )}

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
