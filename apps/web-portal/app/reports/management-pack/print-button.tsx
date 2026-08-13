"use client";

import { Printer } from "lucide-react";

export function ManagementPackPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad4e4] bg-white px-3 text-[10px] font-bold text-[#263b69] transition hover:border-[#9eacc3] hover:bg-[#f8fafc] print:hidden"
    >
      <Printer className="h-3.5 w-3.5" />
      Print / Save PDF
    </button>
  );
}
