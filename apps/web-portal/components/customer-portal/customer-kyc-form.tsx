"use client";

import { CheckCircle2, FileCheck2, Loader2, MapPin, ShieldCheck, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Application = {
  id: string;
  status: string;
  partner_type: string | null;
  draft_data: Record<string, unknown> | null;
  applicant_phone: string | null;
};
type KycDoc = {
  id: string;
  document_type: "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy";
  file_name: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
};
type Location = { id: string; pincode: string; city_name: string; district: string; state_name: string };

const labels = {
  pan_copy: "PAN card",
  aadhaar_front: "Aadhaar front",
  aadhaar_back: "Aadhaar back",
  gst_copy: "GST certificate",
} as const;

function draftText(draft: Record<string, unknown> | null, key: string) {
  const value = draft?.[key];
  return typeof value === "string" ? value : "";
}

export function CustomerKycForm({
  application,
  documents,
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  application: Application | null;
  documents: KycDoc[];
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const draft = application?.draft_data ?? null;
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState(draftText(draft, "contact_name") || defaultName);
  const [email, setEmail] = useState(draftText(draft, "email") || defaultEmail);
  const [pan, setPan] = useState(draftText(draft, "pan_number"));
  const [aadhaar, setAadhaar] = useState("");
  const [street, setStreet] = useState(draftText(draft, "address_street"));
  const [locality, setLocality] = useState(draftText(draft, "address_locality"));
  const [pincode, setPincode] = useState(draftText(draft, "postal_code"));
  const [location, setLocation] = useState<Location | null>(() => {
    const id = draftText(draft, "india_location_id");
    const city = draftText(draft, "city");
    const state = draftText(draft, "state");
    const pin = draftText(draft, "postal_code");
    return id && city && state && pin ? { id, city_name: city, state_name: state, pincode: pin, district: "" } : null;
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [fleet, setFleet] = useState(draftText(draft, "fleet_size_band"));
  const [gst, setGst] = useState(Boolean(draft?.is_gst_registered));
  const [tradeName, setTradeName] = useState(draftText(draft, "legal_trade_name"));
  const [gstNumber, setGstNumber] = useState(draftText(draft, "gst_number"));

  const existing = useMemo(() => new Map(documents.map((doc) => [doc.document_type, doc])), [documents]);
  const locked = application ? ["submitted", "under_review", "approved"].includes(application.status) : false;

  async function start() {
    setStarting(true); setMessage("");
    try {
      const response = await fetch("/customer/kyc/start", { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || "KYC could not be started.");
      router.refresh();
    } catch { setMessage("KYC could not be started."); }
    finally { setStarting(false); }
  }

  async function lookupPin() {
    const pin = pincode.replace(/\D/g, "").slice(0, 6);
    setPincode(pin); setLocation(null); setLocations([]); setMessage("");
    if (pin.length !== 6) return setMessage("Enter a 6-digit PIN code.");
    setLookingUp(true);
    try {
      const response = await fetch(`/customer/kyc/locations?pincode=${encodeURIComponent(pin)}`);
      const body = await response.json() as { locations?: Location[]; error?: string };
      if (!response.ok) return setMessage(body.error || "PIN code lookup failed.");
      const rows = body.locations ?? [];
      setLocations(rows);
      if (rows.length === 1) setLocation(rows[0]);
      if (!rows.length) setMessage("No location found for this PIN code.");
    } catch { setMessage("PIN code lookup failed."); }
    finally { setLookingUp(false); }
  }

  async function upload(type: keyof typeof labels, file?: File) {
    if (!application || !file || locked) return;
    setUploading(type); setMessage("");
    try {
      const form = new FormData();
      form.set("applicationId", application.id);
      form.set("documentType", type);
      form.set("file", file);
      const response = await fetch("/customer/kyc/documents", { method: "POST", body: form });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || `${labels[type]} could not be uploaded.`);
      setMessage(`${labels[type]} uploaded.`);
      router.refresh();
    } catch { setMessage(`${labels[type]} could not be uploaded.`); }
    finally { setUploading(""); }
  }

  async function submit() {
    if (!application || busy || locked) return;
    setMessage("");
    if (!location) return setMessage("Enter your PIN code and select your city.");
    setBusy(true);
    try {
      const response = await fetch("/customer/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          contactName: fullName,
          email,
          panNumber: pan,
          aadhaarNumber: aadhaar,
          addressStreet: street,
          addressLocality: locality,
          indiaLocationId: location.id,
          city: location.city_name,
          state: location.state_name,
          postalCode: location.pincode,
          legalTradeName: tradeName,
          isGstRegistered: gst,
          gstNumber,
          fleetSizeBand: fleet,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || "Your KYC could not be submitted.");
      setAadhaar("");
      setMessage("KYC submitted securely for review.");
      router.refresh();
    } catch { setMessage("Your KYC could not be submitted."); }
    finally { setBusy(false); }
  }

  if (!application) {
    return (
      <div className="rounded-2xl border border-[#DCE4EE] bg-white p-5 text-center">
        <ShieldCheck className="mx-auto h-9 w-9 text-[#174EA6]" />
        <h2 className="mt-3 text-[16px] font-black text-[#10213D]">Individual KYC</h2>
        <p className="mx-auto mt-1 max-w-lg text-[10.5px] font-semibold leading-5 text-[#74839A]">Start your KYC using the same onboarding records and verification workflow as the Customer App.</p>
        {message ? <p className="mt-3 text-[10px] font-bold text-[#A13B3B]">{message}</p> : null}
        <button type="button" disabled={starting} onClick={() => void start()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#142746] px-4 text-[10px] font-black text-white disabled:opacity-60">{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Start KYC</button>
      </div>
    );
  }

  if (locked) {
    const approved = application.status === "approved";
    return (
      <div className={`rounded-2xl border p-5 ${approved ? "border-[#CBE7D8] bg-[#F4FBF7]" : "border-[#F0DCA8] bg-[#FFFBF1]"}`}>
        <div className="flex items-start gap-3">
          {approved ? <CheckCircle2 className="h-7 w-7 text-[#0B7A54]" /> : <FileCheck2 className="h-7 w-7 text-[#A07416]" />}
          <div><h2 className="text-[15px] font-black text-[#10213D]">{approved ? "KYC verified" : "KYC under review"}</h2><p className="mt-1 text-[10.5px] font-semibold leading-5 text-[#64748B]">{approved ? "Your Customer KYC has been approved." : "Your submitted KYC is locked while the review is in progress."}</p></div>
        </div>
      </div>
    );
  }

  const input = "h-10 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-semibold text-[#10213D] outline-none focus:border-[#8EACD1]";
  const area = "min-h-20 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 py-2 text-[11px] font-semibold text-[#10213D] outline-none";

  return (
    <div className="space-y-4">
      {application.status === "changes_requested" ? <p className="rounded-xl bg-[#FFF4E8] px-3 py-2 text-[10px] font-bold text-[#8B621A]">Changes were requested. Update the details/documents and resubmit.</p> : null}
      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#718096]">1 · Personal information</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[9px] font-bold text-[#718096]">Full name<input className={`${input} mt-1`} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label className="text-[9px] font-bold text-[#718096]">Mobile<input className={`${input} mt-1 bg-[#F4F6F9]`} value={application.applicant_phone || defaultPhone} disabled /></label>
          <label className="text-[9px] font-bold text-[#718096]">Email<input className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="text-[9px] font-bold text-[#718096]">PAN<input className={`${input} mt-1 uppercase`} maxLength={10} value={pan} onChange={(e) => setPan(e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,10))} /></label>
          <label className="text-[9px] font-bold text-[#718096] sm:col-span-2">Aadhaar number<input type="password" inputMode="numeric" className={`${input} mt-1`} maxLength={12} value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g,"").slice(0,12))} /></label>
        </div>
        <p className="mt-2 rounded-lg bg-[#F0FAF6] px-3 py-2 text-[9.5px] font-semibold text-[#557067]">Aadhaar is sent only during secure submission and is not stored in the browser draft.</p>
      </section>

      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#718096]">2 · Address</p>
        <div className="mt-3 space-y-3">
          <textarea className={area} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="House, building, street" />
          <input className={input} value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Locality / landmark (optional)" />
          <div className="flex gap-2"><input className={input} inputMode="numeric" maxLength={6} value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/\D/g,"").slice(0,6)); setLocation(null); setLocations([]); }} placeholder="PIN code" /><button type="button" disabled={lookingUp} onClick={() => void lookupPin()} className="shrink-0 rounded-xl bg-[#142746] px-3 text-[10px] font-black text-white">{lookingUp ? "Checking..." : "Find city"}</button></div>
          {locations.length > 1 ? <div className="grid gap-2 sm:grid-cols-2">{locations.map((item) => <button key={item.id} type="button" onClick={() => {setLocation(item); setLocations([]);}} className="rounded-xl border border-[#D8E1EC] bg-white p-3 text-left"><p className="text-[10.5px] font-black text-[#10213D]">{item.city_name}</p><p className="text-[9px] font-semibold text-[#74839A]">{item.district}, {item.state_name}</p></button>)}</div> : null}
          {location ? <p className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1F7FF] px-3 py-2 text-[10px] font-black text-[#174EA6]"><MapPin className="h-3.5 w-3.5" />{location.city_name}, {location.state_name} · {location.pincode}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#718096]">3 · Business details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select className={input} value={fleet} onChange={(e) => setFleet(e.target.value)}><option value="">Select fleet size</option><option value="less_than_5">Less than 5</option><option value="5_to_20">5 to 20</option><option value="20_to_50">20 to 50</option><option value="more_than_50">More than 50</option></select>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#D8E1EC] px-3 text-[10.5px] font-bold text-[#53627A]"><input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} /> GST registered</label>
          {gst ? <><input className={input} value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Legal trade name" /><input className={input} maxLength={15} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,15))} placeholder="GSTIN" /></> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#718096]">4 · KYC documents</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(labels) as Array<keyof typeof labels>).filter((type) => type !== "gst_copy" || gst).map((type) => {
            const doc = existing.get(type);
            return <label key={type} className={`cursor-pointer rounded-xl border p-3 ${doc?.verification_status === "verified" ? "border-[#B7DEC9] bg-[#F4FBF7]" : doc?.verification_status === "rejected" ? "border-[#F0CACA] bg-[#FFF7F7]" : "border-dashed border-[#AFC7E2] bg-[#F8FBFF]"}`}>
              <div className="flex items-center gap-2">{uploading === type ? <Loader2 className="h-4 w-4 animate-spin text-[#174EA6]" /> : <UploadCloud className="h-4 w-4 text-[#174EA6]" />}<span className="text-[10.5px] font-black text-[#10213D]">{labels[type]}</span></div>
              <p className="mt-1 truncate text-[9px] font-semibold text-[#74839A]">{doc ? `${doc.file_name} · ${doc.verification_status}` : "PDF, JPG or PNG · max 5 MB"}</p>
              {doc?.rejection_reason ? <p className="mt-1 text-[9px] font-bold text-[#A13B3B]">{doc.rejection_reason}</p> : null}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => void upload(type,e.target.files?.[0])} />
            </label>;
          })}
        </div>
      </section>

      {message ? <p className={`rounded-xl px-3 py-2 text-[10px] font-bold ${message.includes("submitted") || message.includes("uploaded") ? "bg-[#F2FAF6] text-[#0B7A54]" : "bg-[#FFF4F4] text-[#A13B3B]"}`}>{message}</p> : null}
      <button type="button" disabled={busy || Boolean(uploading)} onClick={() => void submit()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#142746] text-[11px] font-black text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{busy ? "Submitting securely..." : "Review & Submit KYC"}</button>
    </div>
  );
}