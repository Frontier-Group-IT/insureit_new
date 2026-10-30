"use client";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

export function FileSizeExceededPopup({maxSizeMb,onClose}:{maxSizeMb:number;onClose:()=>void}){
  if(typeof document==="undefined")return null;
  return createPortal(<div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center bg-[#071D49]/55 p-3" role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby="file-size-popup-title" aria-describedby="file-size-popup-description" className="w-full max-w-[390px] rounded-2xl bg-white p-4 shadow-2xl">
      <h2 id="file-size-popup-title" className="flex items-center gap-2 text-[15px] font-bold text-[#16213B]"><AlertTriangle className="h-5 w-5 shrink-0 text-red-600"/>File Size Exceeded (Maximum allowed {maxSizeMb} MB)</h2>
      <p id="file-size-popup-description" className="mt-3 text-[13px] leading-5 text-[#475467]">The selected file is larger than the permitted upload size.</p>
      <button type="button" autoFocus onClick={onClose} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#173D78] text-[13px] font-bold text-white hover:bg-[#123264]">OK</button>
    </div>
  </div>,document.body);
}
