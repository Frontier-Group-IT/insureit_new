import fs from "node:fs";

const path = "apps/web-portal/components/policy-form-authbridge.tsx";
let text = fs.readFileSync(path, "utf8");

const oldImport = 'import { useEffect, useMemo, useState, useTransition } from "react";\n';
if (!text.includes('import { createPortal } from "react-dom";')) {
  if (!text.includes(oldImport)) throw new Error("React import anchor not found");
  text = text.replace(oldImport, `${oldImport}import { createPortal } from "react-dom";\n`);
}

const start = text.indexOf("function ModalShell(");
const end = text.indexOf("\nfunction RcModal(", start);
if (start < 0 || end < 0) throw new Error("ModalShell anchors not found");

const replacement = `function ModalShell({ title, subtitle, onClose, children, footer }: { title:string;subtitle:string;onClose:()=>void;children:ReactNode;footer:ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#071D49]/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(7,29,73,.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-3"><p className="truncate text-[15px] font-bold text-[#102A4C]">{title}</p><p className="mt-1 truncate text-[9.5px] text-[#667085]">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-lg text-[#475467] hover:bg-[#F2F5F9]" aria-label="Close">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        <div className="shrink-0 border-t border-[#E6EBF2] bg-white px-4 py-3 sm:px-5 sm:py-4">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}`;

text = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
fs.writeFileSync(path, text);
