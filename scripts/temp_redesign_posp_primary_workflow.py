from pathlib import Path

path = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')
text = path.read_text()

text = text.replace('label="Save & return to documents" pendingLabel="Saving & opening documents…"', 'label={isMisp ? "Save & return to documents" : "Upload Documents"} pendingLabel={isMisp ? "Saving & opening documents…" : "Saving & opening documents…"}', 1)

start = '''        {showPrimary ? (\n          <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">'''
if start not in text:
    raise SystemExit('primary start marker not found')
text = text.replace(start, '''        {showPrimary ? (isMisp ? (\n          <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">''', 1)

end = '''            </div>\n          </section>\n        ) : null}\n\n        {showDocuments ?'''
if end not in text:
    raise SystemExit('primary end marker not found')
replacement = '''            </div>\n          </section>\n        ) : (\n          <PospPrimaryDetails\n            profile={profile}\n            editable={editable}\n            salesManagers={salesManagers}\n            banks={banks}\n            firstName={posFirstName}\n            middleName={posMiddleName}\n            lastName={posLastName}\n            onFirstNameChange={setPosFirstName}\n            onMiddleNameChange={setPosMiddleName}\n            onLastNameChange={setPosLastName}\n          />\n        )) : null}\n\n        {showDocuments ?'''
text = text.replace(end, replacement, 1)

marker = 'function PanField({ label, name, value, editable, recheck }:'
idx = text.find(marker)
if idx < 0:
    raise SystemExit('PanField marker not found')

component = r'''function PospPrimaryDetails({
  profile,
  editable,
  salesManagers,
  banks,
  firstName,
  middleName,
  lastName,
  onFirstNameChange,
  onMiddleNameChange,
  onLastNameChange,
}: {
  profile: PospMispEditProfile;
  editable: boolean;
  salesManagers: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
  firstName: string;
  middleName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onMiddleNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <CompactSectionHeader number="01" title="Identity & contact" />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <IndianDateField label="Documents received" name="document_received_at" defaultValue={profile.document_received_at} disabled={!editable} />
            <Select label="RM" name="associate_employee_id" defaultValue={profile.associate_employee_id ?? profile.associate_profile_id ?? ""} options={salesManagers} required disabled={!editable} />
            <div className="min-w-0 xl:col-span-3">
              <label className={labelClass}>Applicant name *</label>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#CBD5E1] bg-white transition focus-within:border-[#635BFF] focus-within:ring-2 focus-within:ring-[#E7E5FF]">
                <input aria-label="First name" name="pos_first_name" value={firstName} onChange={(event) => onFirstNameChange(event.target.value)} required pattern={namePattern} disabled={!editable} placeholder="First name" className="h-10 min-w-0 border-0 bg-transparent px-3 text-[11px] font-medium text-[#17203A] outline-none placeholder:text-[#94A3B8] disabled:bg-[#F8FAFC]" />
                <input aria-label="Middle name" name="pos_middle_name" value={middleName} onChange={(event) => onMiddleNameChange(event.target.value)} pattern={namePattern} disabled={!editable} placeholder="Middle name" className="h-10 min-w-0 border-x border-[#E2E8F0] bg-transparent px-3 text-[11px] font-medium text-[#17203A] outline-none placeholder:text-[#94A3B8] disabled:bg-[#F8FAFC]" />
                <input aria-label="Last name" name="pos_last_name" value={lastName} onChange={(event) => onLastNameChange(event.target.value)} required pattern={namePattern} disabled={!editable} placeholder="Last name" className="h-10 min-w-0 border-0 bg-transparent px-3 text-[11px] font-medium text-[#17203A] outline-none placeholder:text-[#94A3B8] disabled:bg-[#F8FAFC]" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <PanField label="PAN" name="pan_number" value={profile.pan_number ?? ""} editable={editable} recheck embeddedAction />
            <AadhaarReplacementField label="Aadhaar" lastFour={profile.aadhaar_last_four} hasExisting={profile.aadhaar_exists} disabled={!editable} embeddedAction />
            <IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} required disabled={!editable} />
            <Field label="Mobile" name="applicant_phone" defaultValue={profile.applicant_phone ?? ""} required inputMode="tel" pattern="(?:\\+91)?[6-9][0-9]{9}" disabled={!editable} />
            <Field label="Email" name="applicant_email" defaultValue={profile.applicant_email ?? ""} type="email" required disabled={!editable} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <CompactSectionHeader number="02" title="Address" />
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2"><Field label="Address" name="address" defaultValue={profile.address ?? ""} required disabled={!editable} /></div>
          <Field label="City" name="city" defaultValue={profile.city ?? ""} required disabled={!editable} />
          <Field label="State" name="state" defaultValue={profile.state ?? ""} required disabled={!editable} />
          <Field label="PIN" name="postal_code" defaultValue={profile.postal_code ?? ""} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} disabled={!editable} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <CompactSectionHeader number="03" title="Bank & tax" />
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Bank" name="bank_id" defaultValue={profile.bank_id ?? ""} options={banks} required disabled={!editable} />
          <Field label="Account No." name="bank_account_number" defaultValue={profile.bank_account_number ?? ""} required inputMode="numeric" pattern="[0-9]{6,20}" disabled={!editable} />
          <Field label="IFSC" name="bank_ifsc_code" defaultValue={profile.bank_ifsc_code ?? ""} required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} disabled={!editable} />
          <Field label="GST" name="gst_number" defaultValue={profile.gst_number ?? ""} maxLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} disabled={!editable} />
        </div>
      </section>
    </div>
  );
}

function CompactSectionHeader({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-3 border-b border-[#DCE5EF] bg-[#F8FAFC] px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h3 className="text-[12.5px] font-semibold text-[#17203A]">{title}</h3></div>;
}

'''
text = text[:idx] + component + text[idx:]

old_pan = r'''function PanField({ label, name, value, editable, recheck }: { label: string; name: string; value: string; editable: boolean; recheck: boolean }) { const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label} *</label><div className="flex gap-2"><input id={name} name={name} defaultValue={value} required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={!editable} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} className={`${inputClass} flex-1 font-mono`} />{recheck ? <button type="submit" data-skip-validation="true" formAction={retryPospMispPanVerification} className="h-10 w-10 rounded-xl border bg-[#EEF2FF]">↻</button> : null}</div><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; }'''
new_pan = r'''function PanField({ label, name, value, editable, recheck, embeddedAction = false }: { label: string; name: string; value: string; editable: boolean; recheck: boolean; embeddedAction?: boolean }) { const errorId = inlineFieldErrorId(name); if (embeddedAction && recheck) return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label} *</label><div className="grid grid-cols-[minmax(0,7fr)_44px] overflow-hidden rounded-xl border border-[#CBD5E1] bg-white transition focus-within:border-[#635BFF] focus-within:ring-2 focus-within:ring-[#E7E5FF]"><input id={name} name={name} defaultValue={value} required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={!editable} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} className="h-10 min-w-0 border-0 bg-transparent px-3 font-mono text-[11px] font-medium text-[#17203A] outline-none disabled:bg-[#F8FAFC]" /><button type="submit" data-skip-validation="true" formAction={retryPospMispPanVerification} disabled={!editable} title="Recheck PAN" aria-label="Recheck PAN" className="grid h-10 place-items-center border-l border-[#E2E8F0] bg-[#F8FAFC] text-[#49617C] transition hover:bg-[#EEF4FA] hover:text-[#17365D] disabled:cursor-not-allowed disabled:opacity-45"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg></button></div><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label} *</label><div className="flex gap-2"><input id={name} name={name} defaultValue={value} required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={!editable} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} className={`${inputClass} flex-1 font-mono`} />{recheck ? <button type="submit" data-skip-validation="true" formAction={retryPospMispPanVerification} className="h-10 w-10 rounded-xl border bg-[#EEF2FF]">↻</button> : null}</div><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; }'''
if old_pan not in text:
    raise SystemExit('PanField exact target not found')
text = text.replace(old_pan, new_pan, 1)

old_aadhaar = r'''function AadhaarReplacementField({ label, lastFour, hasExisting, disabled }: { label: string; lastFour: string | null; hasExisting: boolean; disabled: boolean }) { const masked = lastFour ? `•••• •••• ${lastFour}` : "Aadhaar stored securely"; const name = "aadhaar_number"; const errorId = inlineFieldErrorId(name); return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{hasExisting ? `Replace ${label}` : label}{hasExisting ? "" : " *"}</label>{hasExisting ? <p className="mb-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[10px] font-semibold tracking-[.08em] text-emerald-800">On file: {masked}</p> : null}<input id={name} name={name} defaultValue="" required={!hasExisting} maxLength={12} minLength={hasExisting ? undefined : 12} pattern="[0-9]{12}" inputMode="numeric" autoComplete="off" placeholder={hasExisting ? "Enter 12 digits only to replace" : "Enter 12-digit Aadhaar"} disabled={disabled} className={`${inputClass} font-mono`} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" />{hasExisting ? <p className="mt-1 text-[8.5px] text-[#64748B]">Leave blank to keep the current Aadhaar.</p> : null}</div>; }'''
new_aadhaar = r'''function AadhaarReplacementField({ label, lastFour, hasExisting, disabled, embeddedAction = false }: { label: string; lastFour: string | null; hasExisting: boolean; disabled: boolean; embeddedAction?: boolean }) { const [replacing, setReplacing] = useState(!hasExisting); const masked = lastFour ? `•••• •••• ${lastFour}` : "Aadhaar stored securely"; const name = "aadhaar_number"; const errorId = inlineFieldErrorId(name); if (embeddedAction && hasExisting) return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label} *</label>{!replacing ? <><input type="hidden" name={name} value="" /><div className="grid grid-cols-[minmax(0,7fr)_44px] overflow-hidden rounded-xl border border-[#CBD5E1] bg-white"><div className="flex h-10 min-w-0 items-center px-3 font-mono text-[10.5px] font-semibold tracking-[.08em] text-[#35516F]">{masked}</div><button type="button" disabled={disabled} onClick={() => setReplacing(true)} title="Replace Aadhaar" aria-label="Replace Aadhaar" className="grid h-10 place-items-center border-l border-[#E2E8F0] bg-[#F8FAFC] text-[#49617C] transition hover:bg-[#EEF4FA] hover:text-[#17365D] disabled:cursor-not-allowed disabled:opacity-45"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></div></> : <div className="grid grid-cols-[minmax(0,7fr)_44px] overflow-hidden rounded-xl border border-[#CBD5E1] bg-white transition focus-within:border-[#635BFF] focus-within:ring-2 focus-within:ring-[#E7E5FF]"><input id={name} name={name} defaultValue="" maxLength={12} minLength={12} pattern="[0-9]{12}" inputMode="numeric" autoComplete="off" placeholder="Enter 12-digit Aadhaar" disabled={disabled} className="h-10 min-w-0 border-0 bg-transparent px-3 font-mono text-[11px] font-medium text-[#17203A] outline-none placeholder:text-[#94A3B8] disabled:bg-[#F8FAFC]" /><button type="button" onClick={() => setReplacing(false)} title="Keep existing Aadhaar" aria-label="Keep existing Aadhaar" className="grid h-10 place-items-center border-l border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#17365D]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>}<p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" /></div>; return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{hasExisting ? `Replace ${label}` : label}{hasExisting ? "" : " *"}</label>{hasExisting ? <p className="mb-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[10px] font-semibold tracking-[.08em] text-emerald-800">On file: {masked}</p> : null}<input id={name} name={name} defaultValue="" required={!hasExisting} maxLength={12} minLength={hasExisting ? undefined : 12} pattern="[0-9]{12}" inputMode="numeric" autoComplete="off" placeholder={hasExisting ? "Enter 12 digits only to replace" : "Enter 12-digit Aadhaar"} disabled={disabled} className={`${inputClass} font-mono`} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold normal-case tracking-normal text-red-600" />{hasExisting ? <p className="mt-1 text-[8.5px] text-[#64748B]">Leave blank to keep the current Aadhaar.</p> : null}</div>; }'''
if old_aadhaar not in text:
    raise SystemExit('Aadhaar exact target not found')
text = text.replace(old_aadhaar, new_aadhaar, 1)

path.write_text(text)
