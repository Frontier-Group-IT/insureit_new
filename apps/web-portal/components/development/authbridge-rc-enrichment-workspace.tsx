"use client";

import AuthbridgeRcEnrichmentClient from "@/app/reports/authbridge-rc-enrichment/authbridge-rc-enrichment-client";

const TEMPLATE_ROWS = [
  ["S.No.", "Registration Number", "Customer Name", "Mobile No.", "Branch"],
];

export default function AuthbridgeRcEnrichmentWorkspace() {
  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicles");
    XLSX.writeFile(workbook, "AuthBridge RC Enrichment Template.xlsx", { compression: true });
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-5 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Excel upload template</p>
            <p className="mt-1 text-xs text-slate-500">
              Download the standard workbook and enter one vehicle registration number per row. Only Registration Number is required.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Download Excel Template
          </button>
        </div>
      </div>

      <AuthbridgeRcEnrichmentClient />
    </>
  );
}
