"use client";
import { useState } from "react";
import QuoteComparisonDemo from "./quote-comparison-demo";
import { ChevronDown, FileSearch, Loader2, Search, Truck, RotateCcw, ArrowRight, BadgeCheck, ScanLine } from "lucide-react";

type Field = {key:string;label:string;placeholder?:string};
const vehicle:Field[]=[
{key:"make",label:"Manufacturer"},{key:"model",label:"Model / variant"},{key:"vehicleClass",label:"Vehicle class"},{key:"vehicleCategory",label:"Usage / category"},
{key:"bodyType",label:"Body type"},{key:"fuelType",label:"Fuel / powertrain"},{key:"manufacturingYear",label:"Manufacturing year"},{key:"manufactureDate",label:"Mfg. month/date"},
{key:"registrationDate",label:"First registration date"},{key:"rtoName",label:"RTO / location"},{key:"rtoState",label:"RTO state"},{key:"chassisNumber",label:"Chassis number"},
{key:"engineNumber",label:"Engine / motor number"},{key:"engineCapacity",label:"Engine CC / power (kW)"},{key:"grossWeight",label:"GVW (kg)"},{key:"unladenWeight",label:"Unladen weight (kg)"},
{key:"seatingCapacity",label:"Seating capacity"},{key:"standingCapacity",label:"Standing capacity"},{key:"sleeperCapacity",label:"Sleeper capacity"},{key:"wheelBase",label:"Wheelbase"},
{key:"color",label:"Colour"},{key:"normsType",label:"Emission standard"},{key:"fitnessExpiryDate",label:"Fitness valid until"},{key:"pucUpto",label:"PUC valid until"},
{key:"taxUpto",label:"Road tax valid until"},{key:"permitType",label:"Permit type"},{key:"permitNumber",label:"Permit number"},{key:"permitValidUpto",label:"Permit valid until"},
{key:"nationalPermitUpto",label:"National permit until"},{key:"blacklistStatus",label:"Blacklist status"}];
// Keep supplementary RC fields available in Advanced RC details without crowding the quote essentials.
const primaryVehicleKeys = new Set(["make","model","vehicleClass","vehicleCategory","fuelType","manufacturingYear","registrationDate","rtoName","rtoState","chassisNumber","engineNumber","engineCapacity","grossWeight","seatingCapacity"]);
const primaryVehicle = vehicle.filter(field => primaryVehicleKeys.has(field.key));
const advancedVehicle = vehicle.filter(field => !primaryVehicleKeys.has(field.key));
const rcToQuoteField:Record<string,string> = {
  manufacturer:"make", engineCapacityCc:"engineCapacity", gvwKg:"grossWeight",
  pucExpiryDate:"pucUpto", roadTaxExpiryDate:"taxUpto",
  localPermitExpiryDate:"permitValidUpto", nationalPermitExpiryDate:"nationalPermitUpto"
};
const customer:Field[]=[{key:"ownerName",label:"Registered owner / proposer"},{key:"mobileNumber",label:"Mobile"},{key:"email",label:"Email"},{key:"dob",label:"DOB / incorporation date"},
{key:"proposerType",label:"Individual / organization"},{key:"gender",label:"Gender"},{key:"occupation",label:"Occupation / business"},{key:"pan",label:"PAN"},
{key:"gstin",label:"GSTIN"},{key:"kyc",label:"CKYC / KYC reference"},{key:"permanentAddress",label:"Registered address"},{key:"presentAddress",label:"Communication address"},
{key:"ownerCity",label:"City"},{key:"ownerState",label:"State"},{key:"ownerPincode",label:"PIN code"}];
const cover:Field[]=[{key:"businessType",label:"Business type"},{key:"coverageType",label:"Cover requested"},{key:"startDate",label:"Proposed policy start"},{key:"idv",label:"Target vehicle IDV (₹)"},
{key:"bodyValue",label:"Body value (₹)"},{key:"trailerValue",label:"Trailer value (₹)"},{key:"electricalValue",label:"Electrical accessories (₹)"},{key:"nonElectricalValue",label:"Non-electrical accessories (₹)"},
{key:"cngValue",label:"CNG/LPG kit (₹)"},{key:"previousInsurer",label:"Previous insurer"},{key:"previousPolicy",label:"Previous policy number"},{key:"previousExpiry",label:"Previous policy expiry"},
{key:"ncb",label:"NCB claimed (%)"},{key:"claims",label:"Claims in previous period"},{key:"financerName",label:"Financier name"},{key:"financeType",label:"Hypothecation / lease"}];
const nominee:Field[]=[{key:"nomineeName",label:"Nominee name"},{key:"nomineeRelation",label:"Relationship"},{key:"nomineeDob",label:"Nominee DOB"},{key:"nomineeShare",label:"Share (%)"},
{key:"appointee",label:"Appointee (minor nominee)"},{key:"ownerPa",label:"Owner-driver PA cover"},{key:"paidDrivers",label:"Number of paid drivers"},{key:"voluntaryDeductible",label:"Voluntary deductible (₹)"}];
const addons=["Nil depreciation","Consumables","Engine protect","Roadside assistance","Return to invoice","Key replacement","Tyre / glass protect","IMT 23 – lamps / tyres","IMT 47 – overturning","Legal liability to paid driver","PA to occupants","Electrical accessory cover","Non-electrical accessory cover","Trailer cover","Battery protection (EV)","Geographical extension"];

// Predefined values are UI suggestions only; retain unknown values returned by AuthBridge.
const dropdowns: Record<string, string[]> = {
 vehicleClass:["TWP","PCP","PCV","GCV","CPM","MISD"],
 vehicleCategory:["LMV","LMV-NT","LMV-TR","Private","Commercial","Transport","Non-transport","Goods carrier","Passenger carrier","Taxi","Bus","Construction equipment","Tractor"],
 bodyType:["Hatchback","Sedan","SUV","MUV","Pickup","Truck","Tipper","Trailer","Bus","Van","Tanker","Flatbed","Other"],
 fuelType:["Petrol","Diesel","CNG","LPG","Electric","Hybrid","Bi-Fuel","Other"],
 rtoState:["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Chandigarh","Jammu and Kashmir","Ladakh","Puducherry","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"],
 color:["White","Black","Silver","Grey","Red","Blue","Green","Brown","Yellow","Orange","Gold","Other"],
 normsType:["BS II","BS III","BS IV","BS VI","Euro IV","Euro VI","Electric","Other"],
 permitType:["National permit","State permit","Goods permit","Contract carriage","Stage carriage","Tourist permit","Temporary permit","Not applicable","Other"],
 blacklistStatus:["Not blacklisted","Blacklisted","Under review","Unknown"],
 proposerType:["Individual","Organization","Company","Partnership","Proprietorship","Trust"],
 gender:["Male","Female","Other","Prefer not to say"],
 occupation:["Salaried","Self-employed","Business","Agriculture","Professional","Transport operator","Retired","Student","Other"],
 ownerState:["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Chandigarh","Jammu and Kashmir","Ladakh","Puducherry","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"],
 businessType:["New business","Renewal","Roll-over","Used vehicle"],
 coverageType:["Package (OD + TP)","Own damage only","Third party only","Standalone OD","Comprehensive"],
 ncb:["0","20","25","35","45","50"],
 claims:["No","Yes"],
 financeType:["None","Hypothecation","Lease","Hire purchase"],
 nomineeRelation:["Spouse","Father","Mother","Son","Daughter","Brother","Sister","Other"],
 ownerPa:["Yes","No"],
 paidDrivers:["0","1","2","3","4","5","6","7","8","9","10"],
 voluntaryDeductible:["0","2500","5000","7500","10000","15000","25000"]
};
const dateFields = new Set(["registrationDate","manufactureDate","fitnessExpiryDate","pucUpto","taxUpto","permitValidUpto","nationalPermitUpto","dob","startDate","previousExpiry","nomineeDob"]);
const numericFields = new Set(["manufacturingYear","engineCapacity","grossWeight","unladenWeight","seatingCapacity","standingCapacity","sleeperCapacity","wheelBase","idv","bodyValue","trailerValue","electricalValue","nonElectricalValue","cngValue","nomineeShare"]);

const requiredKeys = new Set(["make","model","vehicleClass","fuelType","chassisNumber","engineNumber","ownerName","mobileNumber","businessType","coverageType","startDate"]);
const demoVehicle:Record<string,string> = {
 chassisNumber:"123456789",make:"TATA MOTORS",model:"TATA ACE GOLD DIESEL",vehicleClass:"GCV",vehicleCategory:"Goods carrier",bodyType:"Pickup",fuelType:"Diesel",manufacturingYear:"2026",manufactureDate:"2026-10-01",engineNumber:"DEMOENG2026001",engineCapacity:"702",grossWeight:"1830",unladenWeight:"1030",seatingCapacity:"2",standingCapacity:"0",sleeperCapacity:"0",wheelBase:"2100",color:"White",normsType:"BS VI",blacklistStatus:"Not blacklisted",ownerName:"DEMO CUSTOMER",mobileNumber:"9999999999",email:"demo@example.invalid",proposerType:"Individual",occupation:"Business",ownerCity:"Jabalpur",ownerState:"Madhya Pradesh",ownerPincode:"482001",permanentAddress:"Demo address, Jabalpur",presentAddress:"Demo address, Jabalpur",businessType:"New business",coverageType:"Package (OD + TP)",startDate:"2026-10-25",idv:"450000",claims:"No",ncb:"0",financeType:"None",ownerPa:"Yes",nomineeName:"DEMO NOMINEE",nomineeRelation:"Spouse",nomineeShare:"100",paidDrivers:"0",voluntaryDeductible:"0"
};
const defaults:Record<string,string>={businessType:"New business",coverageType:"Package (OD + TP)",claims:"No",ownerPa:"Yes",nomineeShare:"100"};
function Section({title,fields,values,onSet,open,onToggle}:{title:string;subtitle?:string;fields:Field[];values:Record<string,string>;onSet:(k:string,v:string)=>void;open:boolean;onToggle:()=>void}) {
 return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
 <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"><span><span className="block text-[12px] font-bold text-slate-800">{title}</span></span><ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open?"rotate-180":""}`}/></button>
 {open&&<div className="grid gap-x-2 gap-y-2 p-3 sm:grid-cols-2 xl:grid-cols-4">{fields.map(f=><label key={f.key} className="min-w-0"><span className="mb-1 block truncate text-[11px] font-bold text-[#2e6b91]">{f.label}{requiredKeys.has(f.key)&&<span className="ml-0.5 text-red-600" aria-label="required">*</span>}</span>{dropdowns[f.key] ? <select aria-label={f.label} value={values[f.key]??""} onChange={e=>onSet(f.key,e.target.value)} className={`h-9 w-full min-w-0 rounded-lg border px-2.5 text-[12px] font-semibold outline-none focus:border-blue-600 focus:bg-white ${values[f.key]?"border-blue-200 bg-blue-50/60 text-slate-950 shadow-[inset_3px_0_0_#93c5fd]":"border-slate-300 bg-slate-50 text-slate-700"}`}><option value="">Select {f.label.toLowerCase()}</option>{values[f.key] && !dropdowns[f.key].includes(values[f.key]) && <option value={values[f.key]}>{values[f.key]} (fetched / custom)</option>}{dropdowns[f.key].map(option=><option key={option} value={option}>{option}</option>)}</select> : <input aria-label={f.label} type={dateFields.has(f.key)?"date":numericFields.has(f.key)?"number":"text"} value={values[f.key]??""} onChange={e=>onSet(f.key,e.target.value)} placeholder={f.placeholder??"Enter / verify"} className={`h-9 w-full min-w-0 rounded-lg border px-2.5 text-[12px] font-semibold outline-none placeholder:text-slate-400 focus:border-blue-600 focus:bg-white ${values[f.key]?"border-blue-200 bg-blue-50/60 text-slate-950 shadow-[inset_3px_0_0_#93c5fd]":"border-slate-300 bg-slate-50 text-slate-700"}`} />}</label>)}</div>}
 </section>;
}
export default function QuoteBookWorkspace(){
 const [mode,setMode]=useState<"registered"|"unregistered">("registered");
 const [query,setQuery]=useState(""); const [values,setValues]=useState<Record<string,string>>(defaults);
 const [open,setOpen]=useState<Record<string,boolean>>({vehicle:true,customer:true,cover:true,nominee:false,addons:true,vehicleAdvanced:false});
 const [preview,setPreview]=useState(false); const [demo,setDemo]=useState(false);
 const [selected,setSelected]=useState<string[]>([]); const [loading,setLoading]=useState(false); const [message,setMessage]=useState("");
 const set=(k:string,v:string)=>setValues(p=>({...p,[k]:v}));
 const toggle=(k:string)=>setOpen(p=>({...p,[k]:!p[k]}));
 const clearForm=()=>{setQuery("");setValues({...defaults});setSelected([]);setMessage("");setDemo(false);setPreview(false);setOpen({vehicle:true,customer:true,cover:true,nominee:false,addons:true,vehicleAdvanced:false});};
 const fetchVehicle=async()=>{if(mode!=="registered"){
 const chassis=query.trim().toUpperCase();if(!chassis){setMessage("Enter a chassis number.");return;}
 if(chassis==="123456789"){setValues({...defaults,...demoVehicle});setDemo(true);setMessage("DEMO ONLY — fictional vehicle and customer. No database data was read or saved.");return;}
 setLoading(true);setMessage("");setDemo(false);
 try{const response=await fetch("/api/development/quote-book/chassis-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chassisNumber:chassis})});const data=await response.json();
 if(!response.ok){setValues({...defaults,chassisNumber:chassis});setMessage(data.error||"Lookup failed; continue manually.");return;}
 setValues({...defaults,chassisNumber:chassis,...data.details});setMessage(data.matches>1?"Matching chassis found for multiple customers; showing the first linked customer. Verify before quoting.":"Vehicle and linked customer details loaded from INSUREIT.");}
 catch{setValues({...defaults,chassisNumber:chassis});setMessage("Could not search saved vehicles; continue manually.");}finally{setLoading(false);}return;}
 if(!query.trim()){setMessage("Enter the complete registration number.");return;}
 setLoading(true);setMessage("");
 try{const response=await fetch("/api/vehicles/rc-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationNumber:query})});const data=await response.json();
 if(!response.ok){setMessage(data.error||"RC lookup failed.");return;}
 const d=data.details??data.review??{};setValues(p=>{const next: Record<string, string> = {...p,registrationNumber:query.toUpperCase()};for(const [k,v] of Object.entries(d)){if(v!==null&&v!==undefined&&typeof v!=="object"&&String(v).trim()){next[rcToQuoteField[k]??k]=String(v);}}return next;});setMessage(data.isStale ? "Cached RC details received (provider unavailable). Review and verify before requesting quotes." : "Available RC details received. Missing fields may not be supplied by the provider; review before quoting.");
 }catch{setMessage("Could not contact the RC lookup service. Enter details manually.");}finally{setLoading(false);}};
 if(preview) return <QuoteComparisonDemo values={values} selectedAddons={selected} onBack={()=>setPreview(false)}/>;
 return <div className="w-full space-y-2.5">
 <div className="space-y-2">
 <section className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
   <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#173965] text-white"><Truck className="h-3.5 w-3.5"/></span><h2 className="text-[13px] font-bold text-[#173965]">Vehicle identification</h2></div>
   <div className="flex items-center gap-1.5">
    <div role="group" aria-label="Vehicle registration status" className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
     <button type="button" title="Registered vehicle" aria-label="Registered vehicle" aria-pressed={mode==="registered"} onClick={()=>{setMode("registered");clearForm();}} className={`flex h-8 w-8 items-center justify-center rounded-md transition ${mode==="registered"?"bg-[#173965] text-white":"text-slate-500 hover:bg-blue-100 hover:text-blue-800"}`}><BadgeCheck className="h-4 w-4"/></button>
     <button type="button" title="Unregistered vehicle" aria-label="Unregistered vehicle" aria-pressed={mode==="unregistered"} onClick={()=>{setMode("unregistered");clearForm();}} className={`flex h-8 w-8 items-center justify-center rounded-md transition ${mode==="unregistered"?"bg-[#173965] text-white":"text-slate-500 hover:bg-blue-100 hover:text-blue-800"}`}><ScanLine className="h-4 w-4"/></button>
    </div>
    <button type="button" title="Clear form" aria-label="Clear form" onClick={clearForm} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><RotateCcw className="h-4 w-4"/></button>
   </div>
  </div>
  <div className="flex w-full max-w-[570px] items-stretch sm:max-w-[520px]">
   <div className="relative min-w-0 flex-1">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500"/>
    <input aria-label={mode==="registered"?"Vehicle registration number":"Vehicle chassis number"} autoComplete="off" value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter"&&!loading){e.preventDefault();void fetchVehicle();}}} placeholder={mode==="registered"?"Registration number":"Chassis number / VIN"} className="h-11 w-full rounded-l-lg border border-r-0 border-slate-300 bg-white pl-9 pr-3 text-[13px] font-bold uppercase tracking-wide text-[#173965] outline-none transition placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-inset focus:ring-blue-100"/>
   </div>
   <button type="button" title={mode==="registered"?"Fetch RC details":"Find chassis"} aria-label={mode==="registered"?"Fetch RC details":"Find chassis"} disabled={loading} onClick={fetchVehicle} className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-r-lg bg-[#173965] text-white transition hover:bg-blue-800 disabled:opacity-60">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<FileSearch className="h-4 w-4"/>}</button>
  </div>
  {message&&<p role="status" className={`mt-2 text-[11px] font-medium ${demo?"text-amber-700":"text-blue-700"}`}>{message}</p>}
 </section>
 <Section title="Vehicle details" subtitle="Essential information for quotation; additional fields available below" fields={primaryVehicle} values={values} onSet={set} open={!!open.vehicle} onToggle={()=>toggle("vehicle")}/>
 <Section title="Advanced RC details" subtitle="Optional specifications, fitness, pollution, tax and permit data" fields={advancedVehicle} values={values} onSet={set} open={!!open.vehicleAdvanced} onToggle={()=>toggle("vehicleAdvanced")}/>
 <Section title="Customer & proposer" subtitle="Owner, contact, KYC, communication address and tax identity" fields={customer} values={values} onSet={set} open={!!open.customer} onToggle={()=>toggle("customer")}/>
 <Section title="Quotation & previous insurance" subtitle="Coverage, insured value, prior policy, NCB and finance" fields={cover} values={values} onSet={set} open={!!open.cover} onToggle={()=>toggle("cover")}/>
 <Section title="Nominee, PA & liability" subtitle="Nomination and proposal-stage declarations" fields={nominee} values={values} onSet={set} open={!!open.nominee} onToggle={()=>toggle("nominee")}/>
 <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={()=>toggle("addons")} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left"><span><span className="block text-[12px] font-bold">Preferred add-ons</span><span className="text-[10px] text-slate-500">Selections are preferences; insurer eligibility will be checked later</span></span><ChevronDown className="h-4 w-4"/></button>{open.addons&&<div className="grid gap-1.5 p-3 sm:grid-cols-2 xl:grid-cols-4">{addons.map(a=><label key={a} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-2 text-[10px] text-slate-700"><input type="checkbox" checked={selected.includes(a)} onChange={e=>setSelected(p=>e.target.checked?[...p,a]:p.filter(t=>t!==a))}/>{a}</label>)}</div>}</section>
 <div className="flex justify-end py-2"><button type="button" onClick={()=>setPreview(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#173965] px-5 py-2.5 text-[12px] font-bold text-white">Next: Quote comparison preview <ArrowRight className="h-4 w-4"/></button></div>

 </div></div>;
}
