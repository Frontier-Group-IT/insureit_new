"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import {
  deleteIntermediaryAccount,
  type IntermediaryDeletionMode,
} from "./account-delete-actions";

type Props = {
  applicationId: string;
  accountContext: "partner" | "posp" | "misp";
  accountIdentifier: string | null;
  linkedAccountCount: number;
};

export function AccountDeleteControl({
  applicationId,
  accountContext,
  accountIdentifier,
  linkedAccountCount,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const normalizedPath = pathname.replace(/\/$/, "");
  const expectedPath = `/intermediaries/applications/${applicationId}`;
  if (normalizedPath !== expectedPath) return null;

  const deletionMode: IntermediaryDeletionMode = accountContext === "partner" ? "partner" : "child";
  const accountLabel = accountContext === "partner" ? "Partner" : accountContext.toUpperCase();
  const confirmationPhrase = accountIdentifier || "DELETE";
  const canConfirm = confirmation.trim() === confirmationPhrase && !isPending;

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  function submitDeletion() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteIntermediaryAccount(applicationId, deletionMode);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.replace(result.redirectTo);
        router.refresh();
      } catch {
        setError("The account could not be deleted. No database records were intentionally removed.");
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, isPending]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-[0_12px_32px_rgba(15,23,42,.18)] transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        aria-label={`Delete ${accountLabel} account`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete {accountLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" aria-hidden={false}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="delete-account-title" className="text-lg font-semibold text-slate-950">
                    {deletionMode === "partner" ? "Delete Partner and linked accounts?" : `Delete this ${accountLabel} account?`}
                  </h2>
                  <p id="delete-account-description" className="mt-1 text-sm leading-6 text-slate-600">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                aria-label="Close delete warning"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm leading-6 text-red-900">
                {deletionMode === "partner" ? (
                  <>
                    The Partner record{accountIdentifier ? ` ${accountIdentifier}` : ""} and {linkedAccountCount} linked POSP/MISP account{linkedAccountCount === 1 ? "" : "s"} will be deleted together. Registrations, workflow history, portal access and linked onboarding documents will also be removed.
                  </>
                ) : (
                  <>
                    Only this {accountLabel} account{accountIdentifier ? ` (${accountIdentifier})` : ""} will be deleted. Its parent Partner will remain active and a new linked account can be created later.
                  </>
                )}
              </div>

              <label className="block text-sm font-medium text-slate-800" htmlFor="delete-confirmation">
                Type <span className="select-all font-mono font-semibold text-red-700">{confirmationPhrase}</span> to confirm
              </label>
              <input
                ref={inputRef}
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
              />

              {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDeletion}
                disabled={!canConfirm}
                aria-busy={isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {isPending ? "Deleting…" : deletionMode === "partner" ? "Delete Partner and linked accounts" : `Delete ${accountLabel}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
