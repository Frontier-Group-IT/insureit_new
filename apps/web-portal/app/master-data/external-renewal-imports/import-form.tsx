"use client";

import { useActionState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { uploadExternalRenewalWorkbook, type ExternalRenewalImportState } from "./actions";

type PartnerOption = { id: string; partner_code: string | null; display_name: string | null };

const initialState: ExternalRenewalImportState = { ok: false, message: "" };

export function ExternalRenewalImportForm({ partners }: { partners: PartnerOption[] }) {
  const [state, action, pending] = useActionState(uploadExternalRenewalWorkbook, initialState);

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#D8E2F1] bg-white p-5 shadow-[0_16px_40px_rgba(31,45,78,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#17213e]"><FileSpreadsheet className="h-5 w-5 text-[#3156B8]"/><h2 className="text-[15px] font-bold">External Renewal Import</h2></div>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#667085]">Use the standard workbook so external opportunities remain separate from verified INSUREIT customers, vehicles and policies. Policy start date is derived from Invoice Date and policy end date is one calendar year later.</p>
          </div>
          <a href="/master-data/external-renewal-imports/template" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C7D7F4] bg-[#F3F7FF] px-4 text-[11px] font-semibold text-[#244A9B] transition hover:bg-[#EAF1FF]">
            <Download className="h-4 w-4"/> Download Sample Template
          </a>
        </div>

        <form action={action} className="mt-5 grid gap-4 border-t border-[#E5EAF2] pt-5 lg:grid-cols-2">
          <label className="space-y-1.5 text-[10.5px] font-semibold text-[#344054]">
            <span>Partner</span>
            <select name="partner_id" required defaultValue="" className="h-11 w-full rounded-xl border border-[#D0D8E7] bg-white px-3 text-[12px] font-medium text-[#17213e] outline-none focus:border-[#6B8CD8] focus:ring-2 focus:ring-[#3156B8]/10">
              <option value="" disabled>Select Partner</option>
              {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name || partner.partner_code || partner.id}{partner.partner_code ? ` · ${partner.partner_code}` : ""}</option>)}
            </select>
          </label>

          <label className="space-y-1.5 text-[10.5px] font-semibold text-[#344054]">
            <span>Source Name</span>
            <input name="source_name" required maxLength={120} placeholder="e.g. Frontier Trucks External Renewal" className="h-11 w-full rounded-xl border border-[#D0D8E7] bg-white px-3 text-[12px] text-[#17213e] outline-none placeholder:text-[#98A2B3] focus:border-[#6B8CD8] focus:ring-2 focus:ring-[#3156B8]/10"/>
          </label>

          <label className="space-y-1.5 text-[10.5px] font-semibold text-[#344054]">
            <span>Source Period <span className="font-normal text-[#98A2B3]">(optional)</span></span>
            <input name="source_period" maxLength={40} placeholder="e.g. 2026-09" className="h-11 w-full rounded-xl border border-[#D0D8E7] bg-white px-3 text-[12px] text-[#17213e] outline-none placeholder:text-[#98A2B3] focus:border-[#6B8CD8] focus:ring-2 focus:ring-[#3156B8]/10"/>
          </label>

          <label className="space-y-1.5 text-[10.5px] font-semibold text-[#344054]">
            <span>Excel Workbook</span>
            <input name="workbook" type="file" required accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="block h-11 w-full cursor-pointer rounded-xl border border-[#D0D8E7] bg-white px-3 py-2 text-[11px] text-[#475467] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF3FF] file:px-3 file:py-1.5 file:text-[10.5px] file:font-semibold file:text-[#3156B8]"/>
          </label>

          <div className="lg:col-span-2 flex flex-col gap-3 border-t border-[#EEF1F5] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] leading-4 text-[#667085]">Rows more than 30 days expired, rows without a valid mobile, invalid invoice dates, and duplicate vehicle/date records are not published.</p>
            <button type="submit" disabled={pending || !partners.length} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17213E] px-5 text-[11px] font-semibold text-white transition hover:bg-[#233158] disabled:cursor-not-allowed disabled:opacity-50">
              <Upload className="h-4 w-4"/>{pending ? "Validating & Importing…" : "Validate & Publish"}
            </button>
          </div>
        </form>
      </section>

      {state.message ? (
        <section className={`rounded-xl border px-4 py-3 text-[11.5px] ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          <p className="font-semibold">{state.message}</p>
          {state.summary ? <p className="mt-1">Total {state.summary.total} · Published {state.summary.accepted} · Rejected {state.summary.rejected} · Duplicates {state.summary.duplicates}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
