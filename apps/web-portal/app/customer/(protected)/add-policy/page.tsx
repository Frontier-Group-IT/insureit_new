import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CarFront, FileText, ShieldCheck, UploadCloud, Wallet } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope, loadCustomerWebVehicles, loadCustomerWebPolicies } from "@/lib/customer-web-data";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerPolicySelections } from "@/components/customer-portal/customer-policy-selections";
import { CustomerPolicySaveForm, type PolicySaveState } from "./customer-policy-save-form";

export const dynamic = "force-dynamic";

export default async function AddCustomerPolicy({ searchParams }: { searchParams?: Promise<{ account?: string; vehicle?: string; error?: string }> }) {
  const q = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(q.account);
  const [vehicles, policies] = await Promise.all([loadCustomerWebVehicles(account.id), loadCustomerWebPolicies(account.id)]);
  const supabase = await createServerSupabaseClient();
  const companies = await supabase.from("insurance_companies").select("id,name").order("name");

  async function save(_state: PolicySaveState, form: FormData): Promise<PolicySaveState> {
    "use server";
    const accountId = String(form.get("account") || "");
    const { account: authorized } = await resolveCustomerWebScope(accountId);
    const vehicleId = String(form.get("vehicle") || "");
    const permittedVehicles = await loadCustomerWebVehicles(authorized.id);
    const selectedVehicle = permittedVehicles.find(v => v.id === vehicleId);
    if (!selectedVehicle) return { error: "Vehicle not available to your account.", policyCreated: false };
    const rows = await loadCustomerWebPolicies(authorized.id);
    const startDate = String(form.get("start") || "");
    const endDate = String(form.get("end") || "");
    if (!startDate || !endDate || endDate < startDate) return { error: "Check the policy start and end dates.", policyCreated: false };
    const today = new Date().toISOString().slice(0, 10);
    if (rows.some(p => p.vehicle_id === vehicleId && p.start_date <= today && p.end_date >= today)) return { error: "This vehicle already has an active policy.", policyCreated: false };
    const insurerId = String(form.get("insurer") || "");
    const no = String(form.get("number") || "").trim().toUpperCase();
    const kind = String(form.get("type") || "").trim();
    if (!no || !insurerId || !kind) return { error: "Complete all mandatory policy fields.", policyCreated: false };
    const allowed = selectedVehicle.vehicle_type === "PCP" || selectedVehicle.vehicle_type === "TWP" ? ["Package","Third Party","SAOD","Bundled","Long Term Package","Long Term Third Party"] : ["Package","Third Party","SAOD"];
    if (!allowed.includes(kind)) return { error: "This policy product is not valid for this vehicle.", policyCreated: false };
    const db = await createServerSupabaseClient();
    const insurerCheck = await db.from("insurance_companies").select("id").eq("id", insurerId).maybeSingle();
    if (!insurerCheck.data) return { error: "Select a valid insurance company.", policyCreated: false };
    const premium = String(form.get("premium") || "");
    const idv = String(form.get("idv") || "");
    if ([premium,idv].some(v => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0))) return { error: "Enter valid non-negative IDV and premium values.", policyCreated: false };
    const upload = form.get("copy");
    if (upload instanceof File && upload.size > 0 && (upload.size > 5 * 1024 * 1024 || !["application/pdf","image/jpeg","image/png","image/webp"].includes(upload.type))) return { error: "Policy copy must be a PDF or image under 5 MB.", policyCreated: false };
    const { data: created, error } = await (db.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("create_customer_external_policy", {
      p_customer_id: authorized.id,
      p_vehicle_id: vehicleId,
      p_insurance_company_id: insurerId,
      p_policy_no: no,
      p_policy_type: kind,
      p_start_date: startDate,
      p_end_date: endDate,
      p_premium_amount: premium === "" ? null : Number(premium),
      p_insured_declared_value: idv === "" ? null : Number(idv),
    });
    if (error) return { error: "Policy could not be saved. Please verify its details and try again.", policyCreated: false };
    const row = Array.isArray(created) ? created[0] : created;
    const newPolicyId = row && typeof row === "object" && "id" in row ? String(row.id) : "";
    if (upload instanceof File && upload.size > 0) {
      if (!newPolicyId) return { error: "Policy was created, but its document upload could not be completed. Do not submit again; check My Policies.", policyCreated: true };
      const session = await getCustomerWebSession();
      const ext = upload.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"") || "pdf";
      const storagePath = authorized.id + "/policy-copy/" + crypto.randomUUID() + "." + ext;
      const stored = await db.storage.from("customer-documents").upload(storagePath, upload, { contentType: upload.type, upsert: false });
      if (stored.error) return { error: "Policy was saved, but its document upload failed. Do not submit again; check My Policies.", policyCreated: true };
      const saved = await db.from("customer_documents").insert({
        customer_id: authorized.id, external_policy_id: newPolicyId, document_type: "policy_copy",
        file_name: upload.name.slice(0,180), storage_bucket: "customer-documents", storage_path: storagePath,
        mime_type: upload.type, file_size: upload.size, uploaded_by: session.user.id,
      });
      if (saved.error) {
        await db.storage.from("customer-documents").remove([storagePath]);
        return { error: "Policy was saved, but its document registration failed. Do not submit again; check My Policies.", policyCreated: true };
      }
    }
    redirect("/customer/policies?account=" + encodeURIComponent(authorized.id));
  }
  const inputClass = "mt-1.5 block w-full min-h-10 rounded-xl border border-[#D6E0EF] bg-[#FBFDFF] px-3 py-2 text-[12px] text-[#1B3150] outline-none transition focus:border-[#2C70C5] focus:ring-2 focus:ring-[#DDEBFC]";
  return <div className="w-full space-y-3 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-black text-[#102B54]">Add Policy</h1>
      <Link href={{ pathname: "/customer/policies", query: { account: account.id } }} className="rounded-lg border border-[#CEDBEA] px-3 py-2 text-xs font-bold text-[#24538E] hover:bg-[#EEF5FE]">Back to My Policies</Link>
    </div>
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/add-policy"/>
    <div className="overflow-hidden rounded-2xl border border-[#DCE6F2] bg-white shadow-sm"><div className="flex items-center justify-between bg-gradient-to-r from-[#0D2853] to-[#24508A] px-5 py-4 text-white"><h2 className="text-[17px] font-bold">Policy Onboarding</h2><ShieldCheck className="h-6 w-6 text-cyan-200"/></div><div className="flex flex-wrap gap-5 bg-[#F7F9FC] px-5 py-3 text-[11px] font-semibold text-[#506783]"><span>01 &nbsp; Vehicle</span><span>02 &nbsp; Policy Details</span><span>03 &nbsp; Review &amp; Save</span></div></div>
    <CustomerPolicySaveForm action={save} accountId={account.id}>
      <input type="hidden" name="account" value={account.id}/>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(275px,1fr)]"><div className="min-w-0 space-y-3"><section id="policy-step-vehicle" className="overflow-hidden rounded-2xl border border-[#DFE7F0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E7EDF4] px-4 py-3 text-[13px] font-extrabold text-[#13345D]"><span className="rounded-lg bg-[#163A68] px-2.5 py-1.5 text-xs text-white">01</span><CarFront className="h-5 w-5 text-[#155BAA]"/>Vehicle identification</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 [&_select]:!border-[#D5E0ED] [&_select]:!bg-white [&_select]:!py-2 [&_select]:!text-[12px]"><CustomerPolicySelections accountId={account.id} vehicles={vehicles} blocked={policies.filter(p=>p.vehicle_id&&p.start_date<=new Date().toISOString().slice(0,10)&&p.end_date>=new Date().toISOString().slice(0,10)).map(p=>p.vehicle_id as string)} initial={q.vehicle} /></div>
      </section>
      <section id="policy-step-details" className="overflow-hidden rounded-2xl border border-[#DFE7F0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E7EDF4] px-4 py-3 text-[13px] font-extrabold text-[#13345D]"><span className="rounded-lg bg-[#163A68] px-2.5 py-1.5 text-xs text-white">02</span><FileText className="h-5 w-5 text-[#B97422]"/>Policy details</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-[12px] font-bold text-[#1B3150] sm:col-span-2">Insurer *<select name="insurer" required className={inputClass}><option value="">Select insurer</option>{(companies.data||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label className="text-[12px] font-bold text-[#1B3150]">Policy no. *<input required name="number" maxLength={100} placeholder="Enter policy number" className={inputClass}/></label>
          <div className="self-end rounded-xl bg-[#FFF1DA] p-3 text-[11px] leading-5 text-[#855C26]"><ShieldCheck className="mr-1 inline h-4 w-4"/>Select your policy product in the Vehicle section above.</div>
        </div>
      </section>
      <section id="policy-step-save" className="overflow-hidden rounded-2xl border border-[#DFE7F0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E7EDF4] px-4 py-3 text-[13px] font-extrabold text-[#13345D]"><span className="rounded-lg bg-[#163A68] px-2.5 py-1.5 text-xs text-white">03</span><CalendarDays className="h-5 w-5 text-[#138867]"/>Validity, premium &amp; documents</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-[12px] font-bold text-[#1B3150]">Start date *<input required type="date" name="start" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]">End date *<input required type="date" name="end" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]">IDV (optional)<input type="number" min="0" step="0.01" name="idv" placeholder="₹ 0.00" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]"><Wallet className="mr-1 inline h-4 w-4 text-[#158565]"/>Premium (optional)<input type="number" min="0" step="0.01" name="premium" placeholder="₹ 0.00" className={inputClass}/></label>
          <label className="rounded-xl border border-dashed border-[#ABC8E7] bg-[#F7FAFF] p-3 text-[12px] font-bold text-[#1E4472] sm:col-span-2"><UploadCloud className="mr-2 inline h-5 w-5"/>Upload policy copy <span className="font-normal text-[#65809E]">(PDF or image, up to 5 MB)</span><input name="copy" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#E2EEFF] file:px-3 file:py-2 file:font-semibold file:text-[#1A55A0]"/></label>
        </div>
      </section></div><aside className="rounded-2xl border border-[#DCE6F2] bg-white p-4 shadow-sm xl:sticky xl:top-24"><h3 className="text-[14px] font-bold text-[#17385E]">Policy summary</h3><p className="mt-2 text-[11px] leading-5 text-[#647A97]">Review your vehicle, insurer, dates and premium before saving. Values update as you enter them.</p><div id="customer-policy-live-summary" aria-live="polite" className="mt-3 space-y-3 text-[12px] text-[#294766]"><p>Select a vehicle to begin.</p></div></aside></div>
    </CustomerPolicySaveForm>
    <p className="text-xs leading-5 text-[#718096]">Your policy will be added to your account as an external policy. The customer-authorized service verifies vehicle ownership and keeps other customers’ records private.</p>
  </div>;
}
