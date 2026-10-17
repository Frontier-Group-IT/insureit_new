"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Camera, Check, ChevronLeft, ChevronRight, Loader2, Search, Store, Truck, Upload, UserRound, X } from "lucide-react";

type Customer = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

type Media = { id: string; label: string | null; url: string | null; is_cover: boolean; sort_order: number };
type EditableListing = {
  id: string;
  listing_no: string;
  status: string;
  title: string;
  category: string;
  odometer_km: number | null;
  asking_price: number;
  selling_mode: string;
  tyre_condition_percent: number | null;
  condition_details: Record<string, unknown> | null;
  review_notes: string | null;
  media: Media[];
};

type Vehicle = {
  id: string;
  vehicle_no: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  vehicle_category: string | null;
  fuel_type: string | null;
  body_type: string | null;
  city: string | null;
  state: string | null;
  has_active_listing: boolean;
  active_listing_no: string | null;
  editable_listing: EditableListing | null;
};

type Draft = {
  title: string;
  category: "Truck" | "Tipper" | "Pickup" | "Bus" | "Construction";
  odometerKm: string;
  askingPrice: string;
  sellingMode: "fixed_price" | "open_bidding" | "managed_auction";
  overallCondition: "excellent" | "good" | "fair" | "needs_attention";
  tyreConditionPercent: string;
  knownIssues: string;
  operatingHours: string;
  bodyCondition: "good" | "fair" | "needs_attention" | "unknown";
  cabinCondition: "good" | "fair" | "needs_attention" | "unknown";
  hydraulicCondition: "good" | "fair" | "needs_attention" | "unknown";
  undercarriageCondition: "good" | "fair" | "needs_attention" | "unknown";
};

const photoLabels = ["Front", "Rear", "Left", "Right", "Cabin", "Odometer"] as const;
const categories: Draft["category"][] = ["Truck", "Tipper", "Pickup", "Bus", "Construction"];
const blankDraft: Draft = {
  title: "",
  category: "Truck",
  odometerKm: "",
  askingPrice: "",
  sellingMode: "open_bidding",
  overallCondition: "good",
  tyreConditionPercent: "",
  knownIssues: "",
  operatingHours: "",
  bodyCondition: "unknown",
  cabinCondition: "unknown",
  hydraulicCondition: "unknown",
  undercarriageCondition: "unknown",
};

function categoryForVehicle(vehicle: Vehicle): Draft["category"] {
  const text = `${vehicle.vehicle_type ?? ""} ${vehicle.vehicle_category ?? ""} ${vehicle.body_type ?? ""}`.toLowerCase();
  if (text.includes("tipper") || text.includes("dumper")) return "Tipper";
  if (text.includes("pickup") || text.includes("pick-up")) return "Pickup";
  if (text.includes("bus") || text.includes("pcv")) return "Bus";
  if (text.includes("jcb") || text.includes("construction") || text.includes("cpm")) return "Construction";
  return "Truck";
}

function draftFromVehicle(vehicle: Vehicle): Draft {
  const listing = vehicle.editable_listing;
  const condition = listing?.condition_details ?? {};
  const read = (key: string) => typeof condition[key] === "string" ? String(condition[key]) : "";
  const validCondition = (value: string): Draft["bodyCondition"] =>
    ["good", "fair", "needs_attention", "unknown"].includes(value) ? value as Draft["bodyCondition"] : "unknown";
  const overall = read("overall_condition");
  return {
    title: listing?.title || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Commercial vehicle",
    category: categories.includes(listing?.category as Draft["category"]) ? listing!.category as Draft["category"] : categoryForVehicle(vehicle),
    odometerKm: listing?.odometer_km == null ? "" : String(listing.odometer_km),
    askingPrice: listing?.asking_price ? String(Number(listing.asking_price)) : "",
    sellingMode: ["fixed_price", "open_bidding", "managed_auction"].includes(listing?.selling_mode ?? "")
      ? listing!.selling_mode as Draft["sellingMode"]
      : "open_bidding",
    overallCondition: ["excellent", "good", "fair", "needs_attention"].includes(overall)
      ? overall as Draft["overallCondition"]
      : "good",
    tyreConditionPercent: listing?.tyre_condition_percent == null ? "" : String(listing.tyre_condition_percent),
    knownIssues: read("known_issues"),
    operatingHours: read("operating_hours"),
    bodyCondition: validCondition(read("body_condition")),
    cabinCondition: validCondition(read("cabin_condition")),
    hydraulicCondition: validCondition(read("hydraulic_condition")),
    undercarriageCondition: validCondition(read("undercarriage_condition")),
  };
}

function customerName(customer: Customer) {
  return customer.company_name?.trim() || customer.contact_name?.trim() || "Customer";
}

function money(value: string | number) {
  const amount = Number(value || 0);
  if (!amount) return "Not set";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount % 10000000 ? 2 : 0)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 ? 2 : 0)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function InternalExchangeListingWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listingNo, setListingNo] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, { uploaded: boolean; url: string | null }>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function requestJson(url: string, init?: RequestInit) {
    const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
    const body = await response.json().catch(() => ({})) as Record<string, any>;
    if (!response.ok) throw new Error(String(body.error || "Exchange request could not be completed."));
    return body;
  }

  async function loadCustomers() {
    setLoadingCustomers(true);
    try {
      const body = await requestJson("/api/exchange/listings/internal");
      setCustomers((body.customers ?? []) as Customer[]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Customers could not be loaded." });
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function chooseCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setSelectedVehicle(null);
    setVehicles([]);
    setListingId(null);
    setListingNo(null);
    setDraft(blankDraft);
    setPhotos({});
    setStep(0);
    setMessage(null);
    setLoadingVehicles(true);
    try {
      const body = await requestJson(`/api/exchange/listings/internal?customerId=${encodeURIComponent(customer.id)}`);
      setVehicles((body.vehicles ?? []) as Vehicle[]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Customer fleet could not be loaded." });
    } finally {
      setLoadingVehicles(false);
    }
  }

  function chooseVehicle(vehicle: Vehicle) {
    if (vehicle.has_active_listing) return;
    setSelectedVehicle(vehicle);
    const nextDraft = draftFromVehicle(vehicle);
    setDraft(nextDraft);
    setListingId(vehicle.editable_listing?.id ?? null);
    setListingNo(vehicle.editable_listing?.listing_no ?? null);
    const nextPhotos: Record<string, { uploaded: boolean; url: string | null }> = {};
    for (const label of photoLabels) {
      const media = vehicle.editable_listing?.media.find((item) => item.label?.toLowerCase() === label.toLowerCase());
      nextPhotos[label] = { uploaded: Boolean(media), url: media?.url ?? null };
    }
    setPhotos(nextPhotos);
    setMessage(vehicle.editable_listing?.review_notes
      ? { type: "error", text: `Previous review note: ${vehicle.editable_listing.review_notes}` }
      : null);
  }

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 80);
    return customers.filter((item) => [
      item.customer_code,
      item.company_name,
      item.contact_name,
      item.phone,
      item.city,
      item.state,
    ].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 80);
  }, [customerQuery, customers]);

  function validateDetails() {
    if (!selectedCustomer || !selectedVehicle) return "Select a customer and vehicle.";
    if (!draft.odometerKm.trim() || Number(draft.odometerKm) < 0) return "Enter the current odometer reading.";
    if (!draft.askingPrice.trim() || Number(draft.askingPrice) <= 0) return "Enter the expected selling price.";
    if (draft.tyreConditionPercent && (Number(draft.tyreConditionPercent) < 0 || Number(draft.tyreConditionPercent) > 100)) return "Tyre condition must be between 0 and 100%.";
    return null;
  }

  async function saveDraft(showSuccess = false) {
    const validation = validateDetails();
    if (validation) {
      setMessage({ type: "error", text: validation });
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson("/api/exchange/listings/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          listingId,
          customerId: selectedCustomer!.id,
          vehicleId: selectedVehicle!.id,
          title: draft.title,
          category: draft.category,
          odometerKm: Number(draft.odometerKm),
          askingPrice: Number(draft.askingPrice),
          sellingMode: draft.sellingMode,
          tyreConditionPercent: draft.tyreConditionPercent ? Number(draft.tyreConditionPercent) : null,
          conditionDetails: {
            seller_declared: true,
            created_via: "operations_web",
            overall_condition: draft.overallCondition,
            tyre_condition_percent: draft.tyreConditionPercent ? Number(draft.tyreConditionPercent) : null,
            known_issues: draft.knownIssues.trim(),
            operating_hours: draft.operatingHours.trim(),
            body_condition: draft.bodyCondition,
            cabin_condition: draft.cabinCondition,
            hydraulic_condition: draft.hydraulicCondition,
            undercarriage_condition: draft.undercarriageCondition,
          },
        }),
      });
      setListingId(String(body.data.id));
      setListingNo(String(body.data.listing_no));
      if (showSuccess) setMessage({ type: "success", text: `Draft ${body.data.listing_no} saved.` });
      return String(body.data.id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Draft could not be saved." });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function continueToPhotos() {
    const id = await saveDraft(false);
    if (!id) return;
    setStep(2);
  }

  async function uploadPhoto(label: string, file: File) {
    const id = listingId || await saveDraft(false);
    if (!id) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("listingId", id);
      form.set("label", label);
      form.set("file", file);
      const body = await requestJson("/api/exchange/listings/internal/media", { method: "POST", body: form });
      setPhotos((current) => ({ ...current, [label]: { uploaded: true, url: body.data.url ?? null } }));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Photo could not be uploaded." });
    } finally {
      setBusy(false);
    }
  }

  async function submitListing() {
    if (!listingId) {
      setMessage({ type: "error", text: "Save the listing before submission." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson("/api/exchange/listings/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", listingId }),
      });
      setMessage({ type: "success", text: `${body.data.listing_no} submitted to Listing Review.` });
      setTimeout(() => window.location.assign("/exchange/listings?status=pending_review"), 900);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Listing could not be submitted." });
    } finally {
      setBusy(false);
    }
  }

  const uploadedCount = photoLabels.filter((label) => photos[label]?.uploaded).length;
  const steps = ["Customer & vehicle", "Details & price", "Photos", "Review"];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="rounded-[22px] border border-[#E3E8F0] bg-white px-5 py-4 shadow-[0_12px_36px_rgba(37,39,92,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#3156B8]"><Store className="h-3.5 w-3.5" />Exchange</div>
            <h1 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-[#171D3D]">Create Exchange Listing</h1>
            <p className="mt-1 text-[11px] text-[#6D778C]">Create a customer vehicle listing using the same governed flow as the customer app.</p>
          </div>
          {listingNo ? <span className="rounded-full bg-[#EAF1FF] px-3 py-1.5 text-[10px] font-black text-[#3156B8]">{listingNo}</span> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {steps.map((label, index) => (
            <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${step === index ? "border-[#3156B8] bg-[#EFF4FF]" : step > index ? "border-[#BEE5D3] bg-[#F0FAF5]" : "border-[#E2E7EF] bg-[#FAFBFC]"}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[9px] font-black ${step > index ? "bg-[#147A55] text-white" : step === index ? "bg-[#3156B8] text-white" : "bg-[#E8EDF4] text-[#6D778C]"}`}>{step > index ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
              <span className="text-[9.5px] font-black text-[#33415C]">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {message ? <div className={`rounded-xl border px-4 py-3 text-[10px] font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}

      {step === 0 ? (
        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[22px] border border-[#E3E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#3156B8]" /><h2 className="text-[14px] font-black text-[#17213E]">Select customer</h2></div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B95A6]" />
              <input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Search name, mobile, customer code..." className="h-10 w-full rounded-xl border border-[#DDE3EC] bg-[#F8FAFC] pl-9 pr-3 text-[10.5px] font-semibold outline-none focus:border-[#3156B8]" />
            </div>
            <div className="mt-3 max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
              {loadingCustomers ? <Loading label="Loading customers..." /> : filteredCustomers.map((customer) => (
                <button key={customer.id} type="button" onClick={() => void chooseCustomer(customer)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selectedCustomer?.id === customer.id ? "border-[#3156B8] bg-[#EFF4FF]" : "border-[#E5EAF1] hover:bg-[#F8FAFC]"}`}>
                  <p className="truncate text-[10.5px] font-black text-[#17213E]">{customerName(customer)}</p>
                  <p className="mt-1 text-[9px] font-semibold text-[#728096]">{customer.customer_code || "No code"} · {customer.phone || "No mobile"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[#E3E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-[#3156B8]" /><h2 className="text-[14px] font-black text-[#17213E]">Select from customer fleet</h2></div>
            {!selectedCustomer ? <Empty text="Select a customer to load their fleet." /> : loadingVehicles ? <Loading label="Loading fleet..." /> : (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {vehicles.map((vehicle) => {
                  const active = selectedVehicle?.id === vehicle.id;
                  return (
                    <button key={vehicle.id} type="button" disabled={vehicle.has_active_listing} onClick={() => chooseVehicle(vehicle)} className={`rounded-2xl border p-3 text-left transition ${vehicle.has_active_listing ? "cursor-not-allowed border-[#E2E7EF] bg-[#F6F7F9] opacity-65" : active ? "border-[#3156B8] bg-[#EFF4FF]" : "border-[#E2E7EF] hover:border-[#B9C9DB] hover:bg-[#FBFCFE]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-black text-[#17213E]">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Vehicle"}</p>
                          <p className="mt-1 text-[9px] font-semibold text-[#718096]">{vehicle.vehicle_no || "Registration pending"} · {vehicle.year || "Year pending"}</p>
                          <p className="mt-1 text-[8.5px] text-[#8A94A5]">{[vehicle.city, vehicle.state].filter(Boolean).join(", ") || "Location on file"}</p>
                        </div>
                        {vehicle.has_active_listing ? <span className="rounded-full bg-[#E8EDF4] px-2 py-1 text-[8px] font-black text-[#667287]">LISTED</span> : active ? <BadgeCheck className="h-5 w-5 text-[#3156B8]" /> : null}
                      </div>
                      {vehicle.editable_listing && !vehicle.has_active_listing ? <p className="mt-2 text-[8px] font-black uppercase text-[#A16A00]">Resume {vehicle.editable_listing.status} · {vehicle.editable_listing.listing_no}</p> : null}
                    </button>
                  );
                })}
                {!vehicles.length ? <div className="md:col-span-2"><Empty text="No fleet vehicle is available for this customer." /></div> : null}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={!selectedVehicle || selectedVehicle.has_active_listing} onClick={() => setStep(1)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17365D] px-5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#AEB8C8]">Continue <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 1 && selectedVehicle ? (
        <section className="rounded-[22px] border border-[#E3E8F0] bg-white p-5 shadow-sm">
          <SelectedSummary customer={selectedCustomer!} vehicle={selectedVehicle} />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ReadOnly label="Registration" value={selectedVehicle.vehicle_no || "From fleet"} />
            <ReadOnly label="Year" value={selectedVehicle.year ? String(selectedVehicle.year) : "From fleet"} />
            <ReadOnly label="Make / model" value={[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.vehicle_type || "From fleet"} wide />
            <Field label="Current odometer" value={draft.odometerKm} onChange={(value) => setDraft((current) => ({ ...current, odometerKm: value.replace(/\D/g, "") }))} suffix="km" placeholder="72,400" />
            <Field label="Expected price" value={draft.askingPrice} onChange={(value) => setDraft((current) => ({ ...current, askingPrice: value.replace(/\D/g, "") }))} prefix="₹" placeholder="25,50,000" />
            <Field label="Estimated tyre condition" value={draft.tyreConditionPercent} onChange={(value) => setDraft((current) => ({ ...current, tyreConditionPercent: value.replace(/\D/g, "").slice(0, 3) }))} suffix="%" placeholder="70" />
          </div>

          <div className="mt-5"><Label>Vehicle category</Label><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => <Choice key={category} active={draft.category === category} onClick={() => setDraft((current) => ({ ...current, category }))}>{category}</Choice>)}</div></div>
          <div className="mt-5"><Label>Overall condition</Label><div className="mt-2 flex flex-wrap gap-2">{(["excellent","good","fair","needs_attention"] as const).map((value) => <Choice key={value} active={draft.overallCondition === value} onClick={() => setDraft((current) => ({ ...current, overallCondition: value }))}>{value.replaceAll("_"," ")}</Choice>)}</div></div>
          <div className="mt-5"><Label>Selling mode</Label><div className="mt-2 grid gap-2 md:grid-cols-3">
            <Mode title="Fixed price" copy="Publish an expected price for managed buyer contact." active={draft.sellingMode === "fixed_price"} onClick={() => setDraft((current) => ({ ...current, sellingMode: "fixed_price" }))} />
            <Mode title="Open to offers" copy="Buyers can send private offers for seller consideration." active={draft.sellingMode === "open_bidding"} onClick={() => setDraft((current) => ({ ...current, sellingMode: "open_bidding" }))} />
            <Mode title="Managed auction" copy="Qualified buyers compete while seller keeps final approval." active={draft.sellingMode === "managed_auction"} onClick={() => setDraft((current) => ({ ...current, sellingMode: "managed_auction" }))} />
          </div></div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ConditionSelect label="Body condition" value={draft.bodyCondition} onChange={(value) => setDraft((current) => ({ ...current, bodyCondition: value }))} />
            <ConditionSelect label="Cabin condition" value={draft.cabinCondition} onChange={(value) => setDraft((current) => ({ ...current, cabinCondition: value }))} />
            {draft.category === "Construction" ? <><Field label="Operating hours (optional)" value={draft.operatingHours} onChange={(value) => setDraft((current) => ({ ...current, operatingHours: value.replace(/\D/g, "") }))} suffix="hrs" placeholder="6,200" /><ConditionSelect label="Hydraulic condition" value={draft.hydraulicCondition} onChange={(value) => setDraft((current) => ({ ...current, hydraulicCondition: value }))} /><ConditionSelect label="Undercarriage condition" value={draft.undercarriageCondition} onChange={(value) => setDraft((current) => ({ ...current, undercarriageCondition: value }))} /></> : null}
          </div>

          <div className="mt-5"><Label>Known issues / disclosure (optional)</Label><textarea value={draft.knownIssues} onChange={(event) => setDraft((current) => ({ ...current, knownIssues: event.target.value.slice(0, 400) }))} rows={3} placeholder="Mention anything a buyer should know before inspection" className="mt-2 w-full rounded-xl border border-[#DCE3EC] bg-[#FBFCFE] px-3 py-2.5 text-[10.5px] font-semibold outline-none focus:border-[#3156B8]" /><p className="mt-1 text-right text-[8px] text-[#8A94A5]">{draft.knownIssues.length}/400</p></div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setStep(0)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8E0EA] px-4 text-[10px] font-black text-[#4D5A70]"><ChevronLeft className="h-4 w-4" />Back</button>
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void saveDraft(true)} className="h-10 rounded-xl border border-[#BFCDE0] px-4 text-[10px] font-black text-[#3156B8] disabled:opacity-60">Save draft</button><button type="button" disabled={busy} onClick={() => void continueToPhotos()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17365D] px-5 text-[10px] font-black text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue to photos <ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </section>
      ) : null}

      {step === 2 && selectedVehicle ? (
        <section className="rounded-[22px] border border-[#E3E8F0] bg-white p-5 shadow-sm">
          <SelectedSummary customer={selectedCustomer!} vehicle={selectedVehicle} />
          <div className="mt-5 flex items-center justify-between"><div><h2 className="text-[14px] font-black text-[#17213E]">Guided vehicle photos</h2><p className="mt-1 text-[9.5px] text-[#718096]">Upload the same six required views used by the customer app.</p></div><span className="rounded-full bg-[#EFF4FF] px-3 py-1.5 text-[9px] font-black text-[#3156B8]">{uploadedCount}/6 uploaded</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {photoLabels.map((label, index) => {
              const state = photos[label];
              return <label key={label} className={`group relative min-h-[145px] cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-4 transition ${state?.uploaded ? "border-[#A9DCC8] bg-[#F2FBF7]" : "border-[#D5DEE9] bg-[#FAFBFC] hover:border-[#93A9C5]"}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPhoto(label, file); event.currentTarget.value = ""; }} />
                {state?.url ? <img src={state.url} alt={label} className="absolute inset-0 h-full w-full object-cover opacity-20" /> : null}
                <div className="relative flex h-full flex-col items-center justify-center text-center">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${state?.uploaded ? "bg-[#DDF4E9] text-[#147A55]" : "bg-[#EAF0F8] text-[#3156B8]"}`}>{state?.uploaded ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</span>
                  <p className="mt-2 text-[10.5px] font-black text-[#17213E]">{index + 1}. {label}</p>
                  <p className="mt-1 text-[8.5px] font-semibold text-[#7A8598]">{state?.uploaded ? "Uploaded · click to replace" : "Click to upload JPG, PNG or WebP"}</p>
                </div>
              </label>;
            })}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button type="button" onClick={() => setStep(1)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8E0EA] px-4 text-[10px] font-black text-[#4D5A70]"><ChevronLeft className="h-4 w-4" />Back</button>
            <button type="button" disabled={uploadedCount < 6 || busy} onClick={() => setStep(3)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17365D] px-5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#AEB8C8]">Review listing <ChevronRight className="h-4 w-4" /></button>
          </div>
        </section>
      ) : null}

      {step === 3 && selectedVehicle && selectedCustomer ? (
        <section className="rounded-[22px] border border-[#E3E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[#3156B8]" /><div><h2 className="text-[15px] font-black text-[#17213E]">Review before submission</h2><p className="mt-0.5 text-[9.5px] text-[#718096]">Submission sends this listing into the existing Exchange Listing Review queue.</p></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Review label="Customer" value={customerName(selectedCustomer)} />
            <Review label="Vehicle" value={[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.vehicle_type || "Vehicle"} />
            <Review label="Registration" value={selectedVehicle.vehicle_no || "Pending"} />
            <Review label="Odometer" value={draft.odometerKm ? `${Number(draft.odometerKm).toLocaleString("en-IN")} km` : "Not set"} />
            <Review label="Category" value={draft.category} />
            <Review label="Expected price" value={money(draft.askingPrice)} />
            <Review label="Selling mode" value={draft.sellingMode.replaceAll("_", " ")} />
            <Review label="Overall condition" value={draft.overallCondition.replaceAll("_", " ")} />
            <Review label="Photos" value={`${uploadedCount}/6 guided photos`} />
          </div>
          {draft.knownIssues ? <div className="mt-4 rounded-xl border border-[#E4E9F0] bg-[#FAFBFC] p-3"><p className="text-[8px] font-black uppercase tracking-wider text-[#8A94A5]">Known issues / disclosure</p><p className="mt-1 text-[10px] font-semibold leading-5 text-[#46536A]">{draft.knownIssues}</p></div> : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setStep(2)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8E0EA] px-4 text-[10px] font-black text-[#4D5A70]"><ChevronLeft className="h-4 w-4" />Back</button>
            <button type="button" disabled={busy || uploadedCount < 6} onClick={() => void submitListing()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#164BB8] px-5 text-[10px] font-black text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Submit for review</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Loading({ label }: { label: string }) { return <div className="grid min-h-[160px] place-items-center text-[10px] font-bold text-[#718096]"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{label}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="mt-4 grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-[#D8E0EA] bg-[#FAFBFC] text-center"><div><Truck className="mx-auto h-6 w-6 text-[#8EA0B7]" /><p className="mt-2 text-[10px] font-bold text-[#718096]">{text}</p></div></div>; }
function Label({ children }: { children: React.ReactNode }) { return <p className="text-[9px] font-black uppercase tracking-[.06em] text-[#667287]">{children}</p>; }
function ReadOnly({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "lg:col-span-2" : ""}><Label>{label}</Label><div className="mt-1.5 h-10 rounded-xl border border-[#E0E6EE] bg-[#F7F9FC] px-3 py-2.5 text-[10px] font-bold text-[#536078]">{value}</div></div>; }
function Field({ label, value, onChange, placeholder, prefix, suffix }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; prefix?: string; suffix?: string }) { return <div><Label>{label}</Label><div className="mt-1.5 flex h-10 items-center rounded-xl border border-[#DCE3EC] bg-white px-3 focus-within:border-[#3156B8]">{prefix ? <span className="mr-2 text-[10px] font-black text-[#637088]">{prefix}</span> : null}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[10.5px] font-semibold outline-none" />{suffix ? <span className="ml-2 text-[9px] font-bold text-[#7A8598]">{suffix}</span> : null}</div></div>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2 text-[9.5px] font-black capitalize ${active ? "border-[#3156B8] bg-[#3156B8] text-white" : "border-[#DCE3EC] bg-white text-[#536078] hover:bg-[#F7F9FC]"}`}>{children}</button>; }
function Mode({ title, copy, active, onClick }: { title: string; copy: string; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-3 text-left transition ${active ? "border-[#3156B8] bg-[#EFF4FF]" : "border-[#DCE3EC] hover:bg-[#FAFBFC]"}`}><p className="text-[10.5px] font-black text-[#17213E]">{title}</p><p className="mt-1 text-[8.5px] leading-4 text-[#718096]">{copy}</p></button>; }
function ConditionSelect({ label, value, onChange }: { label: string; value: Draft["bodyCondition"]; onChange: (value: Draft["bodyCondition"]) => void }) { return <div><Label>{label}</Label><select value={value} onChange={(event) => onChange(event.target.value as Draft["bodyCondition"])} className="mt-1.5 h-10 w-full rounded-xl border border-[#DCE3EC] bg-white px-3 text-[10px] font-bold text-[#536078] outline-none focus:border-[#3156B8]"><option value="unknown">Unknown</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_attention">Needs attention</option></select></div>; }
function SelectedSummary({ customer, vehicle }: { customer: Customer; vehicle: Vehicle }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E1E7EF] bg-[#F8FAFC] p-3"><div><p className="text-[8px] font-black uppercase tracking-wider text-[#8290A4]">Selected customer</p><p className="mt-1 text-[10.5px] font-black text-[#17213E]">{customerName(customer)} <span className="font-semibold text-[#718096]">· {customer.phone || "No mobile"}</span></p></div><div className="text-right"><p className="text-[8px] font-black uppercase tracking-wider text-[#8290A4]">Selected vehicle</p><p className="mt-1 text-[10.5px] font-black text-[#17213E]">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Vehicle"} <span className="font-semibold text-[#718096]">· {vehicle.vehicle_no || "Pending"}</span></p></div></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#E4E9F0] bg-[#FAFBFC] p-3"><p className="text-[8px] font-black uppercase tracking-wider text-[#8A94A5]">{label}</p><p className="mt-1 text-[10.5px] font-black capitalize text-[#26324A]">{value}</p></div>; }
