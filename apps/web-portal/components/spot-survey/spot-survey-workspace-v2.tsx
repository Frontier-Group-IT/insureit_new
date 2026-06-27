import Link from "next/link";
import type { ReactNode } from "react";
import { DocumentVerificationDetailsButton } from "./document-verification-details-button";
import { ReplaceDocumentButton } from "./replace-document-button";
import { RequestReuploadButton } from "./request-reupload-button";
import { SurveyorDeputationForm } from "./surveyor-deputation-form";
import { VerificationActionButton } from "./verification-action-button";

export type SpotSurveyClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no?: string | null;
  customer_id: string;
  current_status?: string | null;
  accident_at?: string | null;
  accident_location: string | null;
  accident_description: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null; policy_type?: string | null; start_date?: string | null; end_date?: string | null } | null;
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

export type SurveyorDetails = {
  name: string;
  mobile: string;
  email: string;
  deputedAt?: string | null;
};

type Item = { key: string; number: number; title: string; icon: string; accent: string; documentType: string; document?: SpotSurveyDocument | null };
type BrandLogo = { src: string; label: string };

const aliases = {
  rc: ["rc copy", "registration certificate"],
  insurance: ["insurance copy", "policy copy"],
  dl: ["driving licence", "driving licence copy", "dl copy"],
  gr: ["gr copy / road challan", "gr / load challan copy", "road challan", "load challan"]
};

const vehicleBrandLogos: Record<string, BrandLogo> = {
  tata: { src: "/assets/vehicle-brands/tata.svg", label: "Tata Motors" },
  mahindra: { src: "/assets/vehicle-brands/mahindra.svg", label: "Mahindra" },
  hyundai: { src: "/assets/vehicle-brands/hyundai.svg", label: "Hyundai" },
  honda: { src: "/assets/vehicle-brands/honda.svg", label: "Honda" },
  toyota: { src: "/assets/vehicle-brands/toyota.svg", label: "Toyota" },
  kia: { src: "/assets/vehicle-brands/kia.svg", label: "Kia" },
  maruti: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  suzuki: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  leyland: { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" }
};

const insurerBrandLogos: Record<string, BrandLogo> = {
  bajaj: { src: "/assets/insurers/bajaj-allianz.png", label: "Bajaj Allianz" },
  icici: { src: "/assets/insurers/icici-lombard.png", label: "ICICI Lombard" },
  hdfc: { src: "/assets/insurers/hdfc-ergo.png", label: "HDFC ERGO" },
  tata: { src: "/assets/insurers/tata-aig.png", label: "TATA AIG" },
  reliance: { src: "/assets/insurers/reliance-general.png", label: "Reliance General" },
  sbi: { src: "/assets/insurers/sbi-general.png", label: "SBI General" }
};

export function SpotSurveyWorkspace({ claim, documents, verifications = [], surveyorDetails = null }: { claim: SpotSurveyClaim; documents: SpotSurveyDocument[]; verifications?: SpotSurveyVerification[]; surveyorDetails?: SurveyorDetails | null }) {
  const items = buildDocumentItems(documents);
  const verifiedCount = items.filter((item) => isItemVerified(item, verifications)).length;
  const allDocumentsVerified = items.length > 0 && verifiedCount === items.length;
  const driverName = extractDriverName(claim.accident_description);
  const driverMobile = extractDriverMobile(claim.accident_description) ?? claim.customers?.phone ?? null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-2 pb-4">
      <InfoStrip claim={claim} />
      <SpotSurveyDetailsPanel driverName={driverName} driverMobile={driverMobile} lossLocation={claim.accident_location} />
      <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(7,29,73,0.04)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#071D49]">Document Verification</h1>
            <p className="mt-0.5 text-[12px] leading-5 text-[#4B596B]">Verify customer-uploaded documents and request reupload when a file is unclear, expired, or invalid.</p>
          </div>
          <div className="rounded-xl bg-[#F4F7FC] px-3 py-2 text-right"><p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#68758A]">Documents Verified</p><p className="text-[17px] font-semibold text-[#071D49]">{verifiedCount}/{items.length}</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <DocumentCard key={item.key} item={item} claim={claim} verification={latestVerificationForItem(item, verifications)} />)}</div>
        {allDocumentsVerified ? (claim.current_status === "Surveyor Appointed" ? <SurveyorAssignedNotice details={surveyorDetails} /> : <SurveyorDeputationForm claimId={claim.id} />) : <div className="mt-3 rounded-xl border border-[#E4ECF6] bg-[#FBFCFE] p-3 text-[12px] font-semibold text-[#526178]">Complete all required document verification to enable spot surveyor deputation.</div>}
      </section>
    </div>
  );
}

function SurveyorAssignedNotice({ details }: { details?: SurveyorDetails | null }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#D9E3F0] bg-[#FBFCFE] p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF7] pb-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#071D49]">Spot Surveyor Details</h2>
          <p className="mt-1 text-[12px] font-medium text-[#526178]">Click &apos;Survey Done&apos; to move into next stage.</p>
        </div>
        <button type="button" className="h-10 rounded-lg bg-[#071D49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">
          Survey Done
        </button>
      </div>
      <div className="mt-3 grid overflow-hidden rounded-xl border border-[#E6EEF7] bg-white md:grid-cols-3">
        <SurveyorColumn label="Surveyor Name" value={details?.name || "Not available"} />
        <SurveyorColumn label="Mobile No." value={details?.mobile || "Not available"} href={details?.mobile ? `tel:${details.mobile}` : undefined} />
        <SurveyorColumn label="Email ID" value={details?.email || "Not available"} href={details?.email ? `mailto:${details.email}` : undefined} last />
      </div>
      {details?.deputedAt ? <p className="mt-2 text-right text-[11px] font-semibold text-[#526178]">Deputed on {formatDateShort(details.deputedAt)}</p> : null}
    </div>
  );
}

function SurveyorColumn({ label, value, href, last = false }: { label: string; value: string; href?: string; last?: boolean }) {
  const content = <><span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#68758A]">{label}</span><span className="mt-1 block truncate text-[15px] font-semibold tracking-[-0.01em] text-[#071D49]">{value}</span></>;
  const className = `min-w-0 px-4 py-3 ${last ? "" : "border-b border-[#E6EEF7] md:border-b-0 md:border-r"}`;
  return href ? <a href={href} className={`${className} transition hover:bg-[#F7FAFF]`}>{content}</a> : <div className={className}>{content}</div>;
}

function InfoStrip({ claim }: { claim: SpotSurveyClaim }) { const customerName = claim.customers?.company_name || claim.customers?.contact_name || "-"; const insurer = claim.insurance_companies?.name || "-"; const insurerRef = claim.insurer_claim_no || claim.policies?.policy_no || claim.claim_no; const make = claim.vehicles?.make || "-"; const model = claim.vehicles?.model || "-"; return <section className="grid overflow-hidden rounded-2xl border border-[#DFE8F4] bg-[#F8FBFF] shadow-[0_6px_18px_rgba(7,29,73,0.03)] md:grid-cols-3 xl:grid-cols-5"><Info icon="👤" label="Customer" title={customerName} subtitle={claim.customers?.phone ?? "-"} /><Info icon="🚗" label="Vehicle No." title={claim.vehicles?.vehicle_no ?? "-"} /><Info label="Make & Model" title={make} subtitle={model} logo={<ManufacturerLogo name={make} />} /><Info label="Insurer" title={insurer} subtitle={insurerRef} logo={<InsurerLogo name={insurer} />} /><Info icon="📅" label="Loss Date" title={formatDateShort(claim.accident_at)} /><Info icon="🧾" label="Policy No." title={claim.policies?.policy_no ?? "-"} /><Info icon="#" label="Control No." title={claim.claim_no} /><Info icon="▣" label="Claim No." title={claim.insurer_claim_no ?? "-"} /><Info icon="✓" label="Claim Status" title={claim.current_status ?? "-"} last /></section>; }
function Info({ icon, label, title, subtitle, logo, last = false }: { icon?: string; label: string; title: string; subtitle?: string | null; logo?: ReactNode; last?: boolean }) { return <div className={`flex min-h-[78px] items-start gap-3 px-4 py-3 ${last ? "" : "border-b border-[#DFE8F4] md:border-b-0 md:border-r"}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[20px]">{logo ?? icon}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-medium uppercase tracking-[0.04em] leading-4 text-[#174EA6]">{label}</p><p className="mt-0.5 whitespace-normal break-words text-[14px] font-semibold leading-5 text-[#071D49]">{title}</p>{subtitle ? <p className="whitespace-normal break-words text-[12px] leading-4 text-[#1F2B3D]">{subtitle}</p> : null}</div></div>; }
function SpotSurveyDetailsPanel({ driverName, driverMobile, lossLocation }: { driverName: string | null; driverMobile: string | null; lossLocation: string | null }) { const mapHref = lossLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lossLocation)}` : null; return <section className="grid min-h-[42px] items-center overflow-hidden rounded-xl border border-[#DFE8F4] bg-white shadow-[0_4px_12px_rgba(7,29,73,0.025)] lg:grid-cols-[220px_220px_1fr]"><StripDetail icon="👤" label="Driver" value={driverName || "Not available"} /><StripDetail icon="☎" label="Mobile" value={driverMobile || "Not available"} href={driverMobile ? `tel:${driverMobile}` : undefined} /><StripDetail icon="📍" label="Loss Location" value={lossLocation || "Not available"} href={mapHref ?? undefined} isLocation /></section>; }
function StripDetail({ icon, label, value, href, isLocation = false }: { icon: string; label: string; value: string; href?: string; isLocation?: boolean }) { const content = <><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#EEF4FC] text-[13px]">{icon}</span><span className="min-w-0 flex-1"><span className="mr-1 inline text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{label}:</span><span className={`text-[12px] font-semibold leading-4 text-[#071D49] ${isLocation ? "whitespace-normal break-words" : "truncate"}`}>{value}</span></span>{isLocation ? <span className="ml-2 shrink-0 rounded-full border border-[#BFD3F7] bg-[#EEF4FF] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Map</span> : null}</>; const className = "flex min-h-[42px] items-center gap-2 border-b border-[#E8EFF8] px-3 py-1.5 transition last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"; if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className={`${className} ${isLocation ? "cursor-pointer bg-[#F8FBFF] hover:bg-[#F1F7FF]" : "hover:bg-[#F8FBFF]"}`}>{content}</a>; return <div className={className}>{content}</div>; }
function DocumentCard({ item, claim, verification }: { item: Item; claim: SpotSurveyClaim; verification?: SpotSurveyVerification }) { const status = item.document?.verification_status ?? "pending"; const persistedVerified = Boolean(verification?.is_valid) || status === "verified"; const reuploadRequested = status === "rejected"; const invalidAttempt = verification && !verification.is_valid ? verification : undefined; const statusTone = persistedVerified ? "green" : reuploadRequested || invalidAttempt ? "amber" : "slate"; const currentStatus = persistedVerified ? "Verified" : reuploadRequested ? "Reupload requested" : invalidAttempt ? "Invalid" : statusLabel(status); const effectiveVerification = persistedVerified && item.document ? verification ?? fallbackVerification(claim, item, item.document) : verification; return <article className={`rounded-xl border p-3 shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${persistedVerified ? "border-green-200 bg-green-50/35" : reuploadRequested || invalidAttempt ? "border-amber-200 bg-amber-50/25" : "border-[#E2EAF4] bg-white"}`}><div className="mb-2 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[12px] font-semibold text-[#071D49]">{item.number}</span><h2 className="truncate text-[15px] font-semibold leading-tight text-[#071D49]">{item.title}</h2></div><StatusBadge tone={statusTone} label={persistedVerified ? "Verified" : reuploadRequested ? "Reupload Needed" : invalidAttempt ? "Invalid" : statusLabel(status)} /></div><div className="grid grid-cols-[54px_1fr] gap-3"><div className={`grid h-[54px] w-[54px] place-items-center rounded-xl ${item.accent}`}><div className="text-[26px] leading-none">{item.icon}</div></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#071D49]">{item.document?.file_name ?? "Document not uploaded"}</p><div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="rounded bg-[#F4F7FC] px-2 py-0.5 text-[10px] font-semibold text-[#526178]">{item.documentType}</span>{item.document?.signedUrl ? <Link href={item.document.signedUrl} target="_blank" className="rounded bg-[#EAF7F0] px-2 py-0.5 text-[10px] font-semibold text-[#00875A]">Preview</Link> : null}</div><div className="mt-2 grid grid-cols-2 gap-1 text-[10px] leading-4 text-[#4B596B]"><span>Uploaded</span><span className="text-right font-semibold text-[#071D49]">{formatDateShort(item.document?.created_at)}</span><span>Status</span><span className="text-right font-semibold text-[#071D49]">{currentStatus}</span></div>{persistedVerified ? <p className="mt-1 text-[10px] font-semibold text-green-700">Verification details saved</p> : reuploadRequested ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-amber-700">{item.document?.rejection_reason ?? "Customer reupload requested."}</p> : invalidAttempt ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-amber-700">{invalidAttempt.invalid_reason}</p> : null}</div></div>{persistedVerified && item.document && effectiveVerification ? <div className="mt-3 grid grid-cols-1 gap-2"><DocumentVerificationDetailsButton document={item.document} verification={effectiveVerification} title={item.title} /></div> : reuploadRequested ? <div className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-amber-700">Reupload requested</div> : <div className="mt-3 grid grid-cols-3 gap-2">{item.document ? <VerificationActionButton claimId={claim.id} documentId={item.document.id} itemKey={item.key} incidentDate={claim.accident_at} policyStartDate={claim.policies?.start_date} policyEndDate={claim.policies?.end_date} /> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-400">Verify</button>}{item.document ? <RequestReuploadButton claimId={claim.id} documentId={item.document.id} documentTitle={item.title} /> : <button disabled className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-400">Reupload</button>}<ReplaceDocumentButton claimId={claim.id} customerId={claim.customer_id} documentType={item.documentType} label={item.title} /></div>}</article>; }
function StatusBadge({ tone, label }: { tone: "green" | "amber" | "slate"; label: string }) { const className = tone === "green" ? "border-green-200 bg-green-100 text-green-700" : tone === "amber" ? "border-amber-200 bg-amber-100 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-600"; return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>; }
function buildDocumentItems(documents: SpotSurveyDocument[]): Item[] { const doc = (key: keyof typeof aliases) => documents.find((d) => aliases[key].includes(d.document_type.toLowerCase()) && d.verification_status !== "rejected") ?? documents.find((d) => aliases[key].includes(d.document_type.toLowerCase())) ?? null; return [{ key: "rc", number: 1, title: "RC Copy", icon: "📄", accent: "bg-[#F1ECFF]", documentType: "Registration certificate", document: doc("rc") }, { key: "insurance", number: 2, title: "Insurance Copy", icon: "📃", accent: "bg-[#FFF3D9]", documentType: "Policy copy", document: doc("insurance") }, { key: "dl", number: 3, title: "Driving Licence Copy", icon: "🪪", accent: "bg-[#EAF8EF]", documentType: "Driving licence", document: doc("dl") }, { key: "gr", number: 4, title: "GR / Load Challan Copy", icon: "🚚", accent: "bg-[#FFF1E6]", documentType: "GR Copy / Road Challan", document: doc("gr") }]; }
function fallbackVerification(claim: SpotSurveyClaim, item: Item, document: SpotSurveyDocument): SpotSurveyVerification { return { id: `fallback-${document.id}`, claim_id: claim.id, document_id: document.id, document_type: document.document_type || item.documentType, verification_type: item.key === "rc" ? "rc" : item.key === "insurance" ? "insurance" : "document", incident_date: claim.accident_at ?? null, is_valid: true, invalid_reason: null, details: { document_type: document.document_type || item.documentType, document_id: document.id, file_name: document.file_name, verified: true, note: "This document is verified, but detailed expiry fields were not found in verification history." }, created_at: document.created_at ?? new Date().toISOString() }; }
function ManufacturerLogo({ name }: { name: string }) { const brand = findBrand(name, vehicleBrandLogos); if (!brand) return <span className="text-[14px] font-bold text-[#003A83]">{name && name !== "-" ? name.charAt(0).toUpperCase() : "V"}</span>; return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-9 object-contain" />; }
function InsurerLogo({ name }: { name: string }) { const brand = findBrand(name, insurerBrandLogos); if (!brand) return <span className="text-[8px] font-bold uppercase text-[#003A83]">ins</span>; return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-9 object-contain" />; }
function findBrand(name: string, logos: Record<string, BrandLogo>) { const normalized = name.toLowerCase(); return Object.entries(logos).find(([key]) => normalized.includes(key))?.[1] ?? null; }
function latestVerificationForItem(item: Item, verifications: SpotSurveyVerification[]) { return verifications.find((verification) => { if (verification.document_id && item.document?.id) return verification.document_id === item.document.id; return aliases[item.key as keyof typeof aliases]?.some((alias) => verification.document_type.toLowerCase().includes(alias)); }); }
function isItemVerified(item: Item, verifications: SpotSurveyVerification[]) { const verification = latestVerificationForItem(item, verifications); return Boolean(verification?.is_valid) || item.document?.verification_status === "verified"; }
function statusLabel(status: SpotSurveyDocument["verification_status"]) { if (status === "verified") return "Verified"; if (status === "rejected") return "Rejected"; return "Pending"; }
function formatDateShort(value?: string | null) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function extractDriverName(description?: string | null) { if (!description) return null; const match = description.match(/driver\s*[:\-]\s*([^,;\n]+)/i) ?? description.match(/driver name\s*[:\-]\s*([^,;\n]+)/i); return match?.[1]?.trim() ?? null; }
function extractDriverMobile(description?: string | null) { if (!description) return null; const match = description.match(/(?:mobile|phone|contact)\s*[:\-]\s*(\+?\d[\d\s-]{7,})/i) ?? description.match(/\b(\+?91[-\s]?)?[6-9]\d{9}\b/); return match?.[0]?.replace(/^(mobile|phone|contact)\s*[:\-]\s*/i, "").trim() ?? null; }
