"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCustomerInternalSpotCorrection } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";
import { Check, ChevronDown, Pencil, X } from "lucide-react";
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
  const completedStages = Math.max(0, Math.min(completedCount, INTERNAL_JOURNEY_STAGES.length));
  const spotDocuments = documents.filter(doc => spotTypes.has(normalize(doc.document_type)));
  const stageOneEditable = completedStages === 1 &&
    !milestones.some(item => item.milestone_key === "spot_status" && ["completed", "not_applicable"].includes(item.milestone_status));
  const [editingSpot, setEditingSpot] = useState(false);
  const [saveState, saveSpot, savingSpot] = useActionState(saveCustomerInternalSpotCorrection, { error: null, saved: false });
  const router = useRouter();
  useEffect(() => {
    if (saveState.saved) { setEditingSpot(false); router.refresh(); }
  }, [saveState.saved, router]);
  const localDateTime = (value: string | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T");
  };
  return <section className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white">
    <header className="border-b border-[#DCE5F1] bg-[#F6F9FD] px-4 py-3">
      <h2 className="text-[16px] font-bold text-[#102B54]">Claim Journey</h2>
      <p className="text-[11px] text-[#63748F]">{completedStages} completed {completedStages === 1 ? "stage" : "stages"} · {INTERNAL_JOURNEY_STAGES.length} total</p>
    </header>
    {INTERNAL_JOURNEY_STAGES.slice(0,completedStages).map((stage, index) => {
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
      return <details key={stage.key} open={index === completedStages - 1 ? true : undefined} className="group border-b border-[#E5EBF4] last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[#F8FAFE] [&::-webkit-details-marker]:hidden">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#188460] text-white"><Check className="h-4 w-4"/></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-[#132D54]">{stage.label}</span><span className="text-[11px] text-[#71819A]">{status}</span></span>
          {milestone?.completed_at ? <span className="hidden text-[11px] text-[#536782] sm:inline">{new Date(milestone.completed_at).toLocaleDateString("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"})}</span> : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-[#5D7490] transition group-open:rotate-180"/>
          {stage.key === "spot_intimation" && stageOneEditable ? <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setEditingSpot(current => !current); }}
            className="ml-2 inline-flex h-8 items-center gap-1 rounded-lg bg-[#17365D] px-3 text-[11px] font-semibold text-white">
            {editingSpot ? <X className="h-3.5 w-3.5"/> : <Pencil className="h-3.5 w-3.5"/>}{editingSpot ? "Cancel" : "Edit"}
          </button> : null}
        </summary>
        <div className="space-y-3 border-t border-[#E5EBF4] px-4 py-3">
          {stage.key === "spot_intimation" && editingSpot && stageOneEditable ? <form action={saveSpot} className="rounded-xl border border-[#D9E6F7] bg-[#F7FAFF] p-3">
            <input type="hidden" name="claim" value={claimId}/>
            <input type="hidden" name="account" value={accountId}/>
            <h3 className="mb-3 text-[13px] font-semibold text-[#17365D]">Edit Spot Intimation details</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "accidentAt", label: "Accident Date & Time", value: localDateTime(spot.accidentAt), type: "datetime-local" },
                { name: "spotAt", label: "Spot Intimation Date & Time", value: localDateTime(spot.spotAt), type: "datetime-local" },
                { name: "driver", label: "Driver Name", value: spot.driverName ?? "", type: "text" },
                { name: "phone", label: "Driver Number", value: spot.driverNumber ?? "", type: "tel" },
                { name: "location", label: "Accident Location", value: spot.location ?? "", type: "text" },
              ].map(field => <label key={field.name} className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-[#47689B]">{field.label}</span>
                <input name={field.name} type={field.type} defaultValue={field.value} required={field.name === "accidentAt" || field.name === "spotAt"}
                  className="h-10 w-full min-w-0 rounded-lg border border-[#CCD9EA] bg-white px-3 text-[12px] text-[#17365D]"/>
              </label>)}
            </div>
            {saveState.error ? <p role="alert" className="mt-2 text-[11px] font-medium text-red-700">{saveState.error}</p> : null}
            <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditingSpot(false)} className="rounded-lg border border-[#CAD8EA] px-4 py-2 text-[11px] font-semibold text-[#17365D]">Cancel</button>
              <button disabled={savingSpot} type="submit" className="rounded-lg bg-[#17365D] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50">{savingSpot ? "Saving..." : "Save Changes"}</button>
            </div>
          </form> : null}
          {fields.length || extra.length ? <div className="rounded-xl border border-[#DFE7F2] bg-white">
            <h3 className="border-b border-[#DFE7F2] px-3 py-3 text-[15px] font-semibold text-[#102B54]">{stage.key === "spot_intimation" ? "Accident & Spot Intimation Details" : stage.label+" Details"}</h3>
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...fields,...extra].map(([label,value]) => <div key={label} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase text-[#5673B0]">{label}</p>
                <div className="flex min-h-9 items-center rounded-md border border-[#D9E3F0] bg-[#F4F6FA] px-3 py-2 text-[12px] font-medium text-[#18345C] break-words">{present(value) ? display(value) : "Not provided"}</div>
              </div>)}
            </div>
          </div> : <p className="rounded-lg bg-[#F6F9FD] px-3 py-3 text-[12px] text-[#64748B]">No details recorded for this stage yet.</p>}
          {stage.key === "spot_intimation" && true ? <CustomerClaimEvidenceWorkspace documents={spotDocuments} claimId={claimId} accountId={accountId} stage="spot_intimation" allowUpload={editingSpot && stageOneEditable} /> : null}
          {stage.key === "claim_intimation" ? <CustomerClaimDocumentGroups documents={documents} claimId={claimId} accountId={accountId} stage="claim_intimation" allowUpload={false} /> : null}
        </div>
      </details>;
    })}
  </section>;
}
