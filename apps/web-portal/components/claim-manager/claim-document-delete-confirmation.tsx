"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  filename: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClaimDocumentDeleteConfirmation({ filename, pending, onCancel, onConfirm }: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, pending]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0C2147]/65 p-4 backdrop-blur-[5px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="claim-delete-title" aria-describedby="claim-delete-message" className="w-full max-w-[495px] overflow-hidden rounded-[18px] bg-white shadow-[0_20px_70px_rgba(5,20,45,.28)]">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <span className="mb-5 grid h-[54px] w-[54px] place-items-center rounded-full bg-[#FFF2E8] text-[#DE742A]"><AlertTriangle className="h-6 w-6" strokeWidth={1.8} /></span>
          <h2 id="claim-delete-title" className="text-[17px] font-bold text-[#15335B]">Delete Document?</h2>
          <p id="claim-delete-message" className="mt-3 text-[13px] text-[#75839A]">Are you sure you want to delete this document?</p>
          <p className="mt-2 max-w-full break-all text-[12px] font-medium text-[#546781]">{filename}</p>
        </div>
        <div className="flex gap-2 border-t border-[#E6ECF4] bg-[#FAFBFE] px-5 py-4">
          <button type="button" disabled={pending} onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-[#CED8E6] bg-white text-[12px] font-semibold text-[#17375C] disabled:opacity-50">Cancel</button>
          <button type="button" disabled={pending} onClick={onConfirm} autoFocus className="min-h-11 flex-1 rounded-xl bg-[#17375C] text-[12px] font-semibold text-white disabled:opacity-50">{pending ? "Deleting..." : "Delete"}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
