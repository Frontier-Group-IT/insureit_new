"use client";
import { useState } from "react";
import { ChevronDown, FileSearch, Info, Loader2, Search, Truck } from "lucide-react";

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

const defaults:Record<string,string>={businessType:"New business",coverageType:"Package (OD + TP)",claims:"No",ownerPa:"Yes",nomineeShare:"100"};
function Section({title,subtitle,fields,values,onSet,open,onToggle}:{title:string;subtitle:string;fields:Field[];values:Record<string,string>;onSet:(k:string,v:string)=>void;open:boolean;onToggle:()=>void}) {
 return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
 <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"><span><span className="block text-[12px] font-bold text-slate-800">{title}</span><span className="block text-[10px] text-slate-500">{subtitle}</span></span><ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open?"rotate-180":""}`}/></button>
 {open&&<div className="grid gap-x-2 gap-y-2 p-3 sm:grid-cols-2 xl:grid-cols-4">{fields.map(f=><label key={f.key} className="min-w-0"><span className="mb-1 block truncate text-[11px] font-bold text-[#183d6b]">{f.label}</span>{dropdowns[f.key] ? <select aria-label={f.label} value={values[f.key]??""} onChange={e=>onSet(f.key,e.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-[12px] font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"><option value="">Select {f.label.toLowerCase()}</option>{values[f.key] && !dropdowns[f.key].includes(values[f.key]) && <option value={values[f.key]}>{values[f.key]} (fetched / custom)</option>}{dropdowns[f.key].map(option=><option key={option} value={option}>{option}</option>)}</select> : <input aria-label={f.label} type={dateFields.has(f.key)?"date":numericFields.has(f.key)?"number":"text"} value={values[f.key]??""} onChange={e=>onSet(f.key,e.target.value)} placeholder={f.placeholder??"Enter / verify"} className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-[12px] font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:bg-white" />}</label>)}</div>}
 </section>;
}
export default function QuoteBookWorkspace(){
 const [mode,setMode]=useState<"registered"|"unregistered">("registered");
 const [query,setQuery]=useState(""); const [values,setValues]=useState<Record<string,string>>(defaults);
 const [open,setOpen]=useState<Record<string,boolean>>({vehicle:true,customer:true,cover:true,nominee:false,addons:true,vehicleAdvanced:false});
 const [selected,setSelected]=useState<string[]>([]); const [loading,setLoading]=useState(false); const [message,setMessage]=useState("");
 const set=(k:string,v:string)=>setValues(p=>({...p,[k]:v}));
 const toggle=(k:string)=>setOpen(p=>({...p,[k]:!p[k]}));
 const fetchVehicle=async()=>{if(mode!=="registered"){set("chassisNumber",query.trim().toUpperCase());setMessage("Unregistered vehicle: complete specifications using dealer invoice and customer documents.");return;}
 if(!query.trim()){setMessage("Enter the complete registration number.");return;}
 setLoading(true);setMessage("");
 try{const response=await fetch("/api/vehicles/rc-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationNumber:query})});const data=await response.json();
 if(!response.ok){setMessage(data.error||"RC lookup failed.");return;}
 const d=data.details??data.review??{};setValues(p=>{const next: Record<string, string> = {...p,registrationNumber:query.toUpperCase()};for(const [k,v] of Object.entries(d)){if(v!==null&&v!==undefined&&typeof v!=="object"&&String(v).trim()){next[rcToQuoteField[k]??k]=String(v);}}return next;});setMessage(data.isStale ? "Cached RC details received (provider unavailable). Review and verify before requesting quotes." : "Available RC details received. Missing fields may not be supplied by the provider; review before quoting.");
 }catch{setMessage("Could not contact the RC lookup service. Enter details manually.");}finally{setLoading(false);}};
 return <div className="w-full space-y-2.5">
 <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><div><h1 className="text-[16px] font-bold tracking-tight text-slate-900">Quote & Book <span className="ml-1 rounded-md bg-indigo-50 px-2 py-1 align-middle text-[9px] font-bold text-indigo-700">DEVELOPMENT</span></h1><p className="mt-0.5 text-[10px] text-slate-500">Vehicle → Customer → Coverage → Compare → Proposal → Pay & Issue</p></div><span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800"><Info className="h-3 w-3"/> Quotation & payment APIs not connected</span></div>
 <div className="space-y-2">
 <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><span className="rounded-lg bg-blue-50 p-2"><Truck className="h-4 w-4 text-blue-700"/></span><div><span className="block text-[13px] font-bold text-slate-900">Vehicle identification</span><span className="block text-[10px] text-slate-500">Fetch registered RC details or enter a chassis number for a new vehicle</span></div></div><div role="group" aria-label="Vehicle registration status" className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">{(["registered","unregistered"] as const).map(v=><button type="button" key={v} onClick={()=>{setMode(v);setQuery("");setMessage("");}} className={`rounded-full px-4 py-1.5 text-[11px] font-bold capitalize transition-colors ${mode===v?"bg-[#173965] text-white shadow-sm":"text-slate-600 hover:text-blue-800"}`}>{v}</button>)}</div></div>
 <div className="flex max-w-[720px] flex-wrap items-center gap-2"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input aria-label={mode==="registered"?"Vehicle registration number":"Vehicle chassis number"} value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} placeholder={mode==="registered"?"Enter registration number e.g. MP20AB1234":"Enter chassis / VIN"} className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 text-[12px] font-semibold text-slate-900 uppercase outline-none focus:border-blue-500"/></div><button type="button" disabled={loading} onClick={fetchVehicle} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#173965] px-4 text-[11px] font-bold text-white disabled:opacity-60">{loading?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<FileSearch className="h-3.5 w-3.5"/>}{mode==="registered"?"Fetch RC details":"Use chassis"}</button></div>{message&&<p role="status" className="mt-2 text-[10px] text-blue-700">{message}</p>}</section>
 <Section title="Vehicle details" subtitle="Essential information for quotation; additional fields available below" fields={primaryVehicle} values={values} onSet={set} open={!!open.vehicle} onToggle={()=>toggle("vehicle")}/>
 <Section title="Advanced RC details" subtitle="Optional specifications, fitness, pollution, tax and permit data" fields={advancedVehicle} values={values} onSet={set} open={!!open.vehicleAdvanced} onToggle={()=>toggle("vehicleAdvanced")}/>
 <Section title="Customer & proposer" subtitle="Owner, contact, KYC, communication address and tax identity" fields={customer} values={values} onSet={set} open={!!open.customer} onToggle={()=>toggle("customer")}/>
 <Section title="Quotation & previous insurance" subtitle="Coverage, insured value, prior policy, NCB and finance" fields={cover} values={values} onSet={set} open={!!open.cover} onToggle={()=>toggle("cover")}/>
 <Section title="Nominee, PA & liability" subtitle="Nomination and proposal-stage declarations" fields={nominee} values={values} onSet={set} open={!!open.nominee} onToggle={()=>toggle("nominee")}/>
 <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={()=>toggle("addons")} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left"><span><span className="block text-[12px] font-bold">Preferred add-ons</span><span className="text-[10px] text-slate-500">Selections are preferences; insurer eligibility will be checked later</span></span><ChevronDown className="h-4 w-4"/></button>{open.addons&&<div className="grid gap-1.5 p-3 sm:grid-cols-2 xl:grid-cols-4">{addons.map(a=><label key={a} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-2 text-[10px] text-slate-700"><input type="checkbox" checked={selected.includes(a)} onChange={e=>setSelected(p=>e.target.checked?[...p,a]:p.filter(t=>t!==a))}/>{a}</label>)}</div>}</section>
 </div></div>;
}
