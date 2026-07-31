"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type RegistrationProfile = {
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
  bank_name?: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
  aadhaar_last_four: string | null;
};

type Props = {
  profile: RegistrationProfile;
  iibVerified: boolean;
  documents: Array<{ document_type: string; file_name: string }>;
  onBackToPrimary: () => void;
  onBackToDocuments: () => void;
};

const documentRequirements = [
  ["education", "Marksheet", ["education_10th_marksheet", "education_12th_marksheet", "education_graduation_marksheet", "education_post_graduation_marksheet"]],
  ["aadhaar_front", "Aadhaar front", ["aadhaar_front"]],
  ["aadhaar_back", "Aadhaar back", ["aadhaar_back"]],
  ["pan_copy", "PAN copy", ["pan_copy"]],
  ["cancelled_cheque", "Cancelled cheque", ["cancelled_cheque"]],
  ["photograph", "Photograph", ["photograph"]],
  ["gst_copy", "GST certificate", ["gst_copy"]],
] as const;

export function IntermediaryRegistrationForm({ profile, iibVerified, documents, onBackToPrimary, onBackToDocuments }: Props) {
  const isMisp = profile.partner_type === "misp";
  const partnerName = isMisp ? profile.misp_name : profile.pos_name;
  const contactName = isMisp ? profile.dp_name : profile.pos_name;
  const phone = isMisp ? profile.dp_phone : profile.applicant_phone;
  const email = isMisp ? profile.dp_email : profile.applicant_email;
  const accountName = contactName;
  const aadhaarDisplay = profile.aadhaar_last_four ? `**** ${profile.aadhaar_last_four}` : "-";
  const registrationDate = formatDate(profile.document_received_at);
  const attachedTypes = new Set(documents.map((document) => document.document_type));
  const rows = documentRequirements.filter(([, label]) => label !== "GST certificate" || Boolean(profile.gst_number)).map(([key, label, acceptedTypes]) => ({
    key,
    label,
    attached: acceptedTypes.some((type) => attachedTypes.has(type)),
    fileName: documents.find((document) => acceptedTypes.includes(document.document_type as never))?.file_name ?? null,
  }));

  const dataRows: Array<[string, string]> = [
    ["Date", registrationDate],
    ["Business Partner Name", partnerName || "-"],
    ["Phone No.", phone || "-"],
    ["Contact Person", contactName || "-"],
    ["Street / Block No.", profile.address || "-"],
    ["Building", "-"],
    ["PIN Code", profile.postal_code || "-"],
    ["City", profile.city || "-"],
    ["State", profile.state || "-"],
    ["Email", email || "-"],
    ["Country", "India"],
    ["PAN No.", isMisp ? profile.dp_pan_number || "-" : profile.pan_number || "-"],
    ["Aadhaar No.", aadhaarDisplay],
    ["GST Registration No.", profile.gst_number || "-"],
    ["MSMED Registration No.", "-"],
    ["Name of Bank", profile.bank_name || "-"],
    ["Account Name", accountName || "-"],
    ["Bank Branch & Address", "-"],
    ["Account No.", profile.bank_account_number || "-"],
    ["RTGS / IFSC Code", profile.bank_ifsc_code || "-"],
    [profile.partner_type === "misp" ? "MISP Allotted Number" : "POSP Allotted Number", profile.external_onboarding_id || "-"],
    ["PAN Verification", iibVerified ? "Y" : "N"],
  ];

  async function downloadPdf() {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]);
    let y = 805;

    const addPage = () => {
      page = pdf.addPage([595.28, 841.89]);
      y = 805;
    };
    const ensure = (height: number) => { if (y - height < 55) addPage(); };
    const line = (text: string, size = 9, isBold = false, indent = 42) => {
      ensure(size + 8);
      page.drawText(safeText(text), { x: indent, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.13, 0.24) });
      y -= size + 7;
    };
    const section = (title: string) => { ensure(28); y -= 4; page.drawRectangle({ x: 36, y: y - 4, width: 523, height: 20, color: rgb(0.93, 0.95, 0.98) }); page.drawText(title, { x: 44, y: y + 2, size: 10, font: bold, color: rgb(0.03, 0.12, 0.29) }); y -= 27; };

    page.drawText(`${profile.partner_type.toUpperCase()} REGISTRATION FORM`, { x: 155, y, size: 15, font: bold, color: rgb(0.03, 0.12, 0.29) });
    y -= 30;
    section("Business Partner Details");
    for (const [label, value] of dataRows.slice(0, 11)) line(`${label}: ${value}`);
    section("Legal Details");
    for (const [label, value] of dataRows.slice(11, 15)) line(`${label}: ${value}`);
    section("Bank Details");
    for (const [label, value] of dataRows.slice(15, 20)) line(`${label}: ${value}`);
    section("Internal Verification");
    for (const [label, value] of dataRows.slice(20)) line(`${label}: ${value}`);
    section("Documents");
    for (const row of rows) line(`${row.attached ? "Attached" : "Pending"} - ${row.label}${row.fileName ? ` (${row.fileName})` : ""}`);
    section("Declarations");
    line("[X] PAN is operative and the information provided is correct.");
    line("[X] GST declaration is acknowledged where applicable.");
    y -= 18;
    line("Signature of POSP / DP: ______________________________", 9, false);
    y -= 14;
    line("Verified by Insurance Team: __________________________", 9, false);
    y -= 14;
    line("Accounts Team Verification: __________________________", 9, false);

    const bytes = await pdf.save();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.partner_type}-${profile.external_onboarding_id || "registration"}.pdf`.replaceAll("/", "-");
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printForm() {
    const content = document.getElementById("intermediary-registration-print-area")?.innerHTML;
    if (!content) return;
    const popup = window.open("", "_blank", "width=980,height=760");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>${profile.partner_type.toUpperCase()} Registration Form</title><style>${printCss}</style></head><body>${content}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onBackToPrimary} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[10px] font-semibold text-[#334155]">Back to Primary</button>
        <button type="button" onClick={onBackToDocuments} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[10px] font-semibold text-[#334155]">Back to Documents</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadPdf} className="rounded-lg bg-[#071D49] px-3 py-2 text-[10px] font-semibold text-white">Download PDF</button>
        <button type="button" onClick={printForm} className="rounded-lg bg-[#4F46E5] px-3 py-2 text-[10px] font-semibold text-white">Print Registration Form</button>
      </div>
    </div>

    <section id="intermediary-registration-print-area" className="overflow-hidden rounded-2xl border border-[#C9D4E2] bg-white shadow-sm">
      <div className="border-b border-[#C9D4E2] bg-[#071D49] px-5 py-4 text-center text-white">
        <h2 className="text-[16px] font-semibold tracking-wide">{profile.partner_type.toUpperCase()} REGISTRATION FORM</h2>
      </div>
      <RegistrationSection title="Business Partner Details" rows={dataRows.slice(0, 11)} />
      <RegistrationSection title="Legal Details" rows={dataRows.slice(11, 15)} />
      <RegistrationSection title="Bank Details" rows={dataRows.slice(15, 20)} />
      <RegistrationSection title="Internal Verification" rows={dataRows.slice(20)} />
      <div className="border-t border-[#DCE5EF] p-4">
        <h3 className="mb-3 text-[11px] font-semibold text-[#0F172A]">Documents</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => <div key={row.key} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${row.attached ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div><p className="text-[10px] font-semibold text-[#0F172A]">{row.label}</p>{row.fileName ? <p className="mt-0.5 text-[8.5px] text-[#64748B]">{row.fileName}</p> : null}</div><span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${row.attached ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.attached ? "Attached" : "Pending"}</span></div>)}
        </div>
      </div>
      <div className="grid gap-3 border-t border-[#DCE5EF] p-4 md:grid-cols-2">
        <Declaration text="PAN is operative and the information provided is correct." />
        <Declaration text="GST declaration is acknowledged where applicable." />
      </div>
      <div className="grid gap-8 border-t border-[#DCE5EF] p-5 md:grid-cols-3">
        <Signature label="Signature of POSP / DP" />
        <Signature label="Verified by Insurance Team" />
        <Signature label="Accounts Team Verification" />
      </div>
    </section>
  </div>;
}

function RegistrationSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <div className="border-t border-[#DCE5EF] first:border-t-0"><h3 className="bg-[#F1F5F9] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.05em] text-[#334155]">{title}</h3><div className="grid md:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[150px_1fr] border-b border-r border-[#E2E8F0] text-[9.5px]"><div className="bg-[#F8FAFC] px-3 py-2 font-semibold text-[#475569]">{label}</div><div className="px-3 py-2 font-medium text-[#0F172A]">{value}</div></div>)}</div></div>;
}
function Declaration({ text }: { text: string }) { return <div className="flex items-start gap-2 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] px-3 py-2"><span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-emerald-500 bg-emerald-500 text-[9px] font-bold text-white">✓</span><p className="text-[9px] leading-4 text-[#334155]">{text}</p></div>; }
function Signature({ label }: { label: string }) { return <div className="pt-12"><div className="border-t border-[#64748B] pt-2 text-center text-[9px] font-semibold text-[#475569]">{label}</div></div>; }
function formatDate(value: string | null) { if (!value) return new Intl.DateTimeFormat("en-IN").format(new Date()); const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN").format(date); }
function safeText(value: string) { return value.replace(/[^\x20-\x7E]/g, "-"); }
const printCss = `body{font-family:Arial,sans-serif;color:#0f172a;margin:24px}button{display:none}section{border:1px solid #94a3b8}.bg-\\[\\#071D49\\]{background:#071D49;color:white;padding:14px;text-align:center}h2{margin:0}.grid{display:grid}.md\\:grid-cols-2{grid-template-columns:1fr 1fr}.md\\:grid-cols-3{grid-template-columns:1fr 1fr 1fr}.border-t,.border-b,.border-r{border-color:#cbd5e1}.border-t{border-top:1px solid #cbd5e1}.border-b{border-bottom:1px solid #cbd5e1}.border-r{border-right:1px solid #cbd5e1}.p-4,.p-5{padding:14px}.px-3{padding-left:10px;padding-right:10px}.py-2{padding-top:8px;padding-bottom:8px}.py-2\\.5{padding-top:10px;padding-bottom:10px}.bg-\\[\\#F1F5F9\\],.bg-\\[\\#F8FAFC\\]{background:#f1f5f9}.text-center{text-align:center}.font-semibold{font-weight:600}.rounded-lg{border-radius:6px}.space-y-4>*+*{margin-top:12px}@page{size:A4;margin:12mm}`;
