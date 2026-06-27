import { notFound } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { finalClaimDocuments, operationsQueueForStatus, type ClaimStatus } from "@/lib/claim-workflow";

type ClaimDetail = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  customer_id: string;
  current_status: ClaimStatus;
  accident_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null; policy_type: string | null; start_date: string | null; end_date: string | null } | null;
  insurance_companies: { name: string | null; contact_email: string | null; contact_phone: string | null } | null;
};

type BrandLogo = { src: string; label: string };

type FinalDocumentRow = {
  sr: number;
  name: string;
  group: string;
  status: "Pending" | "Uploaded" | "Verified";
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

export default async function FinalDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: claim, error } = await supabase
    .from("claims")
    .select("id, claim_no, insurer_claim_no, customer_id, current_status, accident_at, accident_location, accident_description, customers(company_name, contact_name, phone, email), vehicles(vehicle_no, vehicle_type, make, model), policies(policy_no, policy_type, start_date, end_date), insurance_companies(name, contact_email, contact_phone)")
    .eq("id", id)
    .maybeSingle<ClaimDetail>();

  if (error || !claim) notFound();

  const { data: documents } = await supabase
    .from("claim_documents")
    .select("document_type, verification_status")
    .eq("claim_id", id);

  const queue = operationsQueueForStatus(claim.current_status);
  const backHref = queue ? `/claims?queue=${queue.key}` : "/claims";
  const title = `Final Documents - ${claim.claim_no}${claim.insurer_claim_no ? ` / ${claim.insurer_claim_no}` : ""}`;
  const rows = finalClaimDocuments.map((document, index): FinalDocumentRow => {
    const uploaded = documents?.find((item) => item.document_type?.toLowerCase() === document.type.toLowerCase());
    return {
      sr: index + 1,
      name: document.title,
      group: groupForIndex(index),
      status: uploaded?.verification_status === "verified" ? "Verified" : uploaded ? "Uploaded" : "Pending"
    };
  });

  return (
    <ClaimManagerShell title={title} backHref={backHref}>
      <div className="mx-auto max-w-[1440px] space-y-2 pb-4">
        <InfoStrip claim={claim} />
        <SpotSurveyDetailsPanel driverName={extractDriverName(claim.accident_description)} driverMobile={extractDriverMobile(claim.accident_description) ?? claim.customers?.phone ?? null} lossLocation={claim.accident_location} />
        <DealershipPanel />
        <FinalDocumentsChecklist rows={rows} />
      </div>
    </ClaimManagerShell>
  );
}

function DealershipPanel() {
  return (
    <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <h2 className="text-[15px] font-semibold text-[#071D49]">Dealership Details</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <InfoInput label="Dealership Name" value="Tata Motors Service Center" />
        <InfoInput label="Dealership Address" value="No. 45, Hosur Main Road, Adugodi, Bangalore - 560030" />
        <InfoInput label="Contact Person Name" value="Rajesh Verma" />
        <InfoInput label="Contact Number" value="9876543210" />
      </div>
    </section>
  );
}

function InfoInput({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></p><div className="mt-1 min-h-10 rounded-lg border border-[#D9E3F0] bg-[#FBFCFE] px-3 py-2 text-[12px] font-semibold text-[#071D49]">{value}</div></div>;
}

function FinalDocumentsChecklist({ rows }: { rows: FinalDocumentRow[] }) {
  const groups = ["Forms", "Documents 6 - 10", "Documents 11 - 15", "Documents 16 - 20", "Documents 21 - 26"];
  const firstGroupRows = rows.slice(0, 5);
  return (
    <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#071D49]">Check List For - GCCV Motor Claim</h2>
          <p className="mt-1 text-[12px] font-medium text-[#526178]">Final documents stage. Exact final document list can be refined after your next attachment.</p>
        </div>
        <span className="rounded-full border border-[#D9E6F7] bg-[#F7FAFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Final Documents</span>
      </div>
      <div className="grid overflow-hidden rounded-xl border border-[#D9E3F0] md:grid-cols-5">
        {groups.map((group, index) => <div key={group} className={`flex items-center gap-2 border-b border-[#D9E3F0] px-4 py-3 text-[12px] font-semibold md:border-b-0 ${index === 0 ? "bg-[#071D49] text-white" : "bg-[#FBFCFE] text-[#071D49] md:border-l"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${index === 0 ? "bg-white text-[#071D49]" : "bg-[#EEF4FF] text-[#071D49]"}`}>{index + 1}</span>{group}</div>)}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-[#D9E3F0]">
        <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
          <thead className="bg-[#071D49] text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Sr. No.</th>
              <th className="px-3 py-2 font-semibold">Document Name</th>
              <th className="px-3 py-2 text-center font-semibold">Upload Document</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
              <th className="px-3 py-2 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EEF7] bg-white">
            {firstGroupRows.map((row) => <tr key={row.sr} className="hover:bg-[#F8FBFF]"><td className="px-3 py-2 font-semibold text-[#526178]">{row.sr}</td><td className="px-3 py-2 font-semibold text-[#071D49]">{row.name}</td><td className="px-3 py-2 text-center"><button type="button" className="rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6]">Upload</button></td><td className="px-3 py-2 text-center"><StatusPill status={row.status} /></td><td className="px-3 py-2"><div className="flex justify-center gap-2"><button type="button" className="rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6]">Verify</button><button type="button" className="rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49]">Replace</button><button type="button" className="rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49]">Reload</button></div></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled className="rounded-lg border border-[#D9E3F0] bg-[#F4F7FC] px-5 py-2 text-[12px] font-semibold text-[#9AA7BA]">Previous</button>
        <div className="flex gap-3"><button type="button" className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49]">Save as Draft</button><button type="button" className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white">Submit Claim Intimation</button><button type="button" className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white">Next</button></div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: FinalDocumentRow["status"] }) {
  const tone = status === "Verified" ? "border-green-200 bg-green-50 text-green-700" : status === "Uploaded" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>;
}

function InfoStrip({ claim }: { claim: ClaimDetail }) {
  const customerName = claim.customers?.company_name || claim.customers?.contact_name || "-";
  const insurer = claim.insurance_companies?.name || "-";
  const insurerRef = claim.insurer_claim_no || claim.policies?.policy_no || claim.claim_no;
  const make = claim.vehicles?.make || "-";
  const model = claim.vehicles?.model || "-";
  return <section className="grid overflow-hidden rounded-2xl border border-[#DFE8F4] bg-[#F8FBFF] shadow-[0_6px_18px_rgba(7,29,73,0.03)] md:grid-cols-3 xl:grid-cols-5"><Info icon="👤" label="Customer" title={customerName} subtitle={claim.customers?.phone ?? "-"} /><Info icon="🚗" label="Vehicle No." title={claim.vehicles?.vehicle_no ?? "-"} /><Info label="Make & Model" title={make} subtitle={model} logo={<ManufacturerLogo name={make} />} /><Info label="Insurer" title={insurer} subtitle={insurerRef} logo={<InsurerLogo name={insurer} />} /><Info icon="📅" label="Loss Date" title={formatDateShort(claim.accident_at)} /><Info icon="🧾" label="Policy No." title={claim.policies?.policy_no ?? "-"} /><Info icon="#" label="Control No." title={claim.claim_no} /><Info icon="▣" label="Claim No." title={claim.insurer_claim_no ?? "-"} /><Info icon="✓" label="Claim Status" title={claim.current_status ?? "-"} last /></section>;
}
function Info({ icon, label, title, subtitle, logo, last = false }: { icon?: string; label: string; title: string; subtitle?: string | null; logo?: React.ReactNode; last?: boolean }) { return <div className={`flex min-h-[78px] items-start gap-3 px-4 py-3 ${last ? "" : "border-b border-[#DFE8F4] md:border-b-0 md:border-r"}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FC] text-[20px]">{logo ?? icon}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-medium uppercase tracking-[0.04em] leading-4 text-[#174EA6]">{label}</p><p className="mt-0.5 whitespace-normal break-words text-[14px] font-semibold leading-5 text-[#071D49]">{title}</p>{subtitle ? <p className="whitespace-normal break-words text-[12px] leading-4 text-[#1F2B3D]">{subtitle}</p> : null}</div></div>; }
function SpotSurveyDetailsPanel({ driverName, driverMobile, lossLocation }: { driverName: string | null; driverMobile: string | null; lossLocation: string | null }) { const mapHref = lossLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lossLocation)}` : null; return <section className="grid min-h-[42px] items-center overflow-hidden rounded-xl border border-[#DFE8F4] bg-white shadow-[0_4px_12px_rgba(7,29,73,0.025)] lg:grid-cols-[220px_220px_1fr]"><StripDetail icon="👤" label="Driver" value={driverName || "Not available"} /><StripDetail icon="☎" label="Mobile" value={driverMobile || "Not available"} href={driverMobile ? `tel:${driverMobile}` : undefined} /><StripDetail icon="📍" label="Loss Location" value={lossLocation || "Not available"} href={mapHref ?? undefined} isLocation /></section>; }
function StripDetail({ icon, label, value, href, isLocation = false }: { icon: string; label: string; value: string; href?: string; isLocation?: boolean }) { const content = <><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#EEF4FC] text-[13px]">{icon}</span><span className="min-w-0 flex-1"><span className="mr-1 inline text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">{label}:</span><span className={`text-[12px] font-semibold leading-4 text-[#071D49] ${isLocation ? "whitespace-normal break-words" : "truncate"}`}>{value}</span></span>{isLocation ? <span className="ml-2 shrink-0 rounded-full border border-[#BFD3F7] bg-[#EEF4FF] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Map</span> : null}</>; const className = "flex min-h-[42px] items-center gap-2 border-b border-[#E8EFF8] px-3 py-1.5 transition last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"; if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className={`${className} ${isLocation ? "cursor-pointer bg-[#F8FBFF] hover:bg-[#F1F7FF]" : "hover:bg-[#F8FBFF]"}`}>{content}</a>; return <div className={className}>{content}</div>; }
function ManufacturerLogo({ name }: { name: string }) { const brand = findBrand(name, vehicleBrandLogos); if (!brand) return <span className="text-[14px] font-bold text-[#003A83]">{name && name !== "-" ? name.charAt(0).toUpperCase() : "V"}</span>; return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-9 object-contain" />; }
function InsurerLogo({ name }: { name: string }) { const brand = findBrand(name, insurerBrandLogos); if (!brand) return <span className="text-[8px] font-bold uppercase text-[#003A83]">ins</span>; return <img src={brand.src} alt={brand.label} className="max-h-6 max-w-9 object-contain" />; }
function findBrand(name: string, logos: Record<string, BrandLogo>) { const normalized = name.toLowerCase(); return Object.entries(logos).find(([key]) => normalized.includes(key))?.[1] ?? null; }
function formatDateShort(value?: string | null) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function extractDriverName(description?: string | null) { if (!description) return null; const match = description.match(/driver\s*[:\-]\s*([^,;\n]+)/i) ?? description.match(/driver name\s*[:\-]\s*([^,;\n]+)/i); return match?.[1]?.trim() ?? null; }
function extractDriverMobile(description?: string | null) { if (!description) return null; const match = description.match(/(?:mobile|phone|contact)\s*[:\-]\s*(\+?\d[\d\s-]{7,})/i) ?? description.match(/\b(\+?91[-\s]?)?[6-9]\d{9}\b/); return match?.[0]?.replace(/^(mobile|phone|contact)\s*[:\-]\s*/i, "").trim() ?? null; }
function groupForIndex(index: number) { if (index < 5) return "Forms"; if (index < 10) return "Documents 6 - 10"; if (index < 15) return "Documents 11 - 15"; if (index < 20) return "Documents 16 - 20"; return "Documents 21 - 26"; }
