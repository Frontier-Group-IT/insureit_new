"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { uploadPolicyCopy } from "@/app/policies/policy-document-actions";

type SaveChoice = "upload" | "without" | null;
type UploadNotice = { tone: "uploading" | "success" | "error"; message: string } | null;

const allowedTypes = ".pdf,.jpg,.jpeg,.png,.webp";
const maxFileBytes = 50 * 1024 * 1024;
const legacySaveButtonLabel = "Book Active Policy";
const saveButtonLabel = "Upload Policy";
const registrationPattern = /^(?:[A-Z]{2}[A-Z0-9]*[0-9]{2}|\d{2}BH\d{4}[A-HJ-NP-Z]{1,2})$/;

function hasUiValidationFailure() {
  const requiredControls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input[required], select[required], textarea[required]",
    ),
  );

  if (requiredControls.some((control) => !control.disabled && !control.checkValidity())) return true;

  const registrationInput = document.querySelector<HTMLInputElement>('input[placeholder="MP20AB1234"]');
  if (
    registrationInput &&
    !registrationInput.disabled &&
    !registrationPattern.test(registrationInput.value.trim().toUpperCase())
  ) {
    return true;
  }

  const phoneInput = document.querySelector<HTMLInputElement>('input[placeholder="Mandatory 10 digit mobile"]');
  if (phoneInput && !phoneInput.disabled && phoneInput.value.replace(/\D/g, "").length !== 10) return true;

  return false;
}

export function PolicySaveConfirmation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<SaveChoice>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<UploadNotice>(null);
  const pendingButton = useRef<HTMLButtonElement | null>(null);
  const bypassNextClick = useRef(false);
  const pendingUploadFile = useRef<File | null>(null);
  const pendingPolicyCode = useRef<string | null>(null);
  const uploadAttemptKey = useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== "/policies/new") return;

    let boundButton: HTMLButtonElement | null = null;

    function intercept(event: MouseEvent) {
      if (bypassNextClick.current) {
        bypassNextClick.current = false;
        return;
      }

      // Preserve the existing validation behavior: invalid form values continue
      // through the original PolicyUnifiedForm click handler and do not open this modal.
      if (hasUiValidationFailure()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pendingButton.current = boundButton;
      pendingUploadFile.current = null;
      pendingPolicyCode.current = null;
      uploadAttemptKey.current = null;
      setChoice(null);
      setFile(null);
      setFileError(null);
      setUploadNotice(null);
      setOpen(true);
    }

    function findSaveButton() {
      return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const label = button.textContent?.trim();
        return label === saveButtonLabel || label === legacySaveButtonLabel;
      }) ?? null;
    }

    function bindSaveButton() {
      const nextButton = findSaveButton();

      if (nextButton && nextButton.textContent?.trim() !== saveButtonLabel) {
        nextButton.textContent = saveButtonLabel;
      }

      if (nextButton === boundButton) return;

      if (boundButton) boundButton.removeEventListener("click", intercept, true);
      boundButton = nextButton;
      if (boundButton) boundButton.addEventListener("click", intercept, true);
    }

    bindSaveButton();
    const observer = new MutationObserver(bindSaveButton);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (boundButton) boundButton.removeEventListener("click", intercept, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/policies" || !pendingUploadFile.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "policy_created") return;
    const policyCode = params.get("policy")?.trim();
    if (!policyCode) return;

    const fileToUpload = pendingUploadFile.current;
    const attemptKey = `${policyCode}:${fileToUpload.name}:${fileToUpload.size}:${fileToUpload.lastModified}`;
    if (uploadAttemptKey.current === attemptKey) return;

    uploadAttemptKey.current = attemptKey;
    pendingPolicyCode.current = policyCode;
    setUploadNotice({ tone: "uploading", message: "Policy saved. Uploading policy copy…" });

    const formData = new FormData();
    formData.set("file", fileToUpload);
    void uploadPolicyCopy(policyCode, formData).then((result) => {
      if (result.ok) {
        pendingUploadFile.current = null;
        pendingPolicyCode.current = null;
        setUploadNotice({ tone: "success", message: "Policy saved and policy copy uploaded successfully." });
        return;
      }
      setUploadNotice({ tone: "error", message: result.error });
    }).catch(() => {
      setUploadNotice({ tone: "error", message: "Policy was saved, but the policy copy upload failed. You can retry without creating another policy." });
    });
  }, [pathname]);

  useEffect(() => {
    if (uploadNotice?.tone !== "success") return;

    const timer = window.setTimeout(() => setUploadNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [uploadNotice]);

  function close() {
    setOpen(false);
    setChoice(null);
    setFile(null);
    setFileError(null);
    pendingButton.current = null;
    pendingUploadFile.current = null;
    pendingPolicyCode.current = null;
    uploadAttemptKey.current = null;
  }

  function selectFile(nextFile: File | null) {
    if (!nextFile) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (nextFile.size > maxFileBytes) {
      setFile(null);
      setFileError("Policy copy must be 50 MB or smaller.");
      return;
    }
    setFile(nextFile);
    setFileError(null);
  }

  function continueSave() {
    if (!choice) return;
    if (choice === "upload" && !file) return;
    const button = pendingButton.current;
    if (!button) return;

    pendingUploadFile.current = choice === "upload" ? file : null;
    pendingPolicyCode.current = null;
    uploadAttemptKey.current = null;
    setOpen(false);
    bypassNextClick.current = true;
    queueMicrotask(() => button.click());
  }

  function retryUpload() {
    const fileToUpload = pendingUploadFile.current;
    const policyCode = pendingPolicyCode.current;
    if (!fileToUpload || !policyCode) return;

    uploadAttemptKey.current = null;
    setUploadNotice({ tone: "uploading", message: "Retrying policy copy upload…" });
    const formData = new FormData();
    formData.set("file", fileToUpload);
    void uploadPolicyCopy(policyCode, formData).then((result) => {
      if (result.ok) {
        pendingUploadFile.current = null;
        pendingPolicyCode.current = null;
        setUploadNotice({ tone: "success", message: "Policy copy uploaded successfully." });
        return;
      }
      setUploadNotice({ tone: "error", message: result.error });
    }).catch(() => {
      setUploadNotice({ tone: "error", message: "Policy copy upload failed again. The policy itself is already saved." });
    });
  }

  const saveDisabled = !choice || (choice === "upload" && !file);

  return (
    <>
      {uploadNotice ? (
        <div className="fixed right-4 top-20 z-[140] w-[min(380px,calc(100vw-2rem))] rounded-xl border border-[#D9E2F0] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.18)]" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${uploadNotice.tone === "success" ? "bg-emerald-500" : uploadNotice.tone === "error" ? "bg-amber-500" : "animate-pulse bg-[#315B9A]"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold leading-4 text-[#334155]">{uploadNotice.message}</p>
              {uploadNotice.tone === "error" && pendingUploadFile.current && pendingPolicyCode.current ? (
                <button type="button" onClick={retryUpload} className="mt-2 rounded-lg border border-[#B7C5D8] bg-white px-3 py-1.5 text-[9px] font-bold text-[#17365D] hover:bg-[#F8FAFC]">Retry Upload</button>
              ) : null}
            </div>
            {uploadNotice.tone !== "uploading" ? <button type="button" onClick={() => setUploadNotice(null)} aria-label="Dismiss upload status" className="text-[16px] leading-none text-[#64748B]">×</button> : null}
          </div>
        </div>
      ) : null}

      {open && pathname === "/policies/new" ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="policy-save-title" className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_24px_70px_rgba(15,23,42,.22)]">
            <div className="border-b border-[#E7ECF3] px-5 py-4">
              <h2 id="policy-save-title" className="text-[15px] font-extrabold text-[#12203B]">Save Active Policy</h2>
              <p className="mt-1 text-[11px] leading-4 text-[#66748A]">Choose whether you want to attach the policy copy before saving.</p>
            </div>

            <div className="space-y-2.5 p-4">
              <button type="button" onClick={() => { setChoice("upload"); setFile(null); setFileError(null); }} className={`w-full rounded-xl border px-4 py-3 text-left transition ${choice === "upload" ? "border-[#315B9A] bg-[#F5F8FD] ring-2 ring-[#DCE8FA]" : "border-[#D9E2F0] bg-white hover:border-[#B8C7DA]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${choice === "upload" ? "border-[#315B9A]" : "border-[#AEB9C8]"}`}>
                    {choice === "upload" ? <span className="h-2 w-2 rounded-full bg-[#315B9A]" /> : null}
                  </span>
                  <span>
                    <span className="block text-[12px] font-bold text-[#17203A]">Upload Policy Copy</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#66748A]">Select the issued policy document and save it with this policy.</span>
                  </span>
                </div>
              </button>

              {choice === "upload" ? (
                <div className="rounded-xl border border-dashed border-[#C7D3E3] bg-[#FAFCFF] p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#D9E2F0] bg-white px-3 py-2.5 text-[10px] font-bold text-[#17365D] hover:bg-[#F8FAFC]">
                    <span className="truncate">{file ? file.name : "Choose policy copy"}</span>
                    <span className="shrink-0 rounded-lg bg-[#EEF4FB] px-2.5 py-1.5">Browse</span>
                    <input type="file" accept={allowedTypes} className="sr-only" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <p className="mt-2 text-[9px] leading-4 text-[#7A879A]">PDF, JPG, PNG or WEBP · maximum 50 MB.</p>
                  {fileError ? <p className="mt-1 text-[9px] font-semibold leading-4 text-red-600">{fileError}</p> : null}
                  {file ? <p className="mt-1 truncate text-[9px] font-semibold leading-4 text-[#315B9A]">Ready to upload: {file.name}</p> : null}
                </div>
              ) : null}

              <button type="button" onClick={() => { setChoice("without"); setFile(null); setFileError(null); }} className={`w-full rounded-xl border px-4 py-3 text-left transition ${choice === "without" ? "border-[#315B9A] bg-[#F5F8FD] ring-2 ring-[#DCE8FA]" : "border-[#D9E2F0] bg-white hover:border-[#B8C7DA]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${choice === "without" ? "border-[#315B9A]" : "border-[#AEB9C8]"}`}>
                    {choice === "without" ? <span className="h-2 w-2 rounded-full bg-[#315B9A]" /> : null}
                  </span>
                  <span>
                    <span className="block text-[12px] font-bold text-[#17203A]">Save Without Policy Copy</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#66748A]">Continue without attaching a document.</span>
                  </span>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E7ECF3] bg-[#FBFCFE] px-4 py-3">
              <button type="button" onClick={close} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#334155]">Cancel</button>
              <button type="button" onClick={continueSave} disabled={saveDisabled} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}