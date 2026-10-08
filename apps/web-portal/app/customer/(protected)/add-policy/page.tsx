import { redirect } from "next/navigation";
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
    const upload = form.get("copy");
    if (upload instanceof File && upload.size > 0) {
      if (upload.size > 5 * 1024 * 1024 || !["application/pdf","image/jpeg","image/png","image/webp"].includes(upload.type)) throw new Error("Policy saved, but the file must be PDF/JPG/PNG/WEBP and under 5 MB");
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
    redirect("/customer/start-claim?account=" + encodeURIComponent(authorized.id) + "&vehicle=" + encodeURIComponent(vehicleId));
  }
  return <div className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-2xl font-black text-[#10213D]">Add Policy</h1>
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/add-policy"/>
    <form action={save} className="grid gap-4 rounded-3xl border border-[#DDE6F2] bg-white p-5 sm:grid-cols-2">
      <input type="hidden" name="account" value={account.id}/>
      <CustomerPolicySelections vehicles={vehicles} blocked={policies.filter(p=>p.vehicle_id&&p.start_date<=new Date().toISOString().slice(0,10)&&p.end_date>=new Date().toISOString().slice(0,10)).map(p=>p.vehicle_id as string)} initial={q.vehicle}/>
      <label className="sm:col-span-2 text-sm font-bold">Insurance company *
        <select name="insurer" required className="mt-2 block w-full rounded-xl border p-3 text-sm"><option value="">Select insurer</option>{(companies.data||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
      </label>
      <label className="text-sm font-bold">Policy number *<input required name="number" maxLength={100} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Start date *<input required type="date" name="start" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">End date *<input required type="date" name="end" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Premium<input type="number" min="0" step="0.01" name="premium" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">IDV<input type="number" min="0" step="0.01" name="idv" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold sm:col-span-2">Policy copy (PDF/JPG/PNG/WEBP, up to 5 MB)<input name="copy" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <button className="sm:col-span-2 rounded-xl bg-[#0B3884] px-5 py-3 text-sm font-bold text-white">Save policy</button>
    </form>
    <p className="text-xs text-[#718096]">External policy creation uses the same customer-authorized RPC as the mobile app. Policy copies use the same customer-documents storage and document metadata pattern as the Customer App.</p>
  </div>;
}
