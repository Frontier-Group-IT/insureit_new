"use client";
import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";
import { CustomerClaimEvidenceWorkspace } from "./customer-claim-evidence-workspace";
import { CustomerClaimDocumentGroups } from "./customer-claim-document-groups";
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
const spotTypes = new Set(["accidentphoto","spotphoto","accidentphotos","rccopy","insurancecopy","driverlicence","grloadbill","accidentvideo","otherdocument","incidentvoicenote","audio","voicenote","incidentaudio"]);

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
  const completedStages = Math.max(0, Math.min(completedCount, INTERNAL_JOURNEY_STAGES.length));
  const spotDocuments = documents.filter(doc => spotTypes.has(normalize(doc.document_type)));
  const stageTwoLocked = completedStages >= 2 || milestones.some(item => item.milestone_key === "claim_intimation" && (item.milestone_status === "completed" || item.milestone_status === "not_applicable"));
  return <section className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white">
    {INTERNAL_JOURNEY_STAGES.slice(0,completedStages).map((stage) => {
      const status = "Completed";
      const milestone = milestones.find(item => item.milestone_key === stage.key);
      const details = milestone?.details ?? {};
      const entries = stage.key === "spot_intimation" ? [
        ["Accident Date & Time", datetime(spot.accidentAt)],
        ["Spot Intimation Date & Time", datetime(spot.spotAt ?? details.spot_intimation_at)],
        ["Driver Name", spot.driverName ?? details.driver_name],
        ["Driver Number", spot.driverNumber ?? details.driver_phone],
        ["Location", spot.location ?? details.location],
      ] : (CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key] ?? []).map(field => [field.label, details[field.key]]);
      const fields: Array<[string,unknown]> = entries as Array<[string,unknown]>;
      const extra = Object.entries(details)
        .filter(([key,value]) => present(value) && !((CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key] ?? []).some(field => field.key === key)) && !(stage.key === "spot_intimation" && ["spot_intimation_at","driver_name","driver_phone","location"].includes(key)) && ["string","number","boolean"].includes(typeof value))
        .map(([key,value]):[string,unknown] => [key.replace(/_/g," "),value]);
      return <section key={stage.key} className="border-b border-[#E5EBF4] last:border-b-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#188460] text-white"><Check className="h-4 w-4"/></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-[#132D54]">{stage.label}</span><span className="text-[11px] text-[#71819A]">{status}</span></span>
          {milestone?.completed_at ? <span className="hidden text-[11px] text-[#536782] sm:inline">{new Date(milestone.completed_at).toLocaleDateString("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"})}</span> : null}
          {stage.key === "spot_intimation" && !stageTwoLocked ? <Link href={`/customer/spot-intimation?account=${encodeURIComponent(accountId)}&id=${encodeURIComponent(claimId)}&mode=edit`} aria-label="Edit Spot Intimation" title="Edit Spot Intimation" className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#17365D] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155BAA]"><Pencil className="h-4 w-4" aria-hidden="true" /></Link> : null}
        </div>
        {stage.key !== "payment_encashment" ? <div className="space-y-3 border-t border-[#E5EBF4] px-4 py-3">
          {fields.length || extra.length ? <div className="rounded-xl border border-[#DFE7F2] bg-white">
            <h3 className="border-b border-[#DFE7F2] px-3 py-3 text-[15px] font-semibold text-[#102B54]">{stage.key === "spot_intimation" ? "Accident & Spot Intimation Details" : stage.label+" Details"}</h3>
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...fields,...extra].map(([label,value]) => <div key={label} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase text-[#5673B0]">{label}</p>
                <div className="flex min-h-9 items-center rounded-md border border-[#D9E3F0] bg-[#F4F6FA] px-3 py-2 text-[12px] font-medium text-[#18345C] break-words">{present(value) ? display(value) : "Not provided"}</div>
              </div>)}
            </div>
          </div> : <p className="rounded-lg bg-[#F6F9FD] px-3 py-3 text-[12px] text-[#64748B]">No details recorded for this stage yet.</p>}
          {stage.key === "spot_intimation" && true ? <CustomerClaimEvidenceWorkspace documents={spotDocuments} claimId={claimId} accountId={accountId} stage="spot_intimation" allowUpload={false} /> : null}
          {stage.key === "claim_intimation" ? <CustomerClaimDocumentGroups documents={documents} claimId={claimId} accountId={accountId} stage="claim_intimation" allowUpload={false} /> : null}
        </div> : null}
      </section>;
    })}
  </section>;
}
