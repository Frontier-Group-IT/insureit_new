from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
text = path.read_text()

replacements = [
('''    : [
        { icon: "account" as IconName, label: "Account Type", value: accountType },
        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: portalAccessLabel(intermediary?.portal_access_status), portalAction: portalAccessAction(intermediary?.portal_access_status), intermediaryId: intermediary?.id, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: accountActivated ? date(intermediary?.activated_at) : "-" },
      ];''', '''    : [
        { icon: "account" as IconName, label: "Account Type", value: accountType },
        { icon: "id" as IconName, label: "Account Status", value: intermediary?.account_status ? pretty(intermediary.account_status) : "Under Onboarding" },
        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: portalAccessLabel(intermediary?.portal_access_status), portalAction: portalAccessAction(intermediary?.portal_access_status), intermediaryId: intermediary?.id, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: accountActivated ? date(intermediary?.activated_at) : "-" },
      ];'''),
('''          <div className={`grid border-t border-white/15 sm:grid-cols-2 ${isPartner ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>{stats.map((stat) => <HeaderStat key={stat.label} {...stat} />)}</div>''', '''          <div className="grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{stats.map((stat) => <HeaderStat key={stat.label} {...stat} />)}</div>'''),
('''    <form action={portalAction === "create_user" ? createIntermediaryPortalLogin : resendIntermediaryPortalInvite} className="mt-1">''', '''    <form action={portalAction === "create_user" ? createIntermediaryPortalLogin : resendIntermediaryPortalInvite} className="mt-0.5 leading-none">'''),
('''      <FormSubmitButton label={value} pendingLabel={portalAction === "create_user" ? "Creating…" : "Sending…"} className="h-auto min-h-0 p-0 text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline" />''', '''      <FormSubmitButton label={value} pendingLabel={portalAction === "create_user" ? "Creating…" : "Sending…"} className="h-auto min-h-0 p-0 text-[10.5px] font-semibold leading-[1.15] text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline" />'''),
('''  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{portalActionNode ?? (href ? <Link href={href} className="mt-1 block truncate text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>)}</div></div>;''', '''  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-[8px] font-semibold uppercase leading-none tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{portalActionNode ?? (href ? <Link href={href} className="mt-0.5 block truncate text-[10.5px] font-semibold leading-[1.15] text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-0.5 truncate text-[10.5px] font-semibold leading-[1.15] text-white">{value}</p>)}</div></div>;''')
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'expected block not found: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
