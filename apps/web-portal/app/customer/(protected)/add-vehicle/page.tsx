import { redirect } from "next/navigation";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";

export const dynamic = "force-dynamic";

const vehicleClasses = [["PCP","Private Car"],["TWP","Two Wheeler"],["GCV","Goods Carrying"],["PCV","Passenger Carrying"],["MISD","Miscellaneous"],["CPM","Plant & Machinery"]];
export default async function AddCustomerVehicle({ searchParams }: { searchParams?: Promise<{ account?: string }> }) {
  const q=searchParams?await searchParams:{};
  const { account,accounts }=await resolveCustomerWebScope(q.account);
  async function save(form: FormData) {
    "use server";
    const accountId=String(form.get("account")||"");
    const { account: authorized }=await resolveCustomerWebScope(accountId);
    const reg=String(form.get("registration")||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase();
    const klass=String(form.get("class")||"");
    const make=String(form.get("make")||"").trim();
    const model=String(form.get("model")||"").trim();
    const year=Number(form.get("year"));
    if(!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(reg)) throw new Error("Enter a complete valid registration number");
    if(!vehicleClasses.some(c=>c[0]===klass)||!make||!model||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1) throw new Error("Invalid vehicle details");
    const db=await createServerSupabaseClient();
    const { error }=await db.rpc("create_customer_vehicle_v2",{
      p_customer_id:authorized.id,p_vehicle_no:reg,p_vehicle_type:klass,p_make:make,p_model:model,p_year:year,
      p_chassis_no:String(form.get("chassis")||"").trim().toUpperCase()||null,
      p_engine_no:String(form.get("engine")||"").trim().toUpperCase()||null,
      p_permit_no:null,p_gvw_kg:null,p_engine_capacity_cc:null,p_seating_capacity:null,
      p_fuel_type:null,p_registration_date:null,p_fitness_expiry_date:null,p_puc_expiry_date:null,
      p_road_tax_expiry_date:null,p_national_permit_expiry_date:null,p_local_permit_expiry_date:null,
    });
    if(error) throw new Error("Vehicle could not be added. Check for an existing registration or contact Support.");
    redirect("/customer/start-claim?account="+encodeURIComponent(authorized.id));
  }
  return <div className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-2xl font-black">Add Vehicle</h1>
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/add-vehicle"/>
    <form action={save} className="grid gap-4 rounded-3xl border bg-white p-5 sm:grid-cols-2">
      <input type="hidden" name="account" value={account.id}/>
      <label className="text-sm font-bold">Registration number *<input name="registration" required maxLength={15} placeholder="MH19BN4334" className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Vehicle class *<select name="class" required className="mt-2 block w-full rounded-xl border p-3 text-sm"><option value="">Select class</option>{vehicleClasses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-bold">Manufacturer *<input name="make" required maxLength={100} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Model *<input name="model" required maxLength={100} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Manufacturing year *<input name="year" type="number" required min="1950" max={new Date().getFullYear()+1} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Chassis number<input name="chassis" maxLength={50} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <label className="text-sm font-bold">Engine number<input name="engine" maxLength={50} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>
      <button className="sm:col-span-2 rounded-xl bg-[#0B3884] px-5 py-3 text-sm font-bold text-white">Save vehicle</button>
    </form>
    <p className="text-xs text-[#75849C]">Registered vehicle entry is available here. RC lookup, unregistered vehicles and compliance/capacity fields need the additional mobile parity pass.</p>
  </div>;
}
