import Link from "next/link";
import { ReplaceDocumentButton } from "./replace-document-button";
import { VerificationActionButton } from "./verification-action-button";
import { VerifyDetailButton } from "./verify-buttons";

export type SpotSurveyClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no?: string | null;
  customer_id: string;
  accident_at?: string | null;
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

export type SpotSurveyVerification = {
  id: string;
  claim_id: string;
  document_id: string | null;
  document_type: string;
  verification_type: "rc" | "insurance" | "document" | "detail";
  incident_date: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Item = {
  key: string;
  number: number;
  title: string;
  icon: string;
  accent: string;
  documentType: string;
  document?: SpotSurveyDocument | null;
};

const aliases = {
  rc: ["rc copy", "registration certificate"],
  insurance: ["insurance copy", "policy copy"],
  dl: ["driving licence", "driving licence copy", "dl copy"],
  gr: ["gr copy / road challan", "gr / load challan copy", "road challan", "load challan"]
};

export function SpotSurveyWorkspace({ claim, documents, verifications = [] }: { claim: SpotSurveyClaim; documents: SpotSurveyDocument[]; verifications?: SpotSurveyVerification[] }) {
  const items = buildDocumentItems(documents);
  const verifiedCount = items.filter((item) => isItemVerified(item, verifications)).length;
  const driverNumber = extractDriverNumber(claim.accident_description);
  const driverVerification = latestDetailVerification("driver", verifications);
  const locationVerification = latestDetailVerification("location", verifications);

  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-6">
      <InfoStrip claim={claim} />

      <SpotSurveyDetailsPanel
        claimId={claim.id}
        driverNumber={driverNumber}
        lossLocation={claim.accident_location}
        driverVerification={driverVerification}
        locationVerification={locationVerification}
      />

      <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(7,29,73,0.04)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.02em] text-[#071D49]">Document Verification</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#4B596B]">Verify required spot survey documents and replace invalid files where needed.</p>
          </div>
          <div className="rounded-xl bg-[#F4F7FC] px-3 py-2 text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#68758A]">Documents Verified</p>
            <p className="text-[18px] font-semibold text-[#071D49]">{verifiedCount}/{items.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => <DocumentCard key={item.key} item={item} claim={claim} verification={latestVerificationForItem(item, verifications)} />)}
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-[#E4ECF6] bg-[#FBFCFE] p-3 lg:grid-cols-[1fr_220px] lg:items-end">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#071D49]">Remarks (Optional)</span>
            <textarea className="mt-1 h-[44px] w-full resize-none rounded-lg border border-[#C9D4E3] bg-white px-3 py-2 text-[12px] text-[#071D49] outline-none" placeholder="Enter remarks here..." />
          </label>
          <button type="button" className="flex h-[44px] items-center justify-center gap-2 rounded-lg bg-[#071D49] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">Submit &amp; Proceed <span className="text-[18px] leading-none">→</span></button>
        </div>
      </section>
    </div>
  );
}

function InfoStrip({ claim }: { claim: SpotSurveyClaim }) {
  const customerName = claim.customers?.company_name || claim.customers?.contact_name || "-";
  const insurer = claim.insurance_companies?.name || "-";
  const insurerRef = claim.insurer_claim_no || claim.policies?.policy_no || claim.claim_no;
  return <section className="grid overflow-hidden rounded-2xl border border-[#DFE8F4] bg-[#F8FBFF] shadow-[0_6px_18px_rgba(7,29,73,0.03)] md:grid-cols-4"><Info icon="👤" label="Customer Name" title={customerName} subtitle={claim.customers?.phone ?? "-"} /><Info icon="🚗" label="Vehicle Number" title={claim.vehicles?.vehicle_no ?? "-"} /><Info icon="🚘" label="Make / Model" title={claim.vehicles?.make ?? "-"} subtitle={claim.vehicles?.model ?? "-"} /><Info icon="🛡️" label="Insurance Company" title={insurer} subtitle={insurerRef} last /></section>;
}

function Info({ icon, label, title, subtitle, last = false }: { icon: string; label: string; title: string; subtitle?: string | null; last?: boolean }) {
  return <div className={`flex min-h-[82px] items-center gap-3 px-5 py-3 ${last ? "" : "border-b border-[#DFE8F4] md:border-b-0 md:border-r"}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[22px]">{icon}</div><div className="min-w-0"><p className="text-[11px] font-medium leading-4 text-[#174EA6]">{label}</p><p className="mt-0.5 truncate text-[15px] font-semibold leading-5 text-[#071D49]">{title}</p>{subtitle ? <p className="truncate text-[13px] leading-5 text-[#071D49]">{subtitle}</p> : null}</div></div>;
}

function SpotSurveyDetailsPanel({ claimId, driverNumber, lossLocation, driverVerification, locationVerification }: { claimId: string; driverNumber: string | null; lossLocation: string | null; driverVerification?: SpotSurveyVerification; locationVerification?: SpotSurveyVerification }) {
  return (
    <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(7,29,73,0.035)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[#071D49]">Spot Survey Details</h2>
          <p className="text-[12px] text-[#68758A]">Non-document information captured during spot survey.</p>
        </div>
        <span className="rounded-full bg-[#F4F7FC] px-3 py-1 text-[11px] font-semibold text-[#4B596B]">Details</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SurveyDetailItem icon="👤" title="Driver Details" label="Driver / DL Number" value={driverNumber} verified={Boolean(driverVerification?.is_valid)} verifyButton={<VerifyDetailButton claimId={claimId} detailKey="driver" detailLabel="Driver / DL Number" detailValue={driverNumber ?? ""} disabled={!driverNumber} />} />
        <SurveyDetailItem icon="📍" title="Loss Location" label="Accident / Loss Location" value={lossLocation} verified={Boolean(locationVerification?.is_valid)} verifyButton={<VerifyDetailButton claimId={claimId} detailKey="location" detailLabel="Loss Location" detailValue={lossLocation ?? ""} disabled={!lossLocation} />} />
      </div>
    </section>
  );
}

function SurveyDetailItem({ icon, title, label, value, verified, verifyButton }: { icon: string; title: string; label: string; value?: string | null; verified: boolean; verifyButton: React.ReactNode }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${verified ? "border-green-200 bg-green-50/40" : "border-[#E2EAF4] bg-[#FBFCFE]"}`}><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[24px]">{icon}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-[14px] font-semibold text-[#071D49]">{title}</p>{verified ? <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Verified</span> : null}</div><p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#68758A]">{label}</p><p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#071D49]">{value || "Not available"}</p>{verified ? <p className="mt-1 text-[11px] font-semibold text-green-700">Verification details saved.</p> : null}</div><div className="w-[96px] shrink-0">{verified ? <button disabled className="h-8 w-full rounded-md border border-green-200 bg-green-100 text-[12px] font-semibold text-green-700">Verified</button> : verifyButton}</div></div>;
}

function DocumentCard({ item, claim, verification }: { item: Item; claim: SpotSurveyClaim; verification?: SpotSurveyVerification }) {
  const status = item.document?.verification_status ?? "pending";
  const persistedVerified = Boolean(verification?.is_valid) || status === "verified";
  const invalidAttempt = verification && !verification.is_valid ? verification : undefined;
  return <article className={`rounded-xl border p-3 shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${persistedVerified ? "border-green-200 bg-green-50/35" : invalidAttempt ? "border-red-200 bg-red-50/25" : "border-[#E2EAF4] bg-white"}`}><div className="mb-2 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[12px] font-semibold text-[#071D49]">{item.number}</span><h2 className="truncate text-[15px] font-semibold leading-tight text-[#071D49]">{item.title}</h2></div>{persistedVerified ? <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Verified</span> : null}</div><div className="grid grid-cols-[64px_1fr] gap-3"><div className={`grid h-[64px] w-[64px] place-items-center rounded-xl ${item.accent}`}><div className="text-[30px] leading-none">{item.icon}</div></div><div className="min-w-0"><p className="truncate text-[12px] font-medium text-[#071D49]">{item.document?.file_name ?? "Document not uploaded"}</p>{item.document?.signedUrl ? <Link href={item.document.signedUrl} target="_blank" className="mt-0.5 inline-block text-[12px] font-medium text-[#139657]">Preview</Link> : <p className="mt-0.5 text-[12px] font-medium text-[#8B98A9]">{statusLabel(status)}</p>}<p className="mt-1 text-[10px] leading-4 text-[#4B596B]">Uploaded: {formatDateShort(item.document?.created_at)}</p>{persistedVerified ? <p className="mt-1 text-[10px] font-semibold text-green-700">Details saved</p> : invalidAttempt ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-red-700">{invalidAttempt.invalid_reason}</p> : null}</div></div><div className="mt-3 grid grid-cols-3 gap-2">{item.document ? persistedVerified ? <button disabled className="h-8 rounded-md border border-green-200 bg-green-100 text-[12px] font-semibold text-green-700">Verified</button> : <VerificationActionButton claimId={claim.id} documentId={item.document.id} itemKey={item.key} incidentDate={claim.accident_at} /> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-400">Verify</button>}{item.document?.signedUrl ? <Link href={item.document.signedUrl} target="_blank" className="flex h-8 items-center justify-center rounded-md border border-[#4C68A6] bg-white text-[12px] font-semibold text-[#174EA6]">Reload</Link> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-400">Reload</button>}<ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentType={item.documentType} label={item.title} /></div></article>;
}

function buildDocumentItems(documents: SpotSurveyDocument[]): Item[] {
  const doc = (key: keyof typeof aliases) => documents.find((d) => aliases[key].includes(d.document_type.toLowerCase()) && d.verification_status !== "rejected") ?? documents.find((d) => aliases[key].includes(d.document_type.toLowerCase())) ?? null;
  return [{ key: "rc", number: 1, title: "RC Copy", icon: "📄", accent: "bg-[#F1ECFF]", documentType: "Registration certificate", document: doc("rc") }, { key: "insurance", number: 2, title: "Insurance Copy", icon: "📃", accent: "bg-[#FFF3D9]", documentType: "Policy copy", document: doc("insurance") }, { key: "dl", number: 3, title: "Driving Licence Copy", icon: "🪪", accent: "bg-[#EAF8EF]", documentType: "Driving licence", document: doc("dl") }, { key: "gr", number: 4, title: "GR / Load Challan Copy", icon: "🚚", accent: "bg-[#FFF1E6]", documentType: "GR Copy / Road Challan", document: doc("gr") }];
}

function latestVerificationForItem(item: Item, verifications: SpotSurveyVerification[]) { return verifications.find((row) => item.document?.id && row.document_id === item.document.id) ?? verifications.find((row) => row.verification_type === item.key && row.is_valid) ?? verifications.find((row) => row.verification_type === item.key); }
function latestDetailVerification(detailKey: string, verifications: SpotSurveyVerification[]) { return verifications.find((row) => row.verification_type === "detail" && getDetailKey(row) === detailKey && row.is_valid) ?? verifications.find((row) => row.verification_type === "detail" && getDetailKey(row) === detailKey); }
function getDetailKey(row: SpotSurveyVerification) { const value = row.details?.spot_survey_detail_key; return typeof value === "string" ? value : ""; }
function isItemVerified(item: Item, verifications: SpotSurveyVerification[]) { return item.document?.verification_status === "verified" || Boolean(latestVerificationForItem(item, verifications)?.is_valid); }
function extractDriverNumber(value?: string | null) { return value?.match(/[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}/i)?.[0] ?? null; }
function statusLabel(status: string) { if (status === "verified") return "Verified"; if (status === "rejected") return "Rejected"; return "Pending verification"; }
function formatDateShort(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"; }
