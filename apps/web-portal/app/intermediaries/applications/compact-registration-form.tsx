"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Profile = {
  partner_type: "posp" | "misp";
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
  aadhaar_number: string | null;
};

type Props = {
  profile: Profile;
  iibVerified: boolean;
  documents: Array<{ document_type: string; file_name: string }>;
};

const panDeclaration = "I hereby declare that my PAN is operative as on date. In the event that my PAN becomes inoperative in the future, I shall be liable to bear higher TDS or any other applicable consequences as per law & shall reimburse any penalty / amount which Sankalp Insurance may have to bear because of this event.";
const gstDeclaration = "I hereby declare that my turnover does not currently exceed the threshold limit for GST registration as prescribed under applicable laws. I understand that if my turnover exceeds the prescribed limit in the future, I shall be solely responsible for obtaining GST registration and complying with all relevant provisions of the GST law.";
const requirements = [
  ["Marksheet", ["education_10th_marksheet", "education_12th_marksheet", "education_graduation_marksheet", "education_post_graduation_marksheet"]],
  ["Aadhaar front", ["aadhaar_front"]],
  ["Aadhaar back", ["aadhaar_back"]],
  ["PAN copy", ["pan_copy"]],
  ["Cancelled cheque", ["cancelled_cheque"]],
  ["Photograph", ["photograph"]],
  ["GST certificate", ["gst_copy"]],
  ["Agreement copy", ["agreement_copy"]],
] as const;

export function CompactRegistrationForm({ profile, iibVerified, documents }: Props) {
  const rows = registrationRows(profile, iibVerified);
  const documentRows = requirements.map(([label, types]) => {
    const file = documents.find((document) => types.includes(document.document_type as never));
    return { label, attached: Boolean(file), fileName: file?.file_name ?? null };
  });

  async function downloadPdf() {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.03, 0.12, 0.29);
    const border = rgb(0.72, 0.77, 0.84);
    const light = rgb(0.95, 0.97, 0.99);
    const left = 30;
    const width = 535;
    let y = 812;

    page.drawRectangle({ x: left, y: y - 28, width, height: 32, color: navy });
    page.drawText(`${profile.partner_type.toUpperCase()} REGISTRATION FORM`, { x: 182, y: y - 18, size: 13, font: bold, color: rgb(1, 1, 1) });
    y -= 38;

    const drawSectionTitle = (title: string) => {
      page.drawRectangle({ x: left, y: y - 18, width, height: 20, color: light, borderColor: border, borderWidth: 0.7 });
      page.drawText(title, { x: left + 7, y: y - 12, size: 8.5, font: bold, color: navy });
      y -= 20;
    };

    const drawTwoColumnRows = (items: Array<[string, string]>) => {
      for (let index = 0; index < items.length; index += 2) {
        const pair = [items[index], items[index + 1]].filter(Boolean) as Array<[string, string]>;
        const rowHeight = 28;
        pair.forEach(([label, value], pairIndex) => {
          const x = left + pairIndex * (width / 2);
          const columnWidth = width / 2;
          page.drawRectangle({ x, y: y - rowHeight, width: columnWidth, height: rowHeight, borderColor: border, borderWidth: 0.7 });
          page.drawText(label, { x: x + 6, y: y - 10, size: 6.8, font: bold, color: rgb(0.31, 0.38, 0.49) });
          const valueLines = wrap(value || "-", font, 7.6, columnWidth - 12, 2);
          valueLines.forEach((line, lineIndex) => page.drawText(line, { x: x + 6, y: y - 21 - lineIndex * 8, size: 7.6, font, color: rgb(0.06, 0.09, 0.16) }));
        });
        y -= rowHeight;
      }
    };

    drawSectionTitle("BUSINESS PARTNER DETAILS");
    drawTwoColumnRows(rows.slice(0, 12));
    drawSectionTitle("LEGAL AND BANK DETAILS");
    drawTwoColumnRows(rows.slice(12));

    drawSectionTitle("DOCUMENT STATUS");
    const documentText = documentRows.map((row) => `${row.attached ? "[X]" : "[ ]"} ${row.label}`).join("     ");
    const documentLines = wrap(documentText, font, 7.2, width - 14, 3);
    page.drawRectangle({ x: left, y: y - 32, width, height: 32, borderColor: border, borderWidth: 0.7 });
    documentLines.forEach((line, index) => page.drawText(line, { x: left + 7, y: y - 11 - index * 9, size: 7.2, font, color: rgb(0.06, 0.09, 0.16) }));
    y -= 32;

    drawSectionTitle("DECLARATIONS");
    const declarationLines = [
      ...wrap(`1. ${panDeclaration}`, font, 6.5, width - 18, 5),
      ...wrap(`2. ${gstDeclaration}`, font, 6.5, width - 18, 5),
    ];
    const declarationHeight = 12 + declarationLines.length * 7.5;
    page.drawRectangle({ x: left, y: y - declarationHeight, width, height: declarationHeight, borderColor: border, borderWidth: 0.7 });
    declarationLines.forEach((line, index) => page.drawText(line, { x: left + 8, y: y - 12 - index * 7.5, size: 6.5, font, color: rgb(0.08, 0.12, 0.2) }));
    y -= declarationHeight + 5;

    const signatureWidth = width / 3;
    ["Signature of POSP / DP", "Verified by Insurance Team", "Accounts Team Verification"].forEach((label, index) => {
      const x = left + index * signatureWidth;
      page.drawLine({ start: { x: x + 12, y: y - 34 }, end: { x: x + signatureWidth - 12, y: y - 34 }, thickness: 0.7, color: rgb(0.35, 0.4, 0.5) });
      page.drawText(label, { x: x + 18, y: y - 45, size: 6.8, font: bold, color: rgb(0.25, 0.31, 0.4) });
    });

    const bytes = await pdf.save();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.partner_type}-${profile.external_onboarding_id || "registration"}.pdf`.replaceAll("/", "-");
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printForm() {
    const content = document.getElementById("compact-registration-print-area")?.innerHTML;
    if (!content) return;
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>${profile.partner_type.toUpperCase()} Registration Form</title><style>${printCss}</style></head><body>${content}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  }

  return <details className="group overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <div><p className="text-[11px] font-semibold text-[#0F172A]">Registration form</p><p className="mt-0.5 text-[9px] text-[#64748B]">{documents.length} document(s) attached · PAN verification {iibVerified ? "Y" : "N"}</p></div>
      <span className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-[9px] font-semibold text-[#334155] group-open:bg-[#F8FAFC]">View form</span>
    </summary>
    <div className="border-t border-[#DCE5EF] p-4">
      <div className="mb-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={downloadPdf} className="rounded-lg bg-[#071D49] px-3 py-2 text-[9.5px] font-semibold text-white">Download PDF</button><button type="button" onClick={printForm} className="rounded-lg bg-[#4F46E5] px-3 py-2 text-[9.5px] font-semibold text-white">Print Registration Form</button></div>
      <div id="compact-registration-print-area" className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
        <div className="bg-[#071D49] px-4 py-3 text-center text-white"><h3 className="text-[13px] font-semibold tracking-wide">{profile.partner_type.toUpperCase()} REGISTRATION FORM</h3></div>
        <Section title="Business Partner Details" rows={rows.slice(0, 12)} />
        <Section title="Legal and Bank Details" rows={rows.slice(12)} />
        <div className="border-t border-[#DCE5EF] p-3"><h4 className="mb-2 text-[9px] font-semibold uppercase tracking-[.06em] text-[#475569]">Documents</h4><div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">{documentRows.map((row) => <div key={row.label} className={`rounded-lg border px-2.5 py-2 text-[8.5px] font-semibold ${row.attached ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{row.attached ? "✓" : "○"} {row.label}</div>)}</div></div>
        <div className="border-t border-[#DCE5EF] p-3"><h4 className="mb-2 text-[9px] font-semibold uppercase tracking-[.06em] text-[#475569]">Declarations</h4><Declaration number="1" text={panDeclaration}/><Declaration number="2" text={gstDeclaration}/></div>
        <div className="grid gap-8 border-t border-[#DCE5EF] p-5 sm:grid-cols-3"><Signature label="Signature of POSP / DP"/><Signature label="Verified by Insurance Team"/><Signature label="Accounts Team Verification"/></div>
      </div>
    </div>
  </details>;
}

function registrationRows(profile: Profile, iibVerified: boolean): Array<[string, string]> {
  const isMisp = profile.partner_type === "misp";
  const partnerName = isMisp ? profile.misp_name : profile.pos_name;
  const contactName = isMisp ? profile.dp_name : profile.pos_name;
  return [
    ["Date", formatDate(profile.document_received_at)],
    ["Business Partner Name", partnerName || "-"],
    ["Phone No.", (isMisp ? profile.dp_phone : profile.applicant_phone) || "-"],
    ["Contact Person", contactName || "-"],
    ["Street / Block No.", profile.address || "-"],
    ["Building", "-"],
    ["PIN Code", profile.postal_code || "-"],
    ["City", profile.city || "-"],
    ["State", profile.state || "-"],
    ["Email", (isMisp ? profile.dp_email : profile.applicant_email) || "-"],
    ["Country", "India"],
    [profile.partner_type === "misp" ? "MISP ID" : "POSP ID", profile.external_onboarding_id || "-"],
    ["PAN No.", (isMisp ? profile.dp_pan_number : profile.pan_number) || "-"],
    ["Aadhaar No.", profile.aadhaar_number || "-"],
    ["GST Registration No.", profile.gst_number || "-"],
    ["MSMED Registration No.", "-"],
    ["Name of Bank", profile.bank_name || "-"],
    ["Account Name", contactName || "-"],
    ["Bank Branch & Address", "-"],
    ["Account No.", profile.bank_account_number || "-"],
    ["RTGS / IFSC Code", profile.bank_ifsc_code || "-"],
    ["PAN Verification", iibVerified ? "Y" : "N"],
  ];
}

function Section({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div className="border-t border-[#DCE5EF] first:border-t-0"><h4 className="bg-[#F1F5F9] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.06em] text-[#475569]">{title}</h4><div className="grid sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[125px_1fr] border-b border-r border-[#E2E8F0] text-[8.5px]"><div className="bg-[#F8FAFC] px-2.5 py-2 font-semibold text-[#475569]">{label}</div><div className="px-2.5 py-2 font-medium text-[#0F172A]">{value}</div></div>)}</div></div>; }
function Declaration({ number, text }: { number: string; text: string }) { return <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] px-3 py-2 last:mb-0"><span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-emerald-600 text-[8px] font-bold text-white">✓</span><p className="text-[7.8px] leading-4 text-[#334155]"><strong>{number}.</strong> {text}</p></div>; }
function Signature({ label }: { label: string }) { return <div className="pt-10"><div className="border-t border-[#64748B] pt-2 text-center text-[8px] font-semibold text-[#475569]">{label}</div></div>; }
function formatDate(value: string | null) { if (!value) return new Intl.DateTimeFormat("en-IN").format(new Date()); const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN").format(date); }
function wrap(text: string, font: { widthOfTextAtSize: (value: string, size: number) => number }, size: number, maxWidth: number, maxLines: number) { const words = text.replace(/[^\x20-\x7E]/g, " ").split(/\s+/); const lines: string[] = []; let current = ""; for (const word of words) { const candidate = current ? `${current} ${word}` : word; if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate; else { if (current) lines.push(current); current = word; if (lines.length >= maxLines - 1) break; } } if (current && lines.length < maxLines) lines.push(current); return lines; }
const printCss = `@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;margin:0}button,summary{display:none!important}details>div{display:block!important;border:0!important;padding:0!important}.bg-\[\#071D49\]{background:#071D49!important;color:white!important}.grid{display:grid}.sm\:grid-cols-2{grid-template-columns:1fr 1fr}.sm\:grid-cols-3{grid-template-columns:1fr 1fr 1fr}.lg\:grid-cols-4{grid-template-columns:repeat(4,1fr)}.border,.border-t,.border-b,.border-r{border-color:#cbd5e1!important}.border{border:1px solid #cbd5e1}.border-t{border-top:1px solid #cbd5e1}.border-b{border-bottom:1px solid #cbd5e1}.border-r{border-right:1px solid #cbd5e1}.p-3{padding:8px}.p-5{padding:12px}.px-3{padding-left:8px;padding-right:8px}.py-2{padding-top:5px;padding-bottom:5px}h3,h4,p{margin:0}section{break-inside:avoid;font-size:8px}`;
