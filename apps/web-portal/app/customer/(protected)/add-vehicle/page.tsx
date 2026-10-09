import { redirect } from "next/navigation";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerRcLookup } from "@/components/customer-portal/customer-rc-lookup";

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
    const num=(key:string) => {const raw=String(form.get(key)||"");const value=raw?Number(raw):null;if(value!==null&&(!Number.isFinite(value)||value<=0))throw new Error("Invalid vehicle capacity");return value;};
    const gvw=klass==="GCV"||klass==="CPM"?num("capacityGvw"):null;
    const seats=klass==="PCV"?num("capacitySeating"):null;
    const engine=klass!=="GCV"&&klass!=="CPM"&&klass!=="PCV"?num("capacityEngine"):null;
    const date=(key:string)=>{const v=String(form.get(key)||"");if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error("Invalid vehicle date");return v||null;};
    const db=await createServerSupabaseClient();
    const { error }=await (db.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("create_customer_vehicle_v2",{
      p_customer_id:authorized.id,p_vehicle_no:reg,p_vehicle_type:klass,p_make:make,p_model:model,p_year:year,
      p_chassis_no:String(form.get("chassis")||"").trim().toUpperCase()||null,
      p_engine_no:String(form.get("engine")||"").trim().toUpperCase()||null,
      p_permit_no:null,p_gvw_kg:gvw,p_engine_capacity_cc:engine,p_seating_capacity:seats,
      p_fuel_type:String(form.get("fuel")||"")||null,p_registration_date:date("registrationDate"),p_fitness_expiry_date:date("fitnessDate"),p_puc_expiry_date:date("pucDate"),
      p_road_tax_expiry_date:date("roadTaxDate"),p_national_permit_expiry_date:date("nationalPermitDate"),p_local_permit_expiry_date:date("localPermitDate"),
    });
    if(error) throw new Error("Vehicle could not be added. Check for an existing registration or contact Support.");
    redirect("/customer/start-claim?account="+encodeURIComponent(authorized.id));
  }
  const field="mt-1 block h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] text-[#142746]";
  const label="min-w-0 text-[11px] font-semibold text-[#445670]";
  const sections=["Vehicle Ownership","Vehicle Specification","Compliance & Permit"];
  return <div className="space-y-3">
    <div className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
      <div className="flex items-center justify-between bg-[#1E416D] px-4 py-3 text-white">
        <h1 className="text-[17px] font-semibold">Vehicle Onboarding</h1>
        <a href="/customer/vehicles" className="rounded-lg border border-white/30 px-4 py-2 text-[11px] font-semibold hover:bg-white/10">Back</a>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[#DFE8F3] bg-[#F8FAFD]">
        {sections.map((name,i)=><div key={name} className="flex items-center justify-center gap-2 px-2 py-3 text-center text-[11px] text-[#425772]">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ECF3FA] text-[10px] font-semibold">{String(i+1).padStart(2,"0")}</span>{name}
        </div>)}
      </div>
    </div>
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/add-vehicle"/>
    <form id="customer-add-vehicle-form" action={save} className="space-y-3">
      <input type="hidden" name="account" value={account.id}/>
      <section className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="flex items-center gap-3 border-b border-[#DFE8F3] px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365F] text-[11px] font-bold text-white">01</span><h2 className="text-[13px] font-semibold">Vehicle Ownership</h2></div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">
          <label className={label}>Customer<input value={account.name} readOnly className={field+" bg-[#F4F7FB]"}/></label>
          <CustomerRcLookup/>
          <label className={label}>Registration date<input name="registrationDate" type="date" className={field}/></label>
          <label className={label}>Manufacturer *<input name="make" required maxLength={100} className={field}/></label>
          <label className={label}>MFG Year *<input name="year" type="number" required min="1950" max={new Date().getFullYear()+1} className={field}/></label>
          <label className={label}>Model *<input name="model" required maxLength={100} className={field}/></label>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="flex items-center gap-3 border-b border-[#DFE8F3] px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365F] text-[11px] font-bold text-white">02</span><h2 className="text-[13px] font-semibold">Vehicle Specification</h2></div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">
          <label className={label}>Class *<select name="class" required className={field}><option value="">Select class</option>{vehicleClasses.map(([value,name])=><option key={value} value={value}>{value} · {name}</option>)}</select></label>
          <label className={label}>Chassis number<input name="chassis" maxLength={50} className={field}/></label>
          <label className={label}>Engine number<input name="engine" maxLength={50} className={field}/></label>
          <label className={label}>Fuel type<select name="fuel" className={field}><option value="">Select</option>{["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"].map(v=><option key={v}>{v}</option>)}</select></label>
          <label className={label}>GVW (GCV / CPM)<input name="capacityGvw" type="number" min="1" className={field}/></label>
          <label className={label}>Engine capacity (cc)<input name="capacityEngine" type="number" min="1" className={field}/></label>
          <label className={label}>Seating capacity (PCV)<input name="capacitySeating" type="number" min="1" className={field}/></label>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="flex items-center gap-3 border-b border-[#DFE8F3] px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365F] text-[11px] font-bold text-white">03</span><h2 className="text-[13px] font-semibold">Compliance & Permit</h2></div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">
          {([["fitnessDate","Fitness expiry"],["pucDate","PUC expiry"],["roadTaxDate","Road tax expiry"],["nationalPermitDate","National permit expiry"],["localPermitDate","Local permit expiry"]] as const).map(([name,title])=><label key={name} className={label}>{title}<input name={name} type="date" className={field}/></label>)}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[#75849C]">RC lookup uses the existing Customer API. Verify fetched details before saving.</p>
        <button className="rounded-lg bg-[#17365F] px-5 py-2.5 text-[12px] font-semibold text-white">Save Vehicle</button>
      </div>
    </form>
  </div>;
}
