"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CarFront, CheckCircle2, CirclePlus, ClipboardList, FileText, Loader2, MessageSquareText, Search, ShieldCheck } from "lucide-react";

type VehicleOption = { id: string; label: string; make?: string | null; model?: string | null; vehicleType?: string | null };
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
        <div className="grid gap-3 border-b border-[#E8EDF5] pb-3 lg:grid-cols-[190px_1fr]">
          <div className="flex items-start gap-2"><CarFront className="mt-0.5 h-5 w-5 text-[#122B51]"/><div><h3 className="text-[12px] font-black text-[#10213D]">Vehicle</h3><p className="mt-1 text-[10px] text-[#657791]">Select the vehicle you want a quote for.</p></div></div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={!newVehicle} onClick={() => setNewVehicle(false)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${!newVehicle ? "border-[#267AFF] bg-[#EDF5FF]" : "border-[#D7E2F0] hover:bg-[#F8FAFD]"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E2EFFF] text-[#146AD3]"><CarFront className="h-4 w-4"/></span><span><strong className="block text-[10px] text-[#11284B]">Registered vehicle</strong><small className="text-[9px] text-[#71839A]">Select from your fleet</small></span></button>
              <button type="button" aria-pressed={newVehicle} onClick={() => {setNewVehicle(true);setVehicleId("");setVehicleNo("");}} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${newVehicle ? "border-[#267AFF] bg-[#EDF5FF]" : "border-[#D7E2F0] hover:bg-[#F8FAFD]"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F1F5FB] text-[#183C6B]"><CirclePlus className="h-4 w-4"/></span><span><strong className="block text-[10px] text-[#11284B]">Brand new vehicle</strong><small className="text-[9px] text-[#71839A]">Get a new policy</small></span></button>
            </div>
          </div>
        </div>
        {!newVehicle && props.vehicles.length ? (
          <div className="grid grid-cols-2 gap-2 border-b border-[#E8EDF5] py-3 sm:grid-cols-3 xl:grid-cols-4">
            {props.vehicles.map(vehicle => {
              const make = (vehicle.make ?? "").trim();
              const model = (vehicle.model ?? "").trim();
              const category = /jcb|backhoe|excavator|loader|3dx/i.test(`${make} ${model} ${vehicle.vehicleType ?? ""}`) ? "backhoe" : /tata|truck|lpt|tipper|goods|commercial/i.test(`${make} ${model} ${vehicle.vehicleType ?? ""}`) ? "truck" : "suv";
              return <button type="button" key={vehicle.id} aria-pressed={vehicleId === vehicle.id} onClick={() => chooseVehicle(vehicle.id)} className={`flex min-h-[66px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${vehicleId === vehicle.id ? "border-[#267AFF] bg-[#F1F7FF]" : "border-[#D7E2F0] bg-white hover:bg-[#F8FAFD]"}`}>
                <img src={`/customer-quote-${category}.svg`} alt="" className="h-12 w-16 shrink-0 object-contain" />
                <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1.5"><span title={make || "Vehicle manufacturer"} aria-label={make ? `${make} manufacturer` : "Vehicle manufacturer unavailable"} className="grid h-5 min-w-5 shrink-0 place-items-center rounded-md border border-[#D8E5F2] bg-white px-1 text-[8px] font-black uppercase tracking-tight text-[#1B5794]">{make ? make.slice(0, 2) : <CarFront className="h-3 w-3"/>}</span><strong className="block min-w-0 truncate text-[10px] text-[#183256]">{vehicle.label}</strong></span><small className="mt-1 block truncate text-[9px] text-[#71839A]">{[make,model].filter(Boolean).join(" · ") || "Vehicle"}</small></span>
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${vehicleId === vehicle.id ? "border-[#267AFF] bg-[#267AFF] shadow-[inset_0_0_0_3px_white]" : "border-[#A8B8CC]"}`}/>
              </button>;
            })}
            <button type="button" onClick={() => {setNewVehicle(true);setVehicleId("");setVehicleNo("");}} className="flex min-h-[66px] items-center gap-2 rounded-xl border border-[#D7E2F0] bg-[#F9FBFF] px-3 py-2 text-left hover:bg-[#EDF5FF]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E3F0FF] text-[#1775E6]"><CirclePlus className="h-5 w-5"/></span><span><strong className="block text-[10px] text-[#183256]">Add another vehicle</strong><small className="text-[9px] text-[#71839A]">Not in the list?</small></span></button>
          </div>
        ) : null}
        {newVehicle ? <label className="block border-b border-[#E8EDF5] py-2 text-[10px] font-bold text-[#61738B]">Vehicle make / model<input className={`${inputClass} mt-1`} value={vehicleDetails} onChange={event=>setVehicleDetails(event.target.value)} placeholder="Enter vehicle make / model"/></label> : !props.vehicles.length ? <label className="block border-b border-[#E8EDF5] py-2 text-[10px] font-bold text-[#61738B]">Vehicle registration number<input className={`${inputClass} mt-1`} value={vehicleNo} onChange={event=>setVehicleNo(event.target.value.toUpperCase())} placeholder="Enter registration number"/></label> : null}
        <div className="grid gap-2 border-b border-[#E8EDF5] py-3 lg:grid-cols-[190px_1fr]"><div className="flex items-start gap-2"><ClipboardList className="mt-0.5 h-5 w-5 text-[#122B51]"/><div><h3 className="text-[12px] font-black text-[#10213D]">Quote requirement</h3><p className="mt-1 text-[10px] text-[#657791]">Tell us what you need.</p></div></div><div className="flex flex-wrap gap-2">{[["renewal","Renewal"],["new_policy","New policy"],["change_insurer","Change insurer"],["other","Other"]].map(([key,label])=><button type="button" key={key} aria-pressed={quoteNeed===key} onClick={()=>setQuoteNeed(key)} className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-[10px] font-bold ${quoteNeed===key ? "border-[#267AFF] bg-[#EDF5FF] text-[#095EC6]" : "border-[#D7E2F0] text-[#415775] hover:bg-[#F8FAFD]"}`}><span className={`grid h-3.5 w-3.5 place-items-center rounded-full border-2 ${quoteNeed===key ? "border-[#267AFF] bg-[#267AFF] shadow-[inset_0_0_0_2px_white]" : "border-[#A8B8CC]"}`}/>{label}</button>)}</div></div>
        <div className="grid gap-2 py-3 lg:grid-cols-[190px_1fr]"><div className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-5 w-5 text-[#122B51]"/><div><h3 className="text-[12px] font-black text-[#10213D]">Additional information</h3><p className="mt-1 text-[10px] text-[#657791]">Add any specific details (optional).</p></div></div><textarea className="min-h-14 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 py-2 text-[11px] text-[#10213D] outline-none focus:border-[#8EACD1]" value={note} onChange={event=>setNote(event.target.value)} placeholder="Add a note (optional)"/></div>
        <div className="space-y-2 rounded-lg border border-[#DCE6F2] bg-[#F6F9FD] p-3"><label className="flex items-start gap-2 text-[10px] font-medium text-[#405473]"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#1766C4]"/><span>I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this request.</span></label><label className="flex items-center gap-2 text-[10px] font-medium text-[#405473]"><input type="checkbox" checked={whatsapp} onChange={event=>setWhatsapp(event.target.checked)} className="h-3.5 w-3.5 accent-[#1766C4]"/>Send updates on WhatsApp</label></div>
        {error ? <p role="alert" className="mt-2 rounded-xl bg-[#FFF0F0] px-3 py-2 text-[11px] font-bold text-[#A13B3B]">{error}</p> : null}
        <button type="button" disabled={busy} onClick={()=>void submit()} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0D2C56] text-[11px] font-black text-white transition hover:bg-[#17447E] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : null}{busy ? "Submitting..." : "Get Insurance Quote"}<ArrowRight className="h-4 w-4"/></button>
      </div>
    );
  }

  if (props.mode === "challan_assistance") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CarFront className="h-6 w-6 text-[#123866]"/>
            <div><h2 className="text-[18px] font-black text-[#10213D]">Vehicle Details</h2><p className="text-[10px] text-[#687D98]">Enter your vehicle and challan details to get started.</p></div>
          </div>
          <span className="rounded-full bg-[#EAF4FF] px-3 py-1.5 text-[10px] font-bold text-[#1261BA]">Recent vehicles</span>
        </div>
        <div className="flex flex-wrap gap-2 py-1">
          {props.vehicles.slice(0,8).map(vehicle=><button type="button" key={vehicle.id} aria-pressed={vehicleId===vehicle.id} onClick={()=>chooseVehicle(vehicle.id)} className={`rounded-full border px-3 py-2 text-[10px] font-bold ${vehicleId===vehicle.id?"border-[#267AFF] bg-[#EDF5FF] text-[#146AD3]":"border-[#D8E1EC] bg-white text-[#536A89] hover:bg-[#F8FAFD]"}`}>{vehicle.label}</button>)}
          <button type="button" onClick={()=>{setVehicleId("");setVehicleNo("");}} className="rounded-full border border-[#D8E1EC] px-3 py-2 text-[10px] font-bold text-[#536A89] hover:bg-[#F8FAFD]"><CirclePlus className="mr-1 inline h-3.5 w-3.5"/>Add another vehicle</button>
        </div>
        <label className="block text-[11px] font-bold text-[#142746]">Vehicle registration number <span className="text-[#D33B4C]">*</span>
          <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 focus-within:border-[#267AFF]"><CarFront className="h-4 w-4 text-[#8B9CB3]"/><input className="h-11 w-full min-w-0 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none" value={vehicleNo} onChange={event=>{setVehicleNo(event.target.value.toUpperCase());if(selectedVehicle?.label!==event.target.value.toUpperCase())setVehicleId("");}} placeholder="Enter vehicle registration number (e.g. MP20SZ6089)" /></span>
        </label>
        <label className="block text-[11px] font-bold text-[#142746]">Challan / reference number (optional)
          <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 focus-within:border-[#267AFF]"><FileText className="h-4 w-4 text-[#8B9CB3]"/><input className="h-11 w-full min-w-0 bg-transparent text-[12px] text-[#10213D] outline-none" value={challanNo} onChange={event=>setChallanNo(event.target.value)} placeholder="Enter challan or reference number"/></span>
        </label>
        <label className="block text-[11px] font-bold text-[#142746]">Add a note (optional)
          <textarea className={`${areaClass} mt-1`} value={note} onChange={event=>setNote(event.target.value)} placeholder="Add any additional details..." />
        </label>
        <div className="space-y-2 rounded-xl border border-[#DCE6F2] bg-[#F6F9FD] p-3">
          <label className="flex items-start gap-2 text-[10px] font-medium text-[#405473]"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#1766C4]"/><span>I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this request.</span></label>
          <label className="flex items-center gap-2 text-[10px] font-medium text-[#405473]"><input type="checkbox" checked={whatsapp} onChange={event=>setWhatsapp(event.target.checked)} className="h-3.5 w-3.5 accent-[#1766C4]"/>Send updates on WhatsApp</label>
        </div>
        {error?<p role="alert" className="rounded-xl bg-[#FFF0F0] px-3 py-2 text-[11px] font-bold text-[#A13B3B]">{error}</p>:null}
        <button type="button" disabled={busy} onClick={()=>void submit()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0D2C56] text-[11px] font-black text-white hover:bg-[#17447E] disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}{busy?"Submitting...":"Get Challan Assistance"}</button>
      </div>
    );
  }

  // Insurance quote and challan assistance are handled above; only support tickets remain.
  if (props.mode !== "support_ticket") return null;
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#718096]">Related to</label>
        <select className={`${inputClass} mt-2`} value={claimId} onChange={(event) => setClaimId(event.target.value)}>
          <option value="">General support</option>
          {props.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.claim_no} · {claim.status}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-bold text-[#142746]">Category *<select className={`${inputClass} mt-1`} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="claim">Claim Support</option><option value="policy">Policy Support</option><option value="documents">Document Help</option><option value="roadside">Roadside Help</option><option value="other">Other</option>
        </select></label>
        <label className="block text-[11px] font-bold text-[#142746]">Priority *<select className={`${inputClass} mt-1`} value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option>
        </select></label>
      </div>
      <label className="block text-[11px] font-bold text-[#142746]">Subject *<input className={`${inputClass} mt-1`} value={subject} onChange={(event) => setSubject(event.target.value.slice(0, 120))} placeholder="Brief subject" /></label>
      <label className="block text-[11px] font-bold text-[#142746]">Describe your request *<textarea className={`${areaClass} mt-1`} value={description} onChange={(event) => setDescription(event.target.value.slice(0, 2000))} placeholder="Describe what you need help with" /></label>
      {error ? <p role="alert" className="rounded-xl bg-[#FFF0F0] px-3 py-2 text-[10.5px] font-bold text-[#A13B3B]">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void submit()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#142746] px-4 text-[11px] font-black text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Submitting..." : "Submit Ticket"}
      </button>
    </div>
  );
}