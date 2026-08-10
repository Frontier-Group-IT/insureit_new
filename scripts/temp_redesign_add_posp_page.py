from pathlib import Path

path = Path('apps/web-portal/app/customers/posp-misp/posp-misp-onboarding-form.tsx')
text = path.read_text(encoding='utf-8')
anchor = '  return <>\n    <div className="w-full space-y-3 pb-20">\n'
if anchor not in text:
    raise SystemExit('POSP/MISP form return anchor not found')

modern = '''  if (!isMisp && !legacyFields) {
    return <>
      <div className="w-full pb-24">
        {visibleError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{visibleError}</div> : null}
        <form ref={formRef} action={submitPath ?? formAction} method={submitPath ? "post" : undefined} onSubmitCapture={submitPath ? handleRouteSubmit : handleSubmit} onInvalidCapture={submitPath ? undefined : handleInvalid} data-posp-misp-onboarding-form="true" data-validation-mode={submitPath ? "route-post-native-v7" : "action-inline-v6"} className="w-full">
          <input type="hidden" name="partner_type" value={partnerType} />

          <header className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-[18px] font-semibold">POSP Onboarding</h1>
              <div className="flex items-center gap-2">
                <Link href="/customers/posp-misp/import" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[9.5px] font-semibold text-white transition hover:bg-white/15">Import Excel</Link>
                <Link href={backHref} className="rounded-lg border border-white/20 px-3 py-2 text-[9.5px] font-semibold text-white/90 transition hover:bg-white/10">Back</Link>
              </div>
            </div>
          </header>

          <nav className="sticky top-[66px] z-30 mb-4 grid grid-cols-3 overflow-hidden rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur" aria-label="POSP onboarding sections">
            <PospNavItem href="#posp-section-1" number="01" label="Identity & contact" />
            <PospNavItem href="#posp-section-2" number="02" label="Address" />
            <PospNavItem href="#posp-section-3" number="03" label="Bank & tax" last />
          </nav>

          <div className="space-y-4">
            <PospSection id="posp-section-1" number="01" title="Identity & contact">
              <SelectField label="RM" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" defaultValue={initialValues.associate_employee_id} {...selectValidationHandlers} />
              <PanInput label="PAN" name="pan_number" compact defaultValue={initialValues.pan_number} {...inputValidationHandlers} />
              <IndianDateField label="Documents received" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} {...dateValidationHandlers} />
              <Field label="Aadhaar" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} {...inputValidationHandlers} />

              <Field label="First Name" name="pos_first_name" required defaultValue={initialValues.pos_first_name} {...inputValidationHandlers} />
              <Field label="Middle Name" name="pos_middle_name" defaultValue={initialValues.pos_middle_name} {...inputValidationHandlers} />
              <Field label="Last Name" name="pos_last_name" required defaultValue={initialValues.pos_last_name} {...inputValidationHandlers} />
              <IndianDateField label="Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} {...dateValidationHandlers} />

              <Field label="Mobile" name="applicant_phone" required inputMode="tel" pattern="(?:\\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} {...inputValidationHandlers} />
              <div className="md:col-span-1 xl:col-span-3"><Field label="Email" name="applicant_email" type="email" required defaultValue={initialValues.applicant_email} {...inputValidationHandlers} /></div>
            </PospSection>

            <PospSection id="posp-section-2" number="02" title="Address">
              <div className="md:col-span-2 xl:col-span-4"><Field label="Address" name="address" required defaultValue={initialValues.address} {...inputValidationHandlers} /></div>
              <Field label="City" name="city" required defaultValue={initialValues.city} {...inputValidationHandlers} />
              <Field label="State" name="state" required defaultValue={initialValues.state} {...inputValidationHandlers} />
              <Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} {...inputValidationHandlers} />
            </PospSection>

            <PospSection id="posp-section-3" number="03" title="Bank & tax">
              <SelectField label="Bank" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} {...selectValidationHandlers} />
              <Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} {...inputValidationHandlers} />
              <Field label="IFSC" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} {...inputValidationHandlers} />
              <Field label="GST Number" name="gst_number" maxLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} {...inputValidationHandlers} />
            </PospSection>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur">
            <div className="mx-auto flex max-w-[1480px] justify-end gap-2">
              {submitPath ? <>
                <RouteSubmitButton intent="exit" activeIntent={routeSubmitIntent} label="Save & Exit" pendingLabel="Saving & exiting…" secondary />
                <RouteSubmitButton intent="documents" activeIntent={routeSubmitIntent} label="Save & Continue" pendingLabel="Saving & opening documents…" />
              </> : <>
                <FormSubmitButton name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" className="rounded-xl border border-[#CBD5E1] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
                <FormSubmitButton name="submit_intent" value="documents" label="Save & Continue" pendingLabel="Saving & opening documents…" className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#102A49]" />
              </>}
            </div>
          </div>
        </form>
      </div>
    </>;
  }

'''
text = text.replace(anchor, modern + anchor, 1)

helper_anchor = 'function RouteSubmitButton('
helpers = '''function PospNavItem({ href, number, label, last = false }: { href:string; number:string; label:string; last?:boolean }) {
  return <a href={href} className={`flex min-w-0 items-center justify-center gap-2 px-3 py-2.5 text-[9.5px] font-semibold text-[#526277] transition hover:bg-[#F7F9FC] hover:text-[#17365D] ${last ? "" : "border-r border-[#E4EAF1]"}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EEF3F8] text-[8px] font-bold text-[#315B6B]">{number}</span><span className="truncate">{label}</span></a>;
}

function PospSection({ id, number, title, children }: { id:string; number:string; title:string; children:React.ReactNode }) {
  return <section id={id} className="scroll-mt-[132px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-12 items-center border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-2.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2></div></div><div className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

'''
if helper_anchor not in text:
    raise SystemExit('RouteSubmitButton helper anchor not found')
text = text.replace(helper_anchor, helpers + helper_anchor, 1)

path.write_text(text, encoding='utf-8')
