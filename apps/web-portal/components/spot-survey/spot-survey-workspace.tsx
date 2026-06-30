import Link from "next/link";
import { ReplaceDocumentButton } from "./replace-document-button";
import { VerifyDetailButton, VerifyDocumentButton } from "./verify-buttons";

export type SpotSurveyClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no?: string | null;
  customer_id: string;
  accident_location: string | null;
  accident_description: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null } | null;
  insurance_companies: { name: string | null } | null;
};

export type SpotSurveyDocument = {
  id: string;
  document_type: string;
  file_name: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string | null;
  signedUrl?: string | null;
};

type VerificationItem = {
  key: string;
  number: number;
  title: string;
  icon: string;
  accent: string;
  documentType?: string;
  document?: SpotSurveyDocument | null;
  detailLabel?: string;
  detailValue?: string | null;
  status?: "verified" | "pending" | "rejected";
  kind: "document" | "detail";
};

const documentAliases: Record<string, string[]> = {
  rc: ["RC Copy", "Registration certificate", "Registration Certificate"],
  insurance: ["Insurance Copy", "Policy copy", "Policy Copy"],
  dl: ["Driving licence", "Driving Licence", "Driving Licence Copy", "DL Copy"],
  gr: ["GR Copy / Load Challan", "GR / Load Challan Copy", "Road Challan", "Load Challan"]
};

export function SpotSurveyWorkspace({ claim, documents }: { claim: SpotSurveyClaim; documents: SpotSurveyDocument[] }) {
  const items = buildItems(claim, documents);
  const verifiedCount = items.filter((item) => item.status === "verified" || item.document?.verification_status === "verified").length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-6">
      <ClaimInfoStrip claim={claim} />

      <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(7,29,73,0.04)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.02em] text-[#071D49]">Documents &amp; Details Verification</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#4B596B]">Please verify all documents and details collected during spot survey.</p>
          </div>
          <div className="hidden rounded-xl bg-[#F4F7FC] px-3 py-2 text-right lg:block">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#68758A]">Verified</p>
            <p className="text-[18px] font-semibold text-[#071D49]">{verifiedCount}/{items.length}</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => item.kind === "document" ? <DocumentVerificationCard key={item.key} item={item} claim={claim} /> : <DetailVerificationCard key={item.key} item={item} claim={claim} />)}
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-[#E4ECF6] bg-[#FBFCFE] p-3 lg:grid-cols-[1fr_220px] lg:items-end">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#071D49]">Remarks (Optional)</span>
            <textarea className="mt-1 h-[44px] w-full resize-none rounded-lg border border-[#C9D4E3] bg-white px-3 py-2 text-[12px] text-[#071D49] outline-none placeholder:text-[#8B98A9] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" placeholder="Enter remarks here..." />
          </label>
          <button type="button" className="flex h-[44px] items-center justify-center gap-2 rounded-lg bg-[#071D49] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">
            Submit &amp; Proceed
            <span className="text-[18px] leading-none">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ClaimInfoStrip({ claim }: { claim: SpotSurveyClaim }) {
  const customerName = claim.customers?.company_name || claim.customers?.contact_name || "-";
  const insurer = claim.insurance_companies?.name || "-";
  const insurerRef = claim.insurer_claim_no || claim.policies?.policy_no || claim.claim_no;

  return (
    <section className="grid overflow-hidden rounded-2xl border border-[#DFE8F4] bg-[#F8FBFF] shadow-[0_6px_18px_rgba(7,29,73,0.03)] md:grid-cols-4">
      <SummaryCell icon="👤" label="Customer Name" title={customerName} subtitle={claim.customers?.phone ?? "-"} />
      <SummaryCell icon="🚗" label="Vehicle Number" title={claim.vehicles?.vehicle_no ?? "-"} />
      <SummaryCell icon="🚘" label="Make / Model" title={claim.vehicles?.make ?? "-"} subtitle={claim.vehicles?.model ?? "-"} />
      <SummaryCell icon="🛡️" label="Insurance Company" title={insurer} subtitle={insurerRef} last />
    </section>
  );
}

function SummaryCell({ icon, label, title, subtitle, last = false }: { icon: string; label: string; title: string; subtitle?: string | null; last?: boolean }) {
  return (
    <div className={`flex min-h-[86px] items-center gap-3 px-5 py-3 ${last ? "" : "border-b border-[#DFE8F4] md:border-b-0 md:border-r"}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[22px] text-[#071D49]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-4 text-[#174EA6]">{label}</p>
        <p className="mt-0.5 truncate text-[15px] font-semibold leading-5 text-[#071D49]">{title}</p>
        {subtitle ? <p className="truncate text-[13px] leading-5 text-[#071D49]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function DocumentVerificationCard({ item, claim }: { item: VerificationItem; claim: SpotSurveyClaim }) {
  const status = item.document?.verification_status ?? "pending";
  const isVerified = status === "verified";

  return (
    <article className="rounded-xl border border-[#E2EAF4] bg-white p-3 shadow-[0_6px_16px_rgba(7,29,73,0.028)]">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[14px] font-semibold text-[#071D49]">{item.number}</span>
        <h2 className="text-[17px] font-semibold leading-tight text-[#071D49]">{item.title}</h2>
      </div>

      <div className="grid grid-cols-[86px_1fr] gap-3">
        <div className={`grid h-[86px] w-[86px] place-items-center rounded-xl ${item.accent}`}><div className="text-[38px] leading-none">{item.icon}</div></div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#071D49]">{item.document?.file_name ?? "Document not uploaded"}</p>
          {item.document?.signedUrl ? <Link href={item.document.signedUrl} target="_blank" className="mt-0.5 inline-block text-[12px] font-medium text-[#139657]">Preview available</Link> : <p className={`mt-0.5 text-[12px] font-medium ${isVerified ? "text-[#139657]" : status === "rejected" ? "text-[#C0362C]" : "text-[#8B98A9]"}`}>{statusLabel(status)}</p>}
          <p className="mt-2 text-[11px] leading-4 text-[#4B596B]">Uploaded on<br />{formatDate(item.document?.created_at)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {item.document ? <VerifyDocumentButton claimId={claim.id} documentId={item.document.id} /> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-400">Verify</button>}
        {item.document?.signedUrl ? <Link href={item.document.signedUrl} target="_blank" className="flex h-8 items-center justify-center rounded-md border border-[#4C68A6] bg-white text-[12px] font-semibold text-[#174EA6] transition hover:bg-[#F4F7FF]">Reload</Link> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-400">Reload</button>}
        <ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentType={item.documentType ?? item.title} label={item.title} />
      </div>
    </article>
  );
}

function DetailVerificationCard({ item, claim }: { item: VerificationItem; claim: SpotSurveyClaim }) {
  const isVerified = item.status === "verified";
  return (
    <article className="rounded-xl border border-[#E2EAF4] bg-[#FCFDFE] p-3 shadow-[0_6px_16px_rgba(7,29,73,0.025)]">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[14px] font-semibold text-[#071D49]">{item.number}</span>
        <h2 className="text-[17px] font-semibold leading-tight text-[#071D49]">{item.title}</h2>
      </div>
      <div className="grid grid-cols-[86px_1fr] gap-3">
        <div className={`grid h-[86px] w-[86px] place-items-center rounded-xl ${item.accent}`}><div className="text-[38px] leading-none">{item.icon}</div></div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#68758A]">{item.detailLabel}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-5 text-[#071D49]">{item.detailValue || "Not available"}</p>
          <p className={`mt-2 text-[12px] font-semibold ${isVerified ? "text-[#139657]" : "text-[#8B98A9]"}`}>{isVerified ? "Verified" : "Pending verification"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
        <VerifyDetailButton claimId={claim.id} detailKey={item.key} detailLabel={item.detailLabel ?? item.title} detailValue={item.detailValue ?? ""} disabled={!item.detailValue} />
        <button type="button" className="h-8 rounded-md border border-[#4C68A6] bg-white text-[12px] font-semibold text-[#174EA6] transition hover:bg-[#F4F7FF]">Update</button>
      </div>
    </article>
  );
}

function buildItems(claim: SpotSurveyClaim, documents: SpotSurveyDocument[]): VerificationItem[] {
  const doc = (key: keyof typeof documentAliases) => {
    const aliases = documentAliases[key].map((name) => name.toLowerCase());
    return documents.find((item) => aliases.includes(item.document_type.toLowerCase()) && item.verification_status !== "rejected") ?? documents.find((item) => aliases.includes(item.document_type.toLowerCase())) ?? null;
  };

  return [
    { key: "rc", number: 1, title: "RC Copy", icon: "📄", accent: "bg-[#F1ECFF]", documentType: "Registration certificate", document: doc("rc"), kind: "document" },
    { key: "insurance", number: 2, title: "Insurance Copy", icon: "📃", accent: "bg-[#FFF3D9]", documentType: "Policy copy", document: doc("insurance"), kind: "document" },
    { key: "dl", number: 3, title: "Driving Licence Copy", icon: "🪪", accent: "bg-[#EAF8EF]", documentType: "Driving licence", document: doc("dl"), kind: "document" },
    { key: "gr", number: 4, title: "GR / Load Challan Copy", icon: "🚚", accent: "bg-[#FFF1E6]", documentType: "GR Copy / Load Challan", document: doc("gr"), kind: "document" },
    { key: "driver", number: 5, title: "Driver Details", icon: "👤", accent: "bg-[#EEF6FF]", detailLabel: "Driver / DL Number", detailValue: extractDriverNumber(claim.accident_description), status: extractDriverNumber(claim.accident_description) ? "verified" : "pending", kind: "detail" },
    { key: "location", number: 6, title: "Loss Location", icon: "📍", accent: "bg-[#F2EDFF]", detailLabel: "Location", detailValue: claim.accident_location, status: claim.accident_location ? "verified" : "pending", kind: "detail" }
  ];
}

function extractDriverNumber(value?: string | null) {
  if (!value) return null;
  return value.match(/[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}/i)?.[0] ?? null;
}

function statusLabel(status: string) {
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  return "Pending verification";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
