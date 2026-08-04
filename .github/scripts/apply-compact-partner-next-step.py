from pathlib import Path

page = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
text = page.read_text()

old_header_action = '''                ) : <CompactLink href={`/intermediaries/applications/${id}/workflow?stage=documents`} label="Continue documents" />'''
new_header_action = '''                ) : null'''

old_next_step = '''          {!activePartner && isPartner ? <Card title="Next step"><p className="text-[10.5px] font-medium text-[#475569]">Complete PAN verification and mandatory documents to activate this Partner.</p><div className="mt-3"><CompactLink href={`/intermediaries/applications/${id}/workflow?stage=documents`} label="Continue documents" /></div></Card> : null}'''
new_next_step = '''          {!activePartner && isPartner ? (
            <section className="overflow-hidden rounded-2xl border border-[#C7D2FE] bg-gradient-to-r from-[#EEF2FF] via-white to-[#EFF6FF] shadow-[0_12px_28px_rgba(79,70,229,.10)]">
              <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#4F46E5] text-white shadow-[0_8px_18px_rgba(79,70,229,.22)]"><Icon name="documents" className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[12.5px] font-semibold text-[#17203A]">Partner documents pending</h2>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[.05em] text-amber-700">Action required</span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-medium text-[#64748B]">Upload Aadhaar, PAN and bank proof to move this Partner to activation.</p>
                  </div>
                </div>
                <Link href={`/intermediaries/applications/${id}/workflow?stage=documents`} className={`${primaryActionClassName} h-9 shrink-0 rounded-xl px-4 text-[10px]`}>Complete documents</Link>
              </div>
            </section>
          ) : null}'''

for old, new, label in [
    (old_header_action, new_header_action, "header Continue documents action"),
    (old_next_step, new_next_step, "legacy Next step card"),
]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label}, found {count}")
    text = text.replace(old, new, 1)

if "Continue documents" in text:
    raise SystemExit("A Continue documents label remains on the application review page")
if "Partner documents pending" not in text or "Complete documents" not in text:
    raise SystemExit("Compact primary next-step section was not applied")

page.write_text(text)
