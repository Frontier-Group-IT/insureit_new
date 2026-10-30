import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebCustomerDetail, getPartnerWebSession, listPartnerWebCustomers } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Search = { customer?: string; q?: string; error?: string };

async function startClaim(form: FormData) {
  "use server";
  await getPartnerWebSession();
  const customerId = String(form.get("customer_id") ?? "").trim();
  const vehicleId = String(form.get("vehicle_id") ?? "").trim();
  const policyId = String(form.get("policy_id") ?? "").trim() || null;
  if (!customerId || !vehicleId) redirect("/partner/claims/start?error=selection");

  // Never trust form values. Both lookups and creation run with the current
  // intermediary's JWT, not the service-role client.
  const customer = await getPartnerWebCustomerDetail(customerId).catch(() => null);
  if (!customer || !customer.vehicles.some((vehicle) => vehicle.vehicle_id === vehicleId)) {
    redirect("/partner/claims/start?error=unauthorized");
  }
  if (policyId && !customer.policies.some((policy) => policy.policy_id === policyId && policy.vehicle_no === customer.vehicles.find((vehicle) => vehicle.vehicle_id === vehicleId)?.vehicle_no)) {
    redirect("/partner/claims/start?error=unauthorized");
  }

  const db = await createServerSupabaseClient();
  const { data, error } = await db.rpc("partner_app_create_claim", {
    p_customer_id: customerId,
    p_vehicle_id: vehicleId,
    p_policy_id: policyId,
  });
  if (error || typeof data !== "string" || !data) {
    redirect("/partner/claims/start?customer=" + encodeURIComponent(customerId) + "&error=create");
  }
  redirect("/partner/claims/" + encodeURIComponent(data) + "?stage=spot_intimation");
}

export default async function PartnerStartClaim({ searchParams }: { searchParams?: Promise<Search> }) {
  await getPartnerWebSession();
  const params = searchParams ? await searchParams : {};
  const query = (params.q ?? "").trim().slice(0, 100);
  const rows = await listPartnerWebCustomers({ limit: 100, search: query });
  const selected = params.customer
    ? await getPartnerWebCustomerDetail(params.customer).catch(() => null)
    : null;
  const vehicles = selected?.vehicles ?? [];
  const errors: Record<string, string> = {
    selection: "Select an authorized customer and vehicle.",
    unauthorized: "This customer, vehicle or policy is not authorized for your account.",
    create: "Unable to start this claim. Check eligibility or contact the claims desk.",
  };
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#071D49]">Start Claim</h1><p className="text-sm text-slate-600">Only customers available to your partner account can be selected.</p></div>
        <Link href="/partner/claims" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Back to Claims</Link>
      </div>
      {params.error && errors[params.error] ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors[params.error]}</p> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">1. Select your customer</h2>
        <form action="/partner/claims/start" className="mb-3 flex gap-2">
          <input name="q" defaultValue={query} placeholder="Search partner customers" aria-label="Search partner customers" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button className="rounded-lg bg-[#003A83] px-4 py-2 text-sm text-white">Search</button>
        </form>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {rows.map((row) => <Link key={row.customer_id} href={{ pathname: "/partner/claims/start", query: { customer: row.customer_id, ...(query ? { q: query } : {}) } }} className={`block rounded-lg border p-3 text-sm hover:bg-blue-50 ${selected?.customer.id === row.customer_id ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
            <span className="font-semibold">{row.customer_name}</span><span className="ml-2 text-slate-500">{row.customer_code ?? ""}</span>
          </Link>)}
          {!rows.length ? <p className="py-3 text-sm text-slate-600">No authorized customers found.</p> : null}
        </div>
      </section>
      {selected ? <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">2. Select vehicle and start claim</h2>
        <p className="mb-3 text-sm text-slate-600">Customer: {selected.customer.customer_name}</p>
        <form action={startClaim} className="space-y-3">
          <input type="hidden" name="customer_id" value={selected.customer.id} />
          <label className="block text-sm font-semibold" htmlFor="vehicle">Vehicle</label>
          <select id="vehicle" name="vehicle_id" required className="w-full rounded-lg border px-3 py-2 text-sm" defaultValue="">
            <option value="" disabled>Select an authorized vehicle</option>
            {vehicles.map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.vehicle_no ?? "Unregistered vehicle"} — {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</option>)}
          </select>
          <label className="block text-sm font-semibold" htmlFor="policy">Policy (optional)</label>
          <select id="policy" name="policy_id" className="w-full rounded-lg border px-3 py-2 text-sm" defaultValue="">
            <option value="">No policy selected</option>
            {selected.policies.filter(policy => !!policy.vehicle_no && vehicles.some(vehicle => vehicle.vehicle_no === policy.vehicle_no)).map(policy => <option key={policy.policy_id} value={policy.policy_id}>{policy.policy_no ?? "Policy"} — {policy.vehicle_no}</option>)}
          </select>
          <p className="text-xs text-slate-500">Claim creation is verified again on the server. Choose a policy corresponding to the selected vehicle, if applicable.</p>
          <button disabled={!vehicles.length} className="rounded-lg bg-[#003A83] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Start Claim & Continue</button>
        </form>
      </section> : null}
    </div>
  );
}
