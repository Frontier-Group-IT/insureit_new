import Link from "next/link";
import { ReplaceDocumentButton } from "./replace-document-button";
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

type BrandLogo = { src: string; label: string };

const aliases = {
  rc: ["rc copy", "registration certificate"],
  insurance: ["insurance copy", "policy copy"],
  dl: ["driving licence", "driving licence copy", "dl copy"],
  gr: ["gr copy / road challan", "gr / load challan copy", "road challan", "load challan"]
};

const vehicleBrandLogos: Record<string, BrandLogo> = {
  "ashok leyland": { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  leyland: { src: "/assets/vehicle-brands/ashok-leyland.svg", label: "Ashok Leyland" },
  honda: { src: "/assets/vehicle-brands/honda.svg", label: "Honda" },
  toyota: { src: "/assets/vehicle-brands/toyota.svg", label: "Toyota" },
  kia: { src: "/assets/vehicle-brands/kia.svg", label: "Kia" },
  "kia motors": { src: "/assets/vehicle-brands/kia.svg", label: "Kia" },
  maruti: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  suzuki: { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  "maruti suzuki": { src: "/assets/vehicle-brands/maruti-suzuki.svg", label: "Maruti Suzuki" },
  mahindra: { src: "/assets/vehicle-brands/mahindra.svg", label: "Mahindra" },
  "mahindra and mahindra": { src: "/assets/vehicle-brands/mahindra.svg", label: "Mahindra" },
  tata: { src: "/assets/vehicle-brands/tata.svg", label: "Tata Motors" },
  "tata motors": { src: "/assets/vehicle-brands/tata.svg", label: "Tata Motors" },
  hyundai: { src: "/assets/vehicle-brands/hyundai.svg", label: "Hyundai" },
  "hyundai motors": { src: "/assets/vehicle-brands/hyundai.svg", label: "Hyundai" }
};

const insurerBrandLogos: Record<string, BrandLogo> = {
  "bajaj allianz": { src: "/assets/insurers/bajaj-allianz.png", label: "Bajaj Allianz" },
  bajaj: { src: "/assets/insurers/bajaj-allianz.png", label: "Bajaj Allianz" },
  "icici lombard": { src: "/assets/insurers/icici-lombard.png", label: "ICICI Lombard" },
  "hdfc ergo": { src: "/assets/insurers/hdfc-ergo.png", label: "HDFC ERGO" },
  "tata aig": { src: "/assets/insurers/tata-aig.png", label: "TATA AIG" },
  "new india": { src: "/assets/insurers/new-india-assurance.png", label: "New India Assurance" },
  oriental: { src: "/assets/insurers/oriental-insurance.png", label: "Oriental Insurance" },
  "united india": { src: "/assets/insurers/united-india-insurance.png", label: "United India" },
  national: { src: "/assets/insurers/national-insurance.png", label: "National Insurance" },
  reliance: { src: "/assets/insurers/reliance-general.png", label: "Reliance General" },
  "iffco tokio": { src: "/assets/insurers/iffco-tokio.png", label: "IFFCO Tokio" },
  "royal sundaram": { src: "/assets/insurers/royal-sundaram.png", label: "Royal Sundaram" },
  "sbi general": { src: "/assets/insurers/sbi-general.png", label: "SBI General" },
  "future generali": { src: "/assets/insurers/future-generali.png", label: "Future Generali" },
  "kotak general": { src: "/assets/insurers/kotak-general.png", label: "Kotak General" }
};

export function SpotSurveyWorkspace({ claim, documents, verifications = [] }: { claim: SpotSurveyClaim; documents: SpotSurveyDocument[]; verifications?: SpotSurveyVerification[] }) {
  const items = buildDocumentItems(documents);
  const verifiedCount = items.filter((item) => isItemVerified(item, verifications)).length;
  const driverName = extractDriverName(claim.accident_description);
  const driverMobile = extractDriverMobile(claim.accident_description) ?? claim.customers?.phone ?? null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-6">
      <InfoStrip claim={claim} />

      <SpotSurveyDetailsPanel driverName={driverName} driverMobile={driverMobile} lossLocation={claim.accident_location} />

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
  const manufacturer = claim.vehicles?.make || "-";
  return (
    <section className="grid overflow-hidden rounded-2xl border border-[#DFE8F4] bg-[#F8FBFF] shadow-[0_6px_18px_rgba(7,29,73,0.03)] md:grid-cols-4 xl:grid-cols-8">
      <Info icon="👤" label="Customer" title={customerName} subtitle={claim.customers?.phone ?? "-"} />
      <Info icon="🚗" label="Vehicle No." title={claim.vehicles?.vehicle_no ?? "-"} />
      <Info label="Manufacturer" title={manufacturer} subtitle={claim.vehicles?.model ?? "-"} logo={<ManufacturerLogo name={manufacturer} />} />
      <Info label="Insurer" title={insurer} subtitle={insurerRef} logo={<InsurerLogo name={insurer} />} />
      <Info icon="📅" label="Loss Date" title={formatDateShort(claim.accident_at)} />
      <Info icon="🧾" label="Policy No." title={claim.policies?.policy_no ?? "-"} />
      <Info icon="#" label="Control No." title={claim.claim_no} />
      <Info icon="▣" label="Claim No." title={claim.insurer_claim_no ?? "-"} subtitle={claim.current_status ?? undefined} last />
    </section>
  );
}

function Info({ icon, label, title, subtitle, logo, last = false }: { icon?: string; label: string; title: string; subtitle?: string | null; logo?: React.ReactNode; last?: boolean }) {
  return <div className={`flex min-h-[78px] items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[#DFE8F4] md:border-b-0 md:border-r"}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[20px]">{logo ?? icon}</div><div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[0.04em] leading-4 text-[#174EA6]">{label}</p><p className="mt-0.5 truncate text-[14px] font-semibold leading-5 text-[#071D49]">{title}</p>{subtitle ? <p className="truncate text-[12px] leading-4 text-[#1F2B3D]">{subtitle}</p> : null}</div></div>;
}

function SpotSurveyDetailsPanel({ driverName, driverMobile, lossLocation }: { driverName: string | null; driverMobile: string | null; lossLocation: string | null }) {
  const mapHref = lossLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lossLocation)}` : null;
  return (
    <section className="rounded-xl border border-[#DFE8F4] bg-white px-3 py-2 shadow-[0_5px_14px_rgba(7,29,73,0.025)]">
      <div className="grid gap-2 lg:grid-cols-3">
        <CompactDetail icon="👤" label="Driver Name" value={driverName || "Not available"} />
        <CompactDetail icon="☎" label="Mobile No." value={driverMobile || "Not available"} href={driverMobile ? `tel:${driverMobile}` : undefined} />
        <CompactDetail icon="📍" label="Loss Location" value={lossLocation || "Not available"} href={mapHref ?? undefined} />
      </div>
    </section>
  );
}

function CompactDetail({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const content = <><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEF4FC] text-[16px]">{icon}</span><span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{label}</span><span className="block truncate text-[13px] font-semibold text-[#071D49]">{value}</span></span></>;
  if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#E2EAF4] bg-[#FBFCFE] px-3 py-2 transition hover:border-[#174EA6] hover:bg-[#F4F8FF]">{content}</a>;
  return <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#E2EAF4] bg-[#FBFCFE] px-3 py-2">{content}</div>;
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

function ManufacturerLogo({ name }: { name: string }) {
  const brand = findBrand(name, vehicleBrandLogos);
  if (!brand) return <span className="text-[14px] font-bold text-[#003A83]">{name && name !== "-" ? name.charAt(0).toUpperCase() : "V"}</span>;
  return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-9 object-contain" />;
}

function InsurerLogo({ name }: { name: string }) {
  const brand = findBrand(name, insurerBrandLogos);
  if (!brand) return <span className="text-[8px] font-bold uppercase text-[#003A83]">ins</span>;
  return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-10 object-contain" />;
}

function findBrand(name: string, map: Record<string, BrandLogo>) {
  const normalized = normalizeBrand(name);
  return map[normalized] ?? Object.entries(map).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1];
}

function normalizeBrand(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function latestVerificationForItem(item: Item, verifications: SpotSurveyVerification[]) { return verifications.find((row) => item.document?.id && row.document_id === item.document.id) ?? verifications.find((row) => row.verification_type === item.key && row.is_valid) ?? verifications.find((row) => row.verification_type === item.key); }
function isItemVerified(item: Item, verifications: SpotSurveyVerification[]) { return item.document?.verification_status === "verified" || Boolean(latestVerificationForItem(item, verifications)?.is_valid); }
function extractDriverName(value?: string | null) { if (!value) return null; return value.match(/driver\s*name\s*[:\-]\s*([^,\n]+)/i)?.[1]?.trim() ?? value.match(/driver\s*[:\-]\s*([^,\n]+)/i)?.[1]?.trim() ?? null; }
function extractDriverMobile(value?: string | null) { if (!value) return null; return value.match(/(?:driver\s*)?(?:mobile|phone|contact)\s*[:\-]\s*(\+?\d[\d\s-]{8,14}\d)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? value.match(/\b(?:\+91[-\s]?)?[6-9]\d{9}\b/)?.[0] ?? null; }
function statusLabel(status: string) { if (status === "verified") return "Verified"; if (status === "rejected") return "Rejected"; return "Pending verification"; }
function formatDateShort(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"; }
