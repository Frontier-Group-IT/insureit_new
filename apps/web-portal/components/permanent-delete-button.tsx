"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Trash2, TriangleAlert, X } from "lucide-react";

type PermanentDeleteKind = "user" | "branch" | "partner";
type PermanentDeleteResult = { status: "success" | "error"; message: string };

export function PermanentDeleteButton({
  kind,
  id,
  relatedId,
  label,
  name,
  compact = false,
  iconOnly = false,
}: {
  kind: PermanentDeleteKind;
  id: string;
  relatedId?: string;
  label?: string;
  name: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setMessage(null);
    setSuccess(false);
  }

  function positionPopup() {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(360, Math.max(280, window.innerWidth - 16));
    const viewportPadding = 8;
    const gap = 8;
    const popupHeight = popupRef.current?.offsetHeight ?? 260;

    let left = rect.right - width;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));

    let top = rect.bottom + gap;
    if (top + popupHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - popupHeight - gap);
    }

    setPosition({ top, left, width });
  }

  useLayoutEffect(() => {
    if (!open) return;
    positionPopup();
  }, [open, message, pending]);

  useEffect(() => {
    if (!open) return;
    const update = () => positionPopup();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  function confirm() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/permanent-delete", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, id, relatedId }),
        });
        const result = await response.json().catch(() => null) as PermanentDeleteResult | null;
        if (!result || (result.status !== "success" && result.status !== "error")) {
          throw new Error("Invalid delete response");
        }
        setMessage(result.message);
        setSuccess(result.status === "success");
        if (result.status === "success") {
          window.setTimeout(() => window.location.reload(), 700);
        }
      } catch {
        setSuccess(false);
        setMessage("The delete request could not complete. Your data has not been changed. Please retry after refreshing the page.");
      }
    });
  }

  const entityLabel = kind === "user" ? "user" : kind;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setMessage(null);
          setSuccess(false);
          setOpen(true);
        }}
        aria-label={iconOnly ? `Delete ${name}` : undefined}
        title={iconOnly ? "Delete" : undefined}
        className={iconOnly ? "inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500" : compact
          ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[9px] font-bold text-red-600 transition hover:bg-red-50"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {!iconOnly ? (label ?? "Delete") : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close delete confirmation"
              className="fixed inset-0 z-[99] cursor-default bg-[#071D49]/10"
              onClick={close}
              disabled={pending}
            />
            <div
              ref={popupRef}
              className="fixed z-[100] rounded-2xl border border-white/80 bg-white p-4 shadow-[0_24px_70px_rgba(7,29,73,0.24)]"
              style={position ? { top: position.top, left: position.left, width: position.width } : { visibility: "hidden", width: 360 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="permanent-delete-title"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                  <TriangleAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="permanent-delete-title" className="text-[14px] font-extrabold text-[#10213D]">
                    Permanently delete {entityLabel}?
                  </h2>
                  <p className="mt-1 truncate text-[11px] font-semibold text-[#42526B]">{name}</p>
                </div>
                <button type="button" onClick={close} disabled={pending} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-5 text-[#667085]">
                This action cannot be undone. The record and any removable login access will be permanently deleted. Protected business history will prevent deletion.
              </p>

              {message ? (
                <div className={`mt-3 rounded-xl px-3 py-2 text-[10.5px] font-medium ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {message}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="h-9 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-[#334155] hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending || success}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-[11px] font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {pending ? "Checking..." : success ? "Deleted" : "Delete permanently"}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
        : null}
    </>
  );
}
