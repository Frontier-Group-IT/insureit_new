import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BulkDocumentVerificationGroup, type BulkDocumentGroupItem } from "./bulk-document-verification-group";
import { SurveyDoneButton } from "./survey-done-button";
import { SurveyorDeputationForm } from "./surveyor-deputation-form";
import { FinalizeInitialDocumentVerificationButton } from "./finalize-initial-document-verification-button";
import { classifySpotSurveyAttachmentForm } from "@/app/claims/[id]/spot-survey-actions";
import type { InternalSpotIntimationDetails } from "@/lib/internal-spot-intimation";

export type SpotSurveyClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no?: string | null;
  customer_id: string;
  current_status?: string | null;
  accident_at?: string | null;
  created_at?: string | null;
  accident_location: string | null;
  accident_description: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null; policy_type?: string | null; start_date?: string | null; end_date?: string | null; premium_amount?: number | null; insured_declared_value?: number | null } | null;
  insurance_companies: { name: string | null } | null;
  policySource?: "sibl" | "external";
  policyCopy?: { fileName: string; signedUrl: string; documentId: string } | null;
  spotIntimationAt?: string | null;
  spotDetails?: InternalSpotIntimationDetails | null;
};

export type SpotSurveyDocument = {
  id: string;
  document_type: string | null;
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

type BrandLogo = { src: string; label: string };

const aliases = {
  spot: ["spot photo", "spot image", "accident photo", "loss photo", "vehicle photo"],
  rc: ["rc copy", "registration certificate"],
  insurance: ["insurance copy", "policy copy"],
  dl: ["driver licence", "driving licence", "driving licence copy", "dl copy"],
  gr: ["gr / load bill", "gr copy / load challan", "gr copy / road challan", "gr / load challan", "road challan", "load challan"],
  video: ["accident video", "loss video", "vehicle video"],
  audio: ["incident voice note", "voice note", "incident audio", "accident audio"]
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

const claimHeaderIcons = {
  customer: "/assets/Custom-Icons/optimized-128/customers.png",
  vehicle: "/assets/Custom-Icons/optimized-128/fleet-vehicle.png",
  lossDate: "/assets/Custom-Icons/optimized-128/claims-intimated-today.png",
  policy: "/assets/Custom-Icons/optimized-128/policy.png",
  control: "/assets/Custom-Icons/optimized-128/tasks-work-queue.png",
  claim: "/assets/Custom-Icons/optimized-128/claims.png",
  status: "/assets/Custom-Icons/optimized-128/claim-approval.png",
  intimation: "/assets/Custom-Icons/optimized-128/claim-intimation.png"
} as const;

export function SpotClaimHeader({ claim }: { claim: SpotSurveyClaim }) {
  return <InfoStrip claim={claim} />;
}

export function SpotSurveyWorkspace({ claim, documents, verifications = [], surveyorDetails = null, showContext = true, showSpotDetails = true }: { claim: SpotSurveyClaim; documents: SpotSurveyDocument[]; verifications?: SpotSurveyVerification[]; surveyorDetails?: SurveyorDetails | null; showContext?: boolean; showSpotDetails?: boolean }) {
  const items = buildDocumentItems(documents);
  const unclassifiedAttachments = documents.filter(isUnclassifiedSpotAttachment);
  const verifiedCount = items.filter((item) => isItemVerified(item, verifications)).length;
  const allDocumentsVerified = items.length > 0 && verifiedCount === items.length;
  const canFinalizeInitialDocuments = ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Pending", "Documents Submitted"].includes(claim.current_status ?? "");
  const driverName = claim.spotDetails?.driver_name ?? extractDriverName(claim.accident_description);
  const driverMobile = claim.spotDetails?.driver_phone ?? extractDriverMobile(claim.accident_description) ?? claim.customers?.phone ?? null;
  const lossLocation = claim.spotDetails?.location ?? claim.accident_location;

  return (
    <div className="mx-auto max-w-[1440px] space-y-2 pb-4">
      {showContext ? <SpotClaimHeader claim={claim} /> : null}
      {showSpotDetails ? <SpotSurveyDetailsPanel driverName={driverName} driverMobile={driverMobile} lossLocation={lossLocation} /> : null}
      {unclassifiedAttachments.length ? <UnclassifiedAttachments claimId={claim.id} documents={unclassifiedAttachments} /> : null}
      <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(7,29,73,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#071D49]">Document Verification</h1>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#F4F7FC] px-2.5 py-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">Documents Verified</span>
            <span className="text-[12px] font-semibold text-[#071D49]">{verifiedCount} / {items.length}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <BulkDocumentVerificationGroup key={item.key} item={item} claim={claim} verifications={verifications} />)}
        </div>
        {allDocumentsVerified ? (
          claim.current_status === "Surveyor Appointed" ? <SurveyorAssignedNotice claimId={claim.id} details={surveyorDetails} /> :
          claim.current_status === "Initial Documents Verified" || claim.current_status === "Claim Intimated" ? <SurveyorDeputationForm claimId={claim.id} /> :
          canFinalizeInitialDocuments ? <FinalizeInitialDocumentVerificationButton claimId={claim.id} /> : null
        ) : null}
      </section>
    </div>
  );
}

function SurveyorAssignedNotice({ claimId, details }: { claimId: string; details?: SurveyorDetails | null }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#D9E3F0] bg-[#FBFCFE] p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF7] pb-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#071D49]">Spot Surveyor Details</h2>
          <p className="mt-1 text-[12px] font-medium text-[#526178]">Click &apos;Survey Done&apos; to move into next stage.</p>
        </div>
        <SurveyDoneButton claimId={claimId} />
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

function InfoStrip({ claim }: { claim: SpotSurveyClaim }) {
  const customerName = claim.customers?.company_name || claim.customers?.contact_name || "-";
  const insurer = claim.insurance_companies?.name || "-";
  const insurerRef = claim.insurer_claim_no || claim.policies?.policy_no || claim.claim_no;
  const make = claim.vehicles?.make || "-";
  const model = claim.vehicles?.model || "-";
  const makeModel = [make, model].filter((value) => value && value !== "-").join(" - ") || "-";
  const insurerDisplay = insurerRef && insurerRef !== "-" ? `${insurer} - ${insurerRef}` : insurer;
  const spotAt = claim.spotIntimationAt ?? claim.created_at;
  return <section className="overflow-hidden rounded-2xl border border-[#17355E] bg-[#071D49] shadow-[0_8px_22px_rgba(7,29,73,0.16)]"><div className="grid md:grid-cols-3 xl:grid-cols-5"><Info label="Customer" title={customerName} subtitle={claim.customers?.phone ?? "-"} logo={<HeaderIcon src={claimHeaderIcons.customer} alt="Customer" />} /><Info label="Vehicle No." title={claim.vehicles?.vehicle_no ?? "-"} logo={<HeaderIcon src={claimHeaderIcons.vehicle} alt="Vehicle" />} /><Info label="Make & Model" title={makeModel} logo={<ManufacturerLogo name={make} />} /><Info label="Insurer" title={insurerDisplay} logo={<InsurerLogo name={insurer} />} /><Info label="Loss Date" title={formatDateShort(claim.accident_at)} logo={<HeaderIcon src={claimHeaderIcons.lossDate} alt="Loss date" />} last /></div><div className="grid border-t border-white/15 md:grid-cols-3 xl:grid-cols-5"><Info label="Policy No." title={claim.policies?.policy_no ?? "-"} logo={<HeaderIcon src={claimHeaderIcons.policy} alt="Policy" />} /><Info label="Control No." title={claim.claim_no} logo={<HeaderIcon src={claimHeaderIcons.control} alt="Control number" />} /><Info label="Claim No." title={claim.insurer_claim_no ?? "-"} logo={<HeaderIcon src={claimHeaderIcons.claim} alt="Claim number" />} /><Info label="Claim Status" title={claim.current_status ?? "-"} logo={<HeaderIcon src={claimHeaderIcons.status} alt="Claim status" />} /><Info label="Spot Intimation Date & Time" title={`${formatIntimationDate(spotAt)} • ${formatIntimationTime(spotAt)}`} logo={<HeaderIcon src={claimHeaderIcons.intimation} alt="Spot intimation" />} last /></div><div className="grid gap-x-4 gap-y-1 border-t border-white/15 px-3 py-1 text-[9px] sm:grid-cols-2 lg:grid-cols-4"><PolicyMeta label="Policy source" value={claim.policySource === "external" ? "External policy" : "Sankalp policy"} /><PolicyMeta label="Cover dates" value={`${formatDateShort(claim.policies?.start_date)} - ${formatDateShort(claim.policies?.end_date)}`} /><PolicyMeta label="Premium / IDV" value={`${formatAmount(claim.policies?.premium_amount)} / ${formatAmount(claim.policies?.insured_declared_value)}`} />{claim.policyCopy?.signedUrl ? <Link href={claim.policyCopy.signedUrl} target="_blank" className="min-w-0 truncate font-semibold text-[#C7D9F7]">Policy copy: {claim.policyCopy.fileName}</Link> : <PolicyMeta label="Policy copy" value="Not available" />}</div></section>;
}

function PolicyMeta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><span className="mr-1 uppercase tracking-[0.08em] text-[#AFC3E5]">{label}:</span><span className="font-semibold text-white">{value}</span></div>;
}

function formatAmount(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-IN") : "Not available";
}

function Info({ icon, label, title, subtitle, logo, last = false }: { icon?: string; label: string; title: string; subtitle?: string | null; logo?: ReactNode; last?: boolean }) {
  return <div className={`flex min-h-[58px] items-start gap-2 px-3 py-2 ${last ? "" : "border-b border-white/15 md:border-b-0 md:border-r"}`}><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center text-[18px]">{logo ?? icon}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-medium uppercase tracking-[0.04em] leading-3.5 text-[#9FC5FF]">{label}</p><p className="mt-0.5 whitespace-normal break-words text-[13px] font-semibold leading-4 text-white">{title}</p>{subtitle ? <p className="whitespace-normal break-words text-[11px] leading-3.5 text-[#DCE6F5]">{subtitle}</p> : null}</div></div>;
}

function SpotSurveyDetailsPanel({ driverName, driverMobile, lossLocation }: { driverName: string | null; driverMobile: string | null; lossLocation: string | null }) {
  const mapHref = lossLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lossLocation)}` : null;
  return <section className="grid min-h-[42px] items-center overflow-hidden rounded-xl border border-[#DFE8F4] bg-white shadow-[0_4px_12px_rgba(7,29,73,0.025)] lg:grid-cols-[220px_220px_1fr]"><StripDetail icon="👤" label="Driver" value={driverName || "Not available"} /><StripDetail icon="☎" label="Mobile" value={driverMobile || "Not available"} href={driverMobile ? `tel:${driverMobile}` : undefined} /><StripDetail icon="📍" label="Loss Location" value={lossLocation || "Not available"} href={mapHref ?? undefined} isLocation /></section>;
}

function StripDetail({ icon, label, value, href, isLocation = false }: { icon: string; label: string; value: string; href?: string; isLocation?: boolean }) {
  const content = <><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#EEF4FC] text-[13px]">{icon}</span><span className="min-w-0 flex-1"><span className="mr-1 inline text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{label}:</span><span className={`text-[12px] font-semibold leading-4 text-[#071D49] ${isLocation ? "whitespace-normal break-words" : "truncate"}`}>{value}</span></span>{isLocation ? <span className="ml-2 shrink-0 rounded-full border border-[#BFD3F7] bg-[#EEF4FF] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Map</span> : null}</>;
  const className = "flex min-h-[42px] items-center gap-2 border-b border-[#E8EFF8] px-3 py-1.5 transition last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0";
  if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className={`${className} ${isLocation ? "cursor-pointer bg-[#F8FBFF] hover:bg-[#F1F7FF]" : "hover:bg-[#F8FBFF]"}`}>{content}</a>;
  return <div className={className}>{content}</div>;
}

function UnclassifiedAttachments({ claimId, documents }: { claimId: string; documents: SpotSurveyDocument[] }) {
  const categories = ["Accident Photo", "Accident Video", "RC Copy", "Insurance Copy", "Driver Licence", "GR / Load Bill", "Incident Voice Note"];
  return (
    <section className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[#071D49]">Unclassified Spot Attachments</h2>
          <p className="text-[12px] text-[#6E5A2B]">Assign each bulk-uploaded file to the correct verification category before verifying it.</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800">{documents.length} pending</span>
      </div>
      <div className="mt-3 space-y-2">
        {documents.map((document) => (
          <form key={document.id} action={classifySpotSurveyAttachmentForm} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#071D49]">{document.file_name}</span>
            {document.signedUrl ? <Link href={document.signedUrl} target="_blank" className="text-[11px] font-semibold text-[#174EA6]">Preview</Link> : null}
            <input type="hidden" name="claimId" value={claimId} />
            <input type="hidden" name="documentId" value={document.id} />
            <select name="documentType" defaultValue="" required className="h-8 rounded-md border border-[#B8C5D6] bg-white px-2 text-[11px] font-medium text-[#071D49]">
              <option value="" disabled>Assign category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button type="submit" className="h-8 rounded-md bg-[#071D49] px-3 text-[11px] font-semibold text-white">Classify</button>
          </form>
        ))}
      </div>
    </section>
  );
}

function buildDocumentItems(documents: SpotSurveyDocument[]): BulkDocumentGroupItem[] {
  const matches = (key: keyof typeof aliases) => documents.filter((document) => {
    const documentType = document.document_type?.toLowerCase() ?? "";
    return aliases[key].some((alias) => documentType.includes(alias));
  });
  const item = (key: keyof typeof aliases, number: number, title: string, icon: string, accent: string, documentType: string): BulkDocumentGroupItem => {
    const matching = matches(key);
    return { key, number, title, icon, accent, documentType, documents: matching, document: matching.find((document) => document.verification_status !== "rejected") ?? matching[0] ?? null };
  };
  const baseItems = [
    item("spot", 1, "Accident Photo", "📷", "bg-[#EAF4FF]", "Accident Photo"),
    item("rc", 2, "RC Copy", "📄", "bg-[#F1ECFF]", "RC Copy"),
    item("insurance", 3, "Insurance Copy", "📃", "bg-[#FFF3D9]", "Insurance Copy"),
    item("dl", 4, "Driver Licence", "🪪", "bg-[#EAF8EF]", "Driver Licence"),
    item("gr", 5, "GR / Load Bill", "🚚", "bg-[#FFF1E6]", "GR / Load Bill"),
    item("video", 6, "Accident Video", "🎥", "bg-[#F2EEFF]", "Accident Video")
  ];
  const audioItem = item("audio", 7, "Audio", "🎙️", "bg-[#EEF4FF]", "Incident Voice Note");
  return audioItem.documents.length ? [...baseItems, audioItem] : baseItems;
}

function HeaderIcon({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} width={26} height={26} className="h-[26px] w-[26px] object-contain" />;
}

function ManufacturerLogo({ name }: { name: string }) {
  const brand = findBrand(name, vehicleBrandLogos);
  if (!brand) return <span className="text-[14px] font-bold text-[#003A83]">{name && name !== "-" ? name.charAt(0).toUpperCase() : "V"}</span>;
  return <Image src={brand.src} alt={brand.label} width={36} height={24} className="max-h-6 max-w-9 object-contain" />;
}

function InsurerLogo({ name }: { name: string }) {
  const brand = findBrand(name, insurerBrandLogos);
  if (!brand) return <span className="text-[8px] font-bold uppercase text-[#003A83]">ins</span>;
  return <Image src={brand.src} alt={brand.label} width={36} height={24} className="max-h-6 max-w-9 object-contain" />;
}

function findBrand(name: string, logos: Record<string, BrandLogo>) {
  const normalized = name.toLowerCase();
  return Object.entries(logos).find(([key]) => normalized.includes(key))?.[1] ?? null;
}

function latestVerificationForDocument(document: SpotSurveyDocument, verifications: SpotSurveyVerification[]) {
  return verifications.find((verification) => verification.document_id === document.id);
}

function isItemVerified(item: BulkDocumentGroupItem, verifications: SpotSurveyVerification[]) {
  return item.documents.length > 0 && item.documents.every((document) => document.verification_status === "verified" || Boolean(latestVerificationForDocument(document, verifications)?.is_valid));
}

function isUnclassifiedSpotAttachment(document: SpotSurveyDocument) {
  const normalized = document.document_type?.trim().toLowerCase() ?? "";
  return normalized === "spot intimation attachment" || normalized === "bulk upload" || normalized === "bulk attachment" || normalized === "spot attachment";
}

function formatDateShort(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatIntimationDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

function formatIntimationTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(date);
}

function extractDriverName(description?: string | null) {
  if (!description) return null;
  const match = description.match(/driver\s*[:\-]\s*([^,;\n]+)/i) ?? description.match(/driver name\s*[:\-]\s*([^,;\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractDriverMobile(description?: string | null) {
  if (!description) return null;
  const match = description.match(/(?:mobile|phone|contact)\s*[:\-]\s*(\+?\d[\d\s-]{7,})/i) ?? description.match(/\b(\+?91[-\s]?)?[6-9]\d{9}\b/);
  return match?.[0]?.replace(/^(mobile|phone|contact)\s*[:\-]\s*/i, "").trim() ?? null;
}
