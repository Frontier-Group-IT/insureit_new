from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
text = path.read_text()
old = '''function HeaderStat({ icon, label, value, href, showViewIcon = false }: { icon: IconName; label: string; value: string; href?: string; showViewIcon?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href ? <Link href={href} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline"><span className="truncate">{value}</span>{showViewIcon ? <><EyeIcon /><span className="sr-only">View {label} application</span></> : null}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>}</div></div>;
}'''
new = '''function HeaderStat({ icon, label, value, href, showViewIcon = false }: { icon: IconName; label: string; value: string; href?: string; showViewIcon?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{href ? <Link href={href} className="mt-1 block truncate text-[10.5px] font-semibold text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>}</div></div>;
}'''
if old not in text:
    raise SystemExit('Expected HeaderStat block not found; refusing to patch')
path.write_text(text.replace(old, new, 1))
