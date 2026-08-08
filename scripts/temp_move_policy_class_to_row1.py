from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

old_first = '''        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>

        <Field label="Make"'''

new_first = '''        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div>
          <label className={labelClass}>Class <Required/>{vehicleMeta?<span className="ml-1 truncate text-[8.5px] font-semibold normal-case tracking-normal text-[#315B6B]">{vehicleMeta.description}</span>:null}</label>
          <select className={inputClass} value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} required disabled={isEdit}><option value="">Select class</option>{Object.keys(vehicleClassMap).map(option=><option key={option} value={option}>{option}</option>)}</select>
        </div>

        <Field label="Make"'''

if old_first not in text:
    raise SystemExit('Row 1 block not found')
text = text.replace(old_first, new_first, 1)

old_third = '''        <div><Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required disabled={isEdit}/>{vehicleMeta?<p className="mt-1.5 px-0.5 text-[10px] font-semibold text-[#315B6B]">{vehicleMeta.description}</p>:null}</div>
        <Field label={vehicleMeta?`Capacity (${vehicleMeta.capacityLabel})`:"Capacity"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
'''

new_third = '''        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>
        <Field label={vehicleMeta?`Capacity (${vehicleMeta.capacityLabel})`:"Capacity"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
'''

if old_third not in text:
    raise SystemExit('Row 3 class block not found')
text = text.replace(old_third, new_third, 1)

path.write_text(text, encoding='utf-8')
