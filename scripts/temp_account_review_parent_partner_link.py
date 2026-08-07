from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
text = path.read_text()

old = '''  const linked = (related ?? []).find((row) => {\n    const context = asObject(row.draft_data).account_context;\n    return context === "posp" || context === "misp";\n  }) ?? null;\n'''
new = '''  const linked = (related ?? []).find((row) => {\n    const context = asObject(row.draft_data).account_context;\n    return context === "posp" || context === "misp";\n  }) ?? null;\n  const parentApplication = !isPartner\n    ? (related ?? []).find((row) => {\n        const context = asObject(row.draft_data).account_context;\n        return context !== "posp" && context !== "misp";\n      }) ?? null\n    : null;\n'''
assert old in text, 'linked application block not found'
text = text.replace(old, new, 1)

old = '''        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending" },\n'''
new = '''        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },\n'''
assert old in text, 'Parent Partner stat not found'
text = text.replace(old, new, 1)

old = '''function HeaderStat({ icon, label, value }: { icon: IconName; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p><p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p></div></div>; }\n'''
new = '''function HeaderStat({ icon, label, value, href }: { icon: IconName; label: string; value: string; href?: string }) { return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href ? <Link href={href} className="mt-1 block truncate text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>}</div></div>; }\n'''
assert old in text, 'HeaderStat function not found'
text = text.replace(old, new, 1)

path.write_text(text)
