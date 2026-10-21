import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CarFront, FileText, ShieldCheck, UploadCloud, Wallet } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope, loadCustomerWebVehicles, loadCustomerWebPolicies } from "@/lib/customer-web-data";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerPolicySelections } from "@/components/customer-portal/customer-policy-selections";

export const dynamic = "force-dynamic";

export default async function AddCustomerPolicy({ searchParams }: { searchParams?: Promise<{ account?: string; vehicle?: string; error?: string }> }) {
  const q = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(q.account);
  const [vehicles, policies] = await Promise.all([loadCustomerWebVehicles(account.id), loadCustomerWebPolicies(account.id)]);
  const supabase = await createServerSupabaseClient();
  const companies = await supabase.from("insurance_companies").select("id,name").order("name");

  async function save(form: FormData) {
    "use server";
    const accountId = String(form.get("account") || "");
    const { account: authorized } = await resolveCustomerWebScope(accountId);
    const vehicleId = String(form.get("vehicle") || "");
    const permittedVehicles = await loadCustomerWebVehicles(authorized.id);
    const selectedVehicle = permittedVehicles.find(v => v.id === vehicleId);
    if (!selectedVehicle) throw new Error("Vehicle not available to your account");
    const rows = await loadCustomerWebPolicies(authorized.id);
    const startDate = String(form.get("start") || "");
    const endDate = String(form.get("end") || "");
    if (!startDate || !endDate || endDate < startDate) throw new Error("Invalid policy dates");
    const today = new Date().toISOString().slice(0, 10);
    if (rows.some(p => p.vehicle_id === vehicleId && p.start_date <= today && p.end_date >= today)) throw new Error("This vehicle already has an active policy");
    const insurerId = String(form.get("insurer") || "");
    const no = String(form.get("number") || "").trim().toUpperCase();
    const kind = String(form.get("type") || "").trim();
    if (!no || !insurerId || !kind) throw new Error("Complete all mandatory policy fields");
    const allowed = selectedVehicle.vehicle_type === "PCP" || selectedVehicle.vehicle_type === "TWP" ? ["Package","Third Party","SAOD","Bundled","Long Term Package","Long Term Third Party"] : ["Package","Third Party","SAOD"];
    if (!allowed.includes(kind)) throw new Error("This policy product is not valid for the selected vehicle class");
    const db = await createServerSupabaseClient();
    const insurerCheck = await db.from("insurance_companies").select("id").eq("id", insurerId).maybeSingle();
    if (!insurerCheck.data) throw new Error("Invalid insurance company");
    const premium = String(form.get("premium") || "");
    const idv = String(form.get("idv") || "");
    if ([premium,idv].some(v => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0))) throw new Error("Invalid monetary value");
    const upload = form.get("copy");
    if (upload instanceof File && upload.size > 0 && (upload.size > 5 * 1024 * 1024 || !["application/pdf","image/jpeg","image/png","image/webp"].includes(upload.type))) throw new Error("Policy copy must be a PDF or image under 5 MB");
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
    if (error) throw new Error("Policy could not be saved. Please verify its details.");
    const row = Array.isArray(created) ? created[0] : created;
    const newPolicyId = row && typeof row === "object" && "id" in row ? String(row.id) : "";
    if (upload instanceof File && upload.size > 0) {
      if (!newPolicyId) throw new Error("Policy saved, but its ID could not be confirmed for document upload");
      const session = await getCustomerWebSession();
      const ext = upload.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"") || "pdf";
      const storagePath = authorized.id + "/policy-copy/" + crypto.randomUUID() + "." + ext;
      const stored = await db.storage.from("customer-documents").upload(storagePath, upload, { contentType: upload.type, upsert: false });
      if (stored.error) throw new Error("Policy saved but document upload failed");
      const saved = await db.from("customer_documents").insert({
        customer_id: authorized.id, external_policy_id: newPolicyId, document_type: "policy_copy",
        file_name: upload.name.slice(0,180), storage_bucket: "customer-documents", storage_path: storagePath,
        mime_type: upload.type, file_size: upload.size, uploaded_by: session.user.id,
      });
      if (saved.error) {
        await db.storage.from("customer-documents").remove([storagePath]);
        throw new Error("Policy saved but document registration failed");
      }
    }
    redirect("/customer/policies?account=" + encodeURIComponent(authorized.id));
  }
  const inputClass = "mt-2 block w-full min-h-12 rounded-xl border border-[#CEDBEA] bg-[#FBFDFF] px-3 py-3 text-[13px] text-[#1B3150] outline-none transition focus:border-[#2C70C5] focus:ring-2 focus:ring-[#DDEBFC]";
  return <div className="mx-auto max-w-3xl space-y-4 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black text-[#102B54]">Add Policy</h1>
      <Link href={{ pathname: "/customer/policies", query: { account: account.id } }} className="rounded-lg border border-[#CEDBEA] px-3 py-2 text-xs font-bold text-[#24538E] hover:bg-[#EEF5FE]">Back to My Policies</Link>
    </div>
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/add-policy"/>
    <form action={save} encType="multipart/form-data" className="space-y-3">
      <input type="hidden" name="account" value={account.id}/>
      <section className="overflow-hidden rounded-2xl border border-[#B9D4EE] bg-[#F0F7FF] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#BDD8F1] bg-[#DDEEFF] px-4 py-3 font-extrabold text-[#13345D]"><CarFront className="h-5 w-5 text-[#155BAA]"/>Vehicle</div>
        <div className="p-4 [&_select]:!border-[#B5CDE5] [&_select]:!bg-white [&_select]:!py-3"><CustomerPolicySelections vehicles={vehicles} blocked={policies.filter(p=>p.vehicle_id&&p.start_date<=new Date().toISOString().slice(0,10)&&p.end_date>=new Date().toISOString().slice(0,10)).map(p=>p.vehicle_id as string)} initial={q.vehicle} /></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#F0D7B4] bg-[#FFF8ED] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#EED5B1] bg-[#FFEBCF] px-4 py-3 font-extrabold text-[#13345D]"><FileText className="h-5 w-5 text-[#B97422]"/>Policy details</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-[12px] font-bold text-[#1B3150] sm:col-span-2">Insurer *<select name="insurer" required className={inputClass}><option value="">Select insurer</option>{(companies.data||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label className="text-[12px] font-bold text-[#1B3150]">Policy no. *<input required name="number" maxLength={100} placeholder="Enter policy number" className={inputClass}/></label>
          <div className="self-end rounded-xl bg-[#FFF1DA] p-3 text-[11px] leading-5 text-[#855C26]"><ShieldCheck className="mr-1 inline h-4 w-4"/>Select your policy product in the Vehicle section above.</div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#BEE4D3] bg-[#F1FBF6] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#BCE5D1] bg-[#DDF7E9] px-4 py-3 font-extrabold text-[#13345D]"><CalendarDays className="h-5 w-5 text-[#138867]"/>Validity and value</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-[12px] font-bold text-[#1B3150]">Start date *<input required type="date" name="start" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]">End date *<input required type="date" name="end" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]">IDV (optional)<input type="number" min="0" step="0.01" name="idv" placeholder="₹ 0.00" className={inputClass}/></label>
          <label className="text-[12px] font-bold text-[#1B3150]"><Wallet className="mr-1 inline h-4 w-4 text-[#158565]"/>Premium (optional)<input type="number" min="0" step="0.01" name="premium" placeholder="₹ 0.00" className={inputClass}/></label>
          <label className="rounded-xl border border-dashed border-[#ABC8E7] bg-[#F7FAFF] p-3 text-[12px] font-bold text-[#1E4472] sm:col-span-2"><UploadCloud className="mr-2 inline h-5 w-5"/>Upload policy copy <span className="font-normal text-[#65809E]">(PDF or image, up to 5 MB)</span><input name="copy" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#E2EEFF] file:px-3 file:py-2 file:font-semibold file:text-[#1A55A0]"/></label>
        </div>
      </section>
      <button type="submit" className="w-full rounded-xl bg-[#1755A7] px-5 py-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0B418A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155BAA]">Save policy</button>
    </form>
    <p className="text-xs leading-5 text-[#718096]">Your policy will be added to your account as an external policy. The customer-authorized service verifies vehicle ownership and keeps other customers’ records private.</p>
  </div>;
}
