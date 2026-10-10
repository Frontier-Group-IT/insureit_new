"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CarFront, CheckCircle2, CirclePlus, ClipboardList, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";

type VehicleOption = { id: string; label: string };
type ClaimOption = { id: string; claim_no: string; status: string };

type Props =
  | {
      mode: "insurance_quote";
      customerId: string;
      vehicles: VehicleOption[];
    }
  | {
      mode: "challan_assistance";
      customerId: string;
      vehicles: VehicleOption[];
    }
  | {
      mode: "support_ticket";
      customerId: string;
      claims: ClaimOption[];
    };

type RequestResult = { enquiry?: { id: string; enquiry_no: string; status: string }; error?: string };

export function CustomerServiceRequestForm(props: Props) {
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [newVehicle, setNewVehicle] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [quoteNeed, setQuoteNeed] = useState("renewal");
  const [challanNo, setChallanNo] = useState("");
  const [claimId, setClaimId] = useState("");
  const [category, setCategory] = useState("policy");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);

  const selectedVehicle = useMemo(
    () => props.mode !== "support_ticket" ? props.vehicles.find((item) => item.id === vehicleId) : null,
    [props, vehicleId],
  );

  function chooseVehicle(id: string) {
    if (props.mode === "support_ticket") return;
    setVehicleId(id);
    const vehicle = props.vehicles.find((item) => item.id === id);
    setVehicleNo(vehicle?.label ?? "");
    setNewVehicle(false);
  }

  async function submit() {
    setError("");
    if (busy || reference) return;

    let payload: Record<string, unknown>;
    if (props.mode === "insurance_quote") {
      if (!consent) return setError("Please accept the terms to continue.");
      if (newVehicle && vehicleDetails.trim().length < 3) return setError("Enter the vehicle make or model.");
      if (!newVehicle && vehicleNo.replace(/[^A-Za-z0-9]/g, "").length < 6) return setError("Enter a valid vehicle number.");
      const needLabel = { renewal: "Renewal", new_policy: "New policy", change_insurer: "Change insurer", other: "Other" }[quoteNeed] ?? "Quote";
      payload = {
        customerId: props.customerId,
        serviceType: "insurance_quote",
        vehicleId: newVehicle ? null : vehicleId || null,
        vehicleNo: newVehicle ? null : vehicleNo,
        quoteNeed,
        newVehicle,
        vehicleDetails: newVehicle ? vehicleDetails.trim() : null,
        subject: `Insurance quote - ${newVehicle ? "new vehicle" : vehicleNo.trim().toUpperCase()}`,
        description: [
          `Requirement: ${needLabel}.`,
          newVehicle ? `New vehicle: ${vehicleDetails.trim()}.` : `Vehicle: ${vehicleNo.trim().toUpperCase()}.`,
          note.trim() ? `Note: ${note.trim()}` : "",
        ].filter(Boolean).join(" "),
        note,
        consentAccepted: true,
        whatsappOptIn: whatsapp,
      };
    } else if (props.mode === "challan_assistance") {
      if (!consent) return setError("Please accept the terms to continue.");
      if (vehicleNo.replace(/[^A-Za-z0-9]/g, "").length < 6) return setError("Enter a valid vehicle number.");
      payload = {
        customerId: props.customerId,
        serviceType: "challan_assistance",
        vehicleId: vehicleId || null,
        vehicleNo,
        challanNo,
        subject: `Challan assistance - ${vehicleNo.trim().toUpperCase()}`,
        description: [
          `Vehicle: ${vehicleNo.trim().toUpperCase()}.`,
          challanNo.trim() ? `Challan/reference: ${challanNo.trim()}.` : "",
          note.trim() ? `Note: ${note.trim()}` : "Customer requested challan assistance.",
        ].filter(Boolean).join(" "),
        note,
        consentAccepted: true,
        whatsappOptIn: whatsapp,
      };
    } else {
      if (subject.trim().length < 3) return setError("Add a short subject for your request.");
      if (description.trim().length < 10) return setError("Please add a little more detail.");
      if ((category === "claim" || category === "documents") && !claimId) return setError("Select the related claim first.");
      payload = {
        customerId: props.customerId,
        serviceType: "support_ticket",
        claimId: claimId || null,
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
      };
    }

    setBusy(true);
    try {
      const response = await fetch("/customer/services/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as RequestResult;
      if (!response.ok || !body.enquiry?.enquiry_no) {
        setError(body.error || "Your request could not be created right now.");
        return;
      }
      setReference(body.enquiry.enquiry_no);
    } catch {
      setError("Your request could not be created right now.");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="rounded-2xl border border-[#CDE8DA] bg-[#F4FBF7] p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#0B7A54]" />
        <p className="mt-2 text-sm font-black text-[#10213D]">Request received</p>
        <p className="mt-1 text-lg font-black tracking-wide text-[#0B7A54]">{reference}</p>
        <p className="mt-1 text-[11px] font-semibold text-[#718096]">You can track this request from Customer Support.</p>
      </div>
    );
  }

  const inputClass = "h-11 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 text-[12px] font-semibold text-[#10213D] outline-none focus:border-[#8EACD1]";
  const areaClass = "min-h-24 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#10213D] outline-none focus:border-[#8EACD1]";

  if (props.mode === "insurance_quote") {
    return (
      <div className="space-y-0">
        <div className="grid gap-3 border-b border-[#E8EDF5] pb-4 lg:grid-cols-[230px_1fr]">
          <div className="flex items-start gap-3"><CarFront className="mt-1 h-6 w-6 text-[#122B51]"/><div><h3 className="text-[13px] font-black text-[#10213D]">Vehicle</h3><p className="mt-1 text-[11px] text-[#657791]">Select the vehicle you want a quote for.</p></div></div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={!newVehicle} onClick={() => setNewVehicle(false)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${!newVehicle ? "border-[#267AFF] bg-[#EDF5FF] ring-1 ring-[#267AFF]" : "border-[#D7E2F0] hover:bg-[#F8FAFD]"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E2EFFF] text-[#146AD3]"><CarFront className="h-5 w-5"/></span><span><strong className="block text-[11px] text-[#11284B]">Registered vehicle</strong><small className="text-[10px] text-[#71839A]">Select from your fleet</small></span></button>
              <button type="button" aria-pressed={newVehicle} onClick={() => {setNewVehicle(true);setVehicleId("");setVehicleNo("");}} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${newVehicle ? "border-[#267AFF] bg-[#EDF5FF] ring-1 ring-[#267AFF]" : "border-[#D7E2F0] hover:bg-[#F8FAFD]"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F1F5FB] text-[#183C6B]"><CirclePlus className="h-5 w-5"/></span><span><strong className="block text-[11px] text-[#11284B]">Brand new vehicle</strong><small className="text-[10px] text-[#71839A]">Get a new policy</small></span></button>
            </div>
            {!newVehicle && props.vehicles.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{props.vehicles.map(vehicle => <button type="button" key={vehicle.id} aria-pressed={vehicleId===vehicle.id} onClick={()=>chooseVehicle(vehicle.id)} className={`flex min-h-[62px] items-center gap-3 rounded-xl border p-3 text-left ${vehicleId===vehicle.id ? "border-[#267AFF] bg-[#F1F7FF]" : "border-[#D7E2F0] bg-white hover:bg-[#F8FAFD]"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E9F3FF] text-[#1A6CC3]"><CarFront className="h-5 w-5"/></span><span className="min-w-0 flex-1 truncate text-[11px] font-black text-[#183256]">{vehicle.label}</span><span className={`h-4 w-4 shrink-0 rounded-full border-2 ${vehicleId===vehicle.id ? "border-[#267AFF] bg-[#267AFF] shadow-[inset_0_0_0_3px_white]" : "border-[#A8B8CC]"}`}/></button>)}</div> : null}
            <label className="block text-[10px] font-bold text-[#61738B]">{newVehicle ? "Vehicle make / model" : "Vehicle registration number"}<input className={`${inputClass} mt-1.5`} value={newVehicle ? vehicleDetails : vehicleNo} onChange={event=>{if(newVehicle){setVehicleDetails(event.target.value);}else{setVehicleNo(event.target.value.toUpperCase());if(selectedVehicle?.label!==event.target.value)setVehicleId("");}}} placeholder={newVehicle ? "Enter vehicle make / model" : "Enter registration number or select above"}/></label>
          </div>
        </div>
        <div className="grid gap-3 border-b border-[#E8EDF5] py-4 lg:grid-cols-[230px_1fr]"><div className="flex items-start gap-3"><ClipboardList className="mt-1 h-6 w-6 text-[#122B51]"/><div><h3 className="text-[13px] font-black text-[#10213D]">Quote requirement</h3><p className="mt-1 text-[11px] text-[#657791]">Tell us what you need.</p></div></div><div className="flex flex-wrap gap-2">{[["renewal","Renewal"],["new_policy","New policy"],["change_insurer","Change insurer"],["other","Other"]].map(([key,label])=><button type="button" key={key} aria-pressed={quoteNeed===key} onClick={()=>setQuoteNeed(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[11px] font-bold ${quoteNeed===key ? "border-[#267AFF] bg-[#EDF5FF] text-[#095EC6]" : "border-[#D7E2F0] text-[#415775] hover:bg-[#F8FAFD]"}`}><span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${quoteNeed===key ? "border-[#267AFF] bg-[#267AFF] shadow-[inset_0_0_0_3px_white]" : "border-[#A8B8CC]"}`}/>{label}</button>)}</div></div>
        <div className="grid gap-3 py-4 lg:grid-cols-[230px_1fr]"><div className="flex items-start gap-3"><MessageSquareText className="mt-1 h-6 w-6 text-[#122B51]"/><div><h3 className="text-[13px] font-black text-[#10213D]">Additional information</h3><p className="mt-1 text-[11px] text-[#657791]">Any specific details (optional).</p></div></div><textarea className={areaClass} value={note} onChange={event=>setNote(event.target.value)} placeholder="Add a note (optional)"/></div>
        <div className="space-y-3 rounded-xl border border-[#DCE6F2] bg-[#F6F9FD] p-4"><label className="flex items-start gap-3 text-[11px] font-medium text-[#405473]"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1766C4]"/><span>I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this request.</span></label><label className="flex items-center gap-3 text-[11px] font-medium text-[#405473]"><input type="checkbox" checked={whatsapp} onChange={event=>setWhatsapp(event.target.checked)} className="h-4 w-4 accent-[#1766C4]"/>Send updates on WhatsApp</label></div>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-[#FFF0F0] px-3 py-2 text-[11px] font-bold text-[#A13B3B]">{error}</p> : null}
        <button type="button" disabled={busy} onClick={()=>void submit()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0D2C56] text-[12px] font-black text-white transition hover:bg-[#17447E] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}{busy ? "Submitting..." : "Get Insurance Quote"}<ArrowRight className="h-4 w-4"/></button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {props.mode !== "support_ticket" ? (
        <>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#718096]">Vehicle</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.vehicles.slice(0, 8).map((vehicle) => (
                <button key={vehicle.id} type="button" onClick={() => chooseVehicle(vehicle.id)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${vehicleId === vehicle.id ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B]"}`}>
                  {vehicle.label}
                </button>
              ))}
            </div>
          </div>
          {false ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewVehicle(false)} className={`rounded-lg border px-3 py-2 text-[10px] font-black ${!newVehicle ? "border-[#142746] bg-[#EEF4FF] text-[#142746]" : "border-[#D8E1EC] text-[#64748B]"}`}>Registered vehicle</button>
              <button type="button" onClick={() => { setNewVehicle(true); setVehicleId(""); setVehicleNo(""); }} className={`rounded-lg border px-3 py-2 text-[10px] font-black ${newVehicle ? "border-[#142746] bg-[#EEF4FF] text-[#142746]" : "border-[#D8E1EC] text-[#64748B]"}`}>Brand new</button>
            </div>
          ) : null}
          {false && newVehicle ? (
            <input className={inputClass} value={vehicleDetails} onChange={(event) => setVehicleDetails(event.target.value)} placeholder="Vehicle make / model" />
          ) : (
            <input className={inputClass} value={vehicleNo} onChange={(event) => { setVehicleNo(event.target.value.toUpperCase()); if (selectedVehicle?.label !== event.target.value) setVehicleId(""); }} placeholder="Vehicle registration number" />
          )}
        </>
      ) : null}

      {false ? (
        <>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#718096]">Quote requirement</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[["renewal","Renewal"],["new_policy","New policy"],["change_insurer","Change insurer"],["other","Other"]].map(([key,label]) => (
                <button key={key} type="button" onClick={() => setQuoteNeed(key)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${quoteNeed === key ? "border-[#174EA6] bg-[#EEF4FF] text-[#174EA6]" : "border-[#D8E1EC] text-[#64748B]"}`}>{label}</button>
              ))}
            </div>
          </div>
          <textarea className={areaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note (optional)" />
        </>
      ) : null}

      {props.mode === "challan_assistance" ? (
        <>
          <input className={inputClass} value={challanNo} onChange={(event) => setChallanNo(event.target.value)} placeholder="Challan / reference number (optional)" />
          <textarea className={areaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note (optional)" />
        </>
      ) : null}

      {props.mode === "support_ticket" ? (
        <>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#718096]">Related claim</label>
            <select className={`${inputClass} mt-2`} value={claimId} onChange={(event) => setClaimId(event.target.value)}>
              <option value="">General support</option>
              {props.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.claim_no} · {claim.status}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="claim">Claim Support</option><option value="policy">Policy Support</option><option value="documents">Document Help</option><option value="roadside">Roadside Help</option><option value="other">Other</option>
            </select>
            <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option>
            </select>
          </div>
          <input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value.slice(0, 120))} placeholder="Brief subject" />
          <textarea className={areaClass} value={description} onChange={(event) => setDescription(event.target.value.slice(0, 2000))} placeholder="Describe what you need help with" />
        </>
      ) : null}

      {props.mode !== "support_ticket" ? (
        <div className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFD] p-3">
          <label className="flex items-start gap-2 text-[10.5px] font-semibold leading-4 text-[#5F6E83]">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
            <span>I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this request.</span>
          </label>
          <label className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[#718096]">
            <input type="checkbox" checked={whatsapp} onChange={(event) => setWhatsapp(event.target.checked)} />
            Send updates on WhatsApp
          </label>
        </div>
      ) : null}

      {error ? <p className="rounded-xl bg-[#FFF0F0] px-3 py-2 text-[10.5px] font-bold text-[#A13B3B]">{error}</p> : null}

      <button type="button" disabled={busy} onClick={() => void submit()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#142746] px-4 text-[11px] font-black text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Submitting..." : false ? "Get Insurance Quote" : props.mode === "challan_assistance" ? "Get Challan Assistance" : "Submit Ticket"}
      </button>
    </div>
  );
}