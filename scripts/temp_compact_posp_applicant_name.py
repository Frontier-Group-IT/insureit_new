from pathlib import Path

path = Path('apps/web-portal/app/customers/posp-misp/posp-misp-onboarding-form.tsx')
text = path.read_text()

old_group = '''                <div className="md:col-span-2 xl:col-span-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[10.5px] font-semibold text-[#344054]">Applicant name</span>
                    <span className="rounded-full bg-[#EAF1F8] px-2 py-0.5 text-[8.5px] font-semibold text-[#315B6B]">Same applicant</span>
                  </div>
                  <div className="grid min-w-0 gap-2 rounded-xl border border-[#D9E2F0] bg-[#F8FAFC] p-2.5 md:grid-cols-3">
                    <Field label="First Name" name="pos_first_name" required defaultValue={initialValues.pos_first_name} {...inputValidationHandlers} />
                    <Field label="Middle Name" name="pos_middle_name" defaultValue={initialValues.pos_middle_name} {...inputValidationHandlers} />
                    <Field label="Last Name" name="pos_last_name" required defaultValue={initialValues.pos_last_name} {...inputValidationHandlers} />
                  </div>
                </div>'''
new_group = '''                <div className="md:col-span-2 xl:col-span-3">
                  <label className={labelClass}>Applicant name *</label>
                  <div className="grid min-w-0 gap-2 md:grid-cols-3">
                    <Field label="First Name" name="pos_first_name" required hideLabel placeholder="First name" defaultValue={initialValues.pos_first_name} {...inputValidationHandlers} />
                    <Field label="Middle Name" name="pos_middle_name" hideLabel placeholder="Middle name" defaultValue={initialValues.pos_middle_name} {...inputValidationHandlers} />
                    <Field label="Last Name" name="pos_last_name" required hideLabel placeholder="Last name" defaultValue={initialValues.pos_last_name} {...inputValidationHandlers} />
                  </div>
                </div>'''
if old_group not in text:
    raise SystemExit('Applicant name group target not found')
text = text.replace(old_group, new_group, 1)

old_field = '''function Field({ label, name, required = false, transform, onInput, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; error?: string }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={inputClass} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\\s/g, ""); onInput?.(event); }} {...props} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}'''
new_field = '''function Field({ label, name, required = false, transform, onInput, error, hideLabel = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; error?: string; hideLabel?: boolean }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={hideLabel ? "sr-only" : labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={inputClass} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\\s/g, ""); onInput?.(event); }} {...props} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}'''
if old_field not in text:
    raise SystemExit('Field helper target not found')
text = text.replace(old_field, new_field, 1)

path.write_text(text)
