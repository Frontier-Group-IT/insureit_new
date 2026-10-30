"use client";
import { Trash2 } from "lucide-react";

export function DocumentDeleteConfirmation({fileName,onCancel,onConfirm,busy=false}:{fileName:string;onCancel:()=>void;onConfirm:()=>void;busy?:boolean}){
  return <div role="presentation" className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071D49]/55 p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby="document-delete-heading" aria-describedby="document-delete-description" className="w-full max-w-[420px] rounded-[26px] bg-white px-6 py-7 text-center shadow-2xl">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-700"><Trash2 className="h-7 w-7"/></span>
      <h2 id="document-delete-heading" className="mt-5 text-[22px] font-extrabold text-[#18233B]">Delete document?</h2>
      <p id="document-delete-description" className="mt-3 break-words text-[14px] font-medium leading-6 text-[#697386]">Are you sure you want to delete {fileName}?</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-12 rounded-xl border border-slate-300 bg-white font-bold text-[#183153] disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="min-h-12 rounded-xl bg-[#C42F34] font-bold text-white disabled:opacity-50">{busy?"Deleting…":"Delete"}</button>
      </div>
    </div>
  </div>;
}
