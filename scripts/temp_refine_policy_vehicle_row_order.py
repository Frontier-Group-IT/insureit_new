from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

old = '''      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":undefined}>
        <div>
          <label className={labelClass}>Registration No. <Required/></label>
          <div className="flex">
            <input className={`${inputClass} min-w-0 rounded-r-none border-r-0 uppercase focus:z-10`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} aria-label={isLookingUp?"Fetching RC details":"Fetch RC details"} title={isLookingUp?"Fetching RC details":"Fetch RC details"} className="group grid h-10 w-11 shrink-0 place-items-center rounded-l-none rounded-r-xl border border-[#17365D] bg-[#17365D] text-white transition hover:bg-[#214A7A] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#A8B4C3] disabled:bg-[#A8B4C3] disabled:opacity-70">{isLookingUp?<RcFetchSpinner/>:<RcFetchIcon/>}</button>:null}
          </div>
          <CompactSourceMeta label="RC" value={isEdit?"Linked vehicle":appliedRc?"Verified & applied":isLookingUp?"Checking registration":"Not checked"} source={appliedRc?"Verified":isEdit?"Master":undefined}/>
          {lookupError?<p className="mt-1 text-[8.5px] font-semibold text-red-600">{lookupError}</p>:null}
        </div>
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div><Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required disabled={isEdit}/><CompactSourceMeta label="Classification" value={vehicleMeta?.description||"Select vehicle class"} source={vehicleMeta?"Auto":undefined}/></div>

        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled={isEdit}/>
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" disabled={isEdit}/>
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" disabled={isEdit}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:40},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" disabled={isEdit}/>

        <div><Field label="Capacity" value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/><CompactSourceMeta label="Basis" value={vehicleMeta?.capacityLabel||"Select vehicle class"} source={vehicleMeta?"Auto":undefined}/></div>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>
      </Section>'''

new = '''      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":undefined}>
        <div>
          <label className={labelClass}>Registration No. <Required/><RcStatusIcon state={lookupError?"error":isLookingUp?"checking":appliedRc||isEdit?"verified":"idle"}/></label>
          <div className="flex">
            <input className={`${inputClass} min-w-0 rounded-r-none border-r-0 uppercase focus:z-10`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} aria-label={isLookingUp?"Fetching RC details":"Fetch RC details"} title={isLookingUp?"Fetching RC details":"Fetch RC details"} className="group grid h-10 w-11 shrink-0 place-items-center rounded-l-none rounded-r-xl border border-[#17365D] bg-[#17365D] text-white transition hover:bg-[#214A7A] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#A8B4C3] disabled:bg-[#A8B4C3] disabled:opacity-70">{isLookingUp?<RcFetchSpinner/>:<RcFetchIcon/>}</button>:null}
          </div>
          {lookupError?<p className="mt-1 text-[8.5px] font-semibold text-red-600">{lookupError}</p>:null}
        </div>
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>

        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled={isEdit}/>
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" disabled={isEdit}/>
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" disabled={isEdit}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:40},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" disabled={isEdit}/>

        <div><Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required disabled={isEdit}/>{vehicleMeta?<p className="mt-1.5 px-0.5 text-[10px] font-semibold text-[#315B6B]">{vehicleMeta.description}</p>:null}</div>
        <Field label={vehicleMeta?`Capacity (${vehicleMeta.capacityLabel})`:"Capacity"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
      </Section>'''

if old not in text:
    raise SystemExit('Current Section 02 block not found')
text = text.replace(old, new)

anchor = 'function RcFetchSpinner(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px] animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>;}\n'
status = '''function RcFetchSpinner(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px] animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>;}\nfunction RcStatusIcon({state}:{state:"idle"|"checking"|"verified"|"error"}){const config={idle:{title:"RC not checked",className:"text-[#98A2B3]",node:<circle cx="12" cy="12" r="6"/>},checking:{title:"Checking RC",className:"animate-spin text-[#3B82F6]",node:<path d="M20 12a8 8 0 1 1-5.5-7.61"/>},verified:{title:"RC verified",className:"text-[#16A36A]",node:<><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>},error:{title:"RC verification error",className:"text-[#DC3545]",node:<><circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/></>}}[state];return <span className="inline-flex items-center" title={config.title} aria-label={config.title}><svg aria-hidden="true" viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${config.className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{config.node}</svg></span>;}\n'''
if anchor not in text:
    raise SystemExit('RC icon helper anchor not found')
text = text.replace(anchor, status, 1)

path.write_text(text, encoding='utf-8')
