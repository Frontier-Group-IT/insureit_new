"use client";

import { useState, useTransition } from "react";
import { Trash2, TriangleAlert, X } from "lucide-react";
import { permanentDeleteEntity, type PermanentDeleteKind } from "@/app/admin-permanent-delete-actions";

export function PermanentDeleteButton({
  kind,
  id,
  relatedId,
  label,
  name,
  compact = false,
}: {
  kind: PermanentDeleteKind;
  id: string;
  relatedId?: string;
  label?: string;
  name: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function close() {
    if (pending) return;
    setOpen(false);
    setMessage(null);
    setSuccess(false);
  }

  function confirm() {
    setMessage(null);
    startTransition(async () => {
      const result = await permanentDeleteEntity(kind, id, relatedId);
      setMessage(result.message);
      setSuccess(result.status === "success");
      if (result.status === "success") {
        window.setTimeout(() => window.location.reload(), 700);
      }
    });
  }

  const entityLabel = kind === "user" ? "employee" : kind;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact
          ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[9px] font-bold text-red-600 transition hover:bg-red-50"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label ?? "Delete"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071D49]/35 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="permanent-delete-title">
          <div className="w-full max-w-[360px] rounded-2xl border border-white/80 bg-white p-4 shadow-[0_24px_70px_rgba(7,29,73,0.24)]">
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
              <div className={\`mt-3 rounded-xl px-3 py-2 text-[10.5px] font-medium \${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}\`}>
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
        </div>
      ) : null}
    </>
  );
}
