import { Check, ChevronDown } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";
import { CustomerClaimEvidenceWorkspace } from "./customer-claim-evidence-workspace";
import type { CustomerClaimDocument, CustomerClaimMilestone } from "@/lib/customer-web-phase2-data";

type SpotFields = {
  accidentAt?: string | null;
  spotAt?: string | null;
  driverName?: string | null;
  driverNumber?: string | null;
  location?: string | null;
};
const present = (value: unknown) => value !== null && value !== undefined && value !== "" && !(typeof value === "string" && !value.trim());
const display = (value: unknown) => typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
const datetime = (value: unknown) => {
  if (!present(value)) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
};
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const spotTypes = new Set(["accidentphoto","spotphoto","accidentphotos","rccopy","insurancecopy","driverlicence","grloadbill","accidentvideo"]);

export function CustomerInternalCompletedJourney({
  claimId, accountId, completedCount, milestones, documents, spot,
}: {
  claimId: string;
  accountId: string;
  completedCount: number;
  milestones: CustomerClaimMilestone[];
  documents: CustomerClaimDocument[];
  spot: SpotFields;
}) {
  const completed = INTERNAL_JOURNEY_STAGES.slice(0, Math.max(0, Math.min(completedCount, INTERNAL_JOURNEY_STAGES.length)));
  const spotDocuments = documents.filter(doc => spotTypes.has(normalize(doc.document_type)));
  return <section className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white">
    <header className="border-b border-[#DCE5F1] bg-[#F6F9FD] px-4 py-3">
      <h2 className="text-[16px] font-bold text-[#102B54]">Claim Journey</h2>
      <p className="text-[11px] text-[#63748F]">{completed.length} completed {completed.length === 1 ? "stage" : "stages"}</p>
    </header>
    {completed.map((stage, index) => {
      const milestone = milestones.find(item => item.milestone_key === stage.key);
      const details = milestone?.details ?? {};
      const entries = stage.key === "spot_intimation" ? [
        ["Accident Date & Time", datetime(spot.accidentAt)],
        ["Spot Intimation Date & Time", datetime(spot.spotAt ?? details.spot_intimation_at)],
        ["Driver Name", spot.driverName ?? details.driver_name],
        ["Driver Number", spot.driverNumber ?? details.driver_phone],
        ["Location", spot.location ?? details.location],
      ] : (CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key] ?? []).map(field => [field.label, details[field.key]]);
      const fields: Array<[string,unknown]> = entries.filter((entry): entry is [string,unknown] => present(entry[1]));
      const extra = stage.key === "spot_intimation" ? [] : Object.entries(details)
        .filter(([key,value]) => present(value) && !((CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key] ?? []).some(field => field.key === key)) && ["string","number","boolean"].includes(typeof value))
        .map(([key,value]):[string,unknown] => [key.replace(/_/g," "),value]);
      return <details key={stage.key} open={index === 0 ? true : undefined} className="group border-b border-[#E5EBF4] last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[#F8FAFE] [&::-webkit-details-marker]:hidden">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#188460] text-white"><Check className="h-4 w-4"/></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-[#132D54]">{stage.label}</span><span className="text-[11px] text-[#71819A]">Completed</span></span>
          {milestone?.completed_at ? <span className="hidden text-[11px] text-[#536782] sm:inline">{new Date(milestone.completed_at).toLocaleDateString("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"})}</span> : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-[#5D7490] transition group-open:rotate-180"/>
        </summary>
        <div className="space-y-3 border-t border-[#E5EBF4] px-4 py-3">
          {fields.length || extra.length ? <div className="rounded-xl border border-[#DFE7F2] bg-white">
            <h3 className="border-b border-[#DFE7F2] px-3 py-3 text-[15px] font-semibold text-[#102B54]">{stage.key === "spot_intimation" ? "Accident & Spot Intimation Details" : stage.label+" Details"}</h3>
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...fields,...extra].map(([label,value]) => <div key={label} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase text-[#5673B0]">{label}</p>
                <div className="flex min-h-9 items-center rounded-md border border-[#D9E3F0] bg-[#F4F6FA] px-3 py-2 text-[12px] font-medium text-[#18345C] break-words">{display(value)}</div>
              </div>)}
            </div>
          </div> : null}
          {stage.key === "spot_intimation" && spotDocuments.length > 0 ? <CustomerClaimEvidenceWorkspace documents={spotDocuments} claimId={claimId} accountId={accountId} stage="spot_intimation" allowUpload={false} onlyUploaded/> : null}
        </div>
      </details>;
    })}
  </section>;
}
