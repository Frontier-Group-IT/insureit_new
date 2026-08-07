from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/structured-account-register.tsx')
text = path.read_text()

old = '''  const partnerMap = new Map((partners ?? []).map((partner) => [partner.id, partner.partner_code]));
  const registrationMap = new Map((registrations ?? []).map((registration) => [registration.id, registration.registration_code]));
'''
new = '''  const partnerMap = new Map((partners ?? []).map((partner) => [partner.id, partner.partner_code]));
  const registrationMap = new Map((registrations ?? []).map((registration) => [registration.id, registration.registration_code]));
  const { data: partnerApplications } = partnerIds.length
    ? await admin
        .from("intermediary_onboarding_applications")
        .select("id,draft_data,partner_record_id")
        .in("partner_record_id", partnerIds)
        .returns<Array<Pick<ApplicationRow, "id" | "draft_data" | "partner_record_id">>>()
    : { data: [] as Array<Pick<ApplicationRow, "id" | "draft_data" | "partner_record_id">> };
  const partnerApplicationMap = new Map<string, string>();
  for (const partnerApplication of partnerApplications ?? []) {
    const context = partnerApplication.draft_data?.account_context;
    if (!partnerApplication.partner_record_id || context === "posp" || context === "misp") continue;
    if (!partnerApplicationMap.has(partnerApplication.partner_record_id)) {
      partnerApplicationMap.set(partnerApplication.partner_record_id, partnerApplication.id);
    }
  }
'''
assert old in text, 'partner map anchor not found'
text = text.replace(old, new, 1)

old = '''                  const partnerId = app?.partner_record_id ? partnerMap.get(app.partner_record_id) : null;
                  const registrationCode = app?.registration_record_id ? registrationMap.get(app.registration_record_id) : null;
'''
new = '''                  const partnerId = app?.partner_record_id ? partnerMap.get(app.partner_record_id) : null;
                  const partnerApplicationId = app?.partner_record_id ? partnerApplicationMap.get(app.partner_record_id) : null;
                  const registrationCode = app?.registration_record_id ? registrationMap.get(app.registration_record_id) : null;
'''
assert old in text, 'row partner anchor not found'
text = text.replace(old, new, 1)

old = '''                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={partnerId ?? "Partner ID pending"}>{partnerId ?? "Partner ID pending"}</td>
'''
new = '''                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={partnerId ?? "Partner ID pending"}>{partnerId && partnerApplicationId ? <FreshAccountReviewLink href={`/intermediaries/applications/${partnerApplicationId}`} className="font-semibold text-[#0F2A55] transition hover:text-[#315FEA] hover:underline hover:underline-offset-2">{partnerId}</FreshAccountReviewLink> : partnerId ?? "Partner ID pending"}</td>
'''
assert old in text, 'parent partner cell anchor not found'
text = text.replace(old, new, 1)

path.write_text(text)
