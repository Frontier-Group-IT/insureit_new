"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SaveChoice = "upload" | "without" | null;

const allowedTypes = ".pdf,.jpg,.jpeg,.png,.webp";

export function PolicySaveConfirmation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<SaveChoice>(null);
  const [file, setFile] = useState<File | null>(null);
  const pendingButton = useRef<HTMLButtonElement | null>(null);
  const bypassNextClick = useRef(false);

  useEffect(() => {
    if (pathname !== "/policies/new") return;

    function intercept(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      if (!target.textContent?.trim().includes("Book Active Policy")) return;

      if (bypassNextClick.current) {
        bypassNextClick.current = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pendingButton.current = target;
      setChoice(null);
      setFile(null);
      setOpen(true);
    }

    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [pathname]);

  function close() {
    setOpen(false);
    setChoice(null);
    setFile(null);
    pendingButton.current = null;
  }

  function continueSave() {
    if (choice !== "without") return;
    const button = pendingButton.current;
    if (!button) return;
    setOpen(false);
    bypassNextClick.current = true;
    queueMicrotask(() => button.click());
  }

  if (!open || pathname !== "/policies/new") return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="policy-save-title" className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_24px_70px_rgba(15,23,42,.22)]">
        <div className="border-b border-[#E7ECF3] px-5 py-4">
          <h2 id="policy-save-title" className="text-[15px] font-extrabold text-[#12203B]">Save Active Policy</h2>
          <p className="mt-1 text-[11px] leading-4 text-[#66748A]">Choose whether you want to attach the policy copy before saving.</p>
        </div>

        <div className="space-y-2.5 p-4">
          <button type="button" onClick={() => { setChoice("upload"); setFile(null); }} className={`w-full rounded-xl border px-4 py-3 text-left transition ${choice === "upload" ? "border-[#315B9A] bg-[#F5F8FD] ring-2 ring-[#DCE8FA]" : "border-[#D9E2F0] bg-white hover:border-[#B8C7DA]"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${choice === "upload" ? "border-[#315B9A]" : "border-[#AEB9C8]"}`}>
                {choice === "upload" ? <span className="h-2 w-2 rounded-full bg-[#315B9A]" /> : null}
              </span>
              <span>
                <span className="block text-[12px] font-bold text-[#17203A]">Upload Policy Copy</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-[#66748A]">Select the issued policy document before saving.</span>
              </span>
            </div>
          </button>

          {choice === "upload" ? (
            <div className="rounded-xl border border-dashed border-[#C7D3E3] bg-[#FAFCFF] p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#D9E2F0] bg-white px-3 py-2.5 text-[10px] font-bold text-[#17365D] hover:bg-[#F8FAFC]">
                <span className="truncate">{file ? file.name : "Choose policy copy"}</span>
                <span className="shrink-0 rounded-lg bg-[#EEF4FB] px-2.5 py-1.5">Browse</span>
                <input type="file" accept={allowedTypes} className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              <p className="mt-2 text-[9px] leading-4 text-[#7A879A]">PDF, JPG, PNG or WEBP.</p>
              <p className="mt-1 text-[9px] leading-4 text-[#B45309]">Policy-copy storage is intentionally not connected in this branch because no Supabase or database changes are allowed. Choose “Save Without Policy Copy” to complete policy creation.</p>
            </div>
          ) : null}

          <button type="button" onClick={() => { setChoice("without"); setFile(null); }} className={`w-full rounded-xl border px-4 py-3 text-left transition ${choice === "without" ? "border-[#315B9A] bg-[#F5F8FD] ring-2 ring-[#DCE8FA]" : "border-[#D9E2F0] bg-white hover:border-[#B8C7DA]"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${choice === "without" ? "border-[#315B9A]" : "border-[#AEB9C8]"}`}>
                {choice === "without" ? <span className="h-2 w-2 rounded-full bg-[#315B9A]" /> : null}
              </span>
              <span>
                <span className="block text-[12px] font-bold text-[#17203A]">Save Without Policy Copy</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-[#66748A]">Continue with the existing active-policy booking flow.</span>
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E7ECF3] bg-[#FBFCFE] px-4 py-3">
          <button type="button" onClick={close} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#334155]">Cancel</button>
          <button type="button" onClick={continueSave} disabled={choice !== "without"} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">Save</button>
        </div>
      </div>
    </div>
  );
}
