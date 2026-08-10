from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
text = path.read_text()

old_stats = '''        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal user status", value: activePartner ? portalLabel(intermediary?.portal_access_status) : "Available after activation" },
        { icon: "calendar" as IconName, label: "Activation Date", value: date(activationDate) },
      ]
    : [
        { icon: "account" as IconName, label: "Account Type", value: accountType },
        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal user status", value: portalLabel(intermediary?.portal_access_status) },
        { icon: "calendar" as IconName, label: "Activation Date", value: accountActivated ? date(intermediary?.activated_at) : "-" },
      ];'''
new_stats = '''        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: activePartner ? portalAccessLabel(intermediary?.portal_access_status) : "Available after activation", portalAction: activePartner ? portalAccessAction(intermediary?.portal_access_status) : undefined, intermediaryId: activePartner ? intermediary?.id : undefined, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: date(activationDate) },
      ]
    : [
        { icon: "account" as IconName, label: "Account Type", value: accountType },
        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: portalAccessLabel(intermediary?.portal_access_status), portalAction: portalAccessAction(intermediary?.portal_access_status), intermediaryId: intermediary?.id, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: accountActivated ? date(intermediary?.activated_at) : "-" },
      ];'''
if old_stats not in text:
    raise SystemExit('Expected portal stats block not found')
text = text.replace(old_stats, new_stats, 1)

old_header = '''function HeaderStat({ icon, label, value, href, showViewIcon = false }: { icon: IconName; label: string; value: string; href?: string; showViewIcon?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{href ? <Link href={href} className="mt-1 block truncate text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>}</div></div>;
}'''
new_header = '''type PortalAccessAction = "create_user" | "resend_link";
function HeaderStat({ icon, label, value, href, showViewIcon = false, portalAction, intermediaryId, returnPath }: { icon: IconName; label: string; value: string; href?: string; showViewIcon?: boolean; portalAction?: PortalAccessAction; intermediaryId?: string; returnPath?: string }) {
  const portalActionNode = portalAction && intermediaryId && returnPath ? (
    <form action={portalAction === "create_user" ? createIntermediaryPortalLogin : resendIntermediaryPortalInvite} className="mt-1">
      <input type="hidden" name="intermediary_id" value={intermediaryId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <FormSubmitButton label={value} pendingLabel={portalAction === "create_user" ? "Creating…" : "Sending…"} className="h-auto min-h-0 p-0 text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline" />
    </form>
  ) : null;
  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{portalActionNode ?? (href ? <Link href={href} className="mt-1 block truncate text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>)}</div></div>;
}'''
if old_header not in text:
    raise SystemExit('Expected HeaderStat block not found')
text = text.replace(old_header, new_header, 1)

old_helper = '''function portalLabel(value: string | undefined) { if (value === "invited") return "Portal User Invited"; if (value === "active") return "Portal User Active"; if (value === "suspended") return "Portal User Suspended"; return "Portal User Not Created"; }'''
new_helper = '''function portalLabel(value: string | undefined) { if (value === "invited") return "Portal User Invited"; if (value === "active") return "Portal User Active"; if (value === "suspended") return "Portal User Suspended"; return "Portal User Not Created"; }
function portalAccessLabel(value: string | undefined) { if (value === "not_created" || !value) return "Create User"; if (value === "invited") return "Resend Link"; if (value === "active") return "Active"; if (value === "suspended") return "Suspended"; return pretty(value); }
function portalAccessAction(value: string | undefined): PortalAccessAction | undefined { if (value === "not_created" || !value) return "create_user"; if (value === "invited") return "resend_link"; return undefined; }'''
if old_helper not in text:
    raise SystemExit('Expected portalLabel helper not found')
text = text.replace(old_helper, new_helper, 1)

path.write_text(text)
