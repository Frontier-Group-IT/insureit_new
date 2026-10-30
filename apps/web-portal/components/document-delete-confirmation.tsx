"use client";
import { Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

export function DocumentDeleteConfirmation({fileName,onCancel,onConfirm,busy=false}:{fileName:string;onCancel:()=>void;onConfirm:()=>void;busy?:boolean}){
  if (typeof document === "undefined") return null;
  return createPortal(<div role="presentation" className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-y-auto bg-[#071D49]/55 p-3 sm:p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby="document-delete-heading" aria-describedby="document-delete-description" className="w-full max-w-[360px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[20px] bg-white px-5 py-5 text-center shadow-2xl">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700"><Trash2 className="h-5 w-5"/></span>
      <h2 id="document-delete-heading" className="mt-3 text-[18px] font-extrabold text-[#18233B]">Delete document?</h2>
      <p id="document-delete-description" className="mt-2 break-words text-[12px] font-medium leading-5 text-[#697386]">Are you sure you want to delete {fileName}?</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-10 rounded-lg border border-slate-300 bg-white text-[12px] font-bold text-[#183153] disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="min-h-12 rounded-xl bg-[#C42F34] text-[12px] font-bold text-white disabled:opacity-50">{busy?"Deleting…":"Delete"}</button>
      </div>
    </div>
  </div>, document.body);
}
