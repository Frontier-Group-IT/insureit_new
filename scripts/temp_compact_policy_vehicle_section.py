from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
start_marker = '      <Section number="02" title="Insured & vehicle identification"'
end_marker = '      <Section number="03"'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Section 02/03 boundary not found')

new_block = r'''      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":"Verify the registration, then review and apply approved RC details."} badge={isEdit?"Linked master · read-only":"AuthBridge API"}>
        <div>
          <label className={labelClass}>Registration number <Required/><Tag text={isEdit?"Master":"AuthBridge"} tone={isEdit?"green":"amber"}/></label>
          <div className="flex gap-2">
            <input className={`${inputClass} min-w-0 uppercase`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} className="shrink-0 rounded-xl bg-[#17365D] px-3 text-[9px] font-bold text-white disabled:opacity-40">{isLookingUp?"Fetching…":"Fetch RC"}</button>:null}
          </div>
          <CompactSourceMeta label="RC" value={isEdit?"Linked vehicle":appliedRc?"Verified & applied":isLookingUp?"Checking registration":"Not checked"} source={appliedRc?"Verified":isEdit?"Master":undefined}/>
          {lookupError?<p className="mt-1 text-[8.5px] font-semibold text-red-600">{lookupError}</p>:null}
        </div>
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div><Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required disabled={isEdit}/><CompactSourceMeta label="Classification" value={vehicleMeta?.description||"Select vehicle class"} source={vehicleMeta?"Auto":undefined}/></div>

        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled={isEdit}/>
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" disabled={isEdit}/>
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" disabled={isEdit}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:40},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" disabled={isEdit}/>

        <div><Field label="Capacity" value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/><CompactSourceMeta label="Basis" value={vehicleMeta?.capacityLabel||"Select vehicle class"} source={vehicleMeta?"Auto":undefined}/></div>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>
      </Section>

'''
text = text[:start] + new_block + text[end:]
path.write_text(text, encoding='utf-8')
