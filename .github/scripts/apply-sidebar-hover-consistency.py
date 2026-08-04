from pathlib import Path

path = Path("apps/web-portal/components/claim-manager/app-navigation.tsx")
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match, found {count}: {old[:180]!r}")
    text = text.replace(old, new, 1)


replace_once(
    'className={`group mb-2 flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold ${activeNav==="dashboard"&&!routeSection?"bg-white text-[#141d3b] shadow-[0_14px_35px_rgba(0,0,0,.18)]":"text-white/90 hover:bg-white/10 hover:text-white"}`}',
    'className={`group mb-2 flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${activeNav==="dashboard"&&!routeSection?"bg-white text-[#141d3b] shadow-[0_14px_35px_rgba(0,0,0,.18)] hover:bg-white":"text-white/90 hover:bg-white/10 hover:text-white"}`}',
)
replace_once(
    'className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#66B5FF] via-[#2F6BFF] to-[#1746C8] text-white"',
    'className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#66B5FF] via-[#2F6BFF] to-[#1746C8] text-white transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"',
)
replace_once(
    'className="flex h-11 w-full items-center gap-3 px-3.5 text-left text-[12px] font-bold text-white"',
    'className="group flex h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-[12px] font-bold text-white transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:bg-white/10 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"',
)
replace_once(
    'className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${section.tint}`}',
    'className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105 ${section.tint}`}',
)
replace_once(
    'className={`h-4 w-4 ${open?"rotate-90":""}`}',
    'className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:translate-x-0.5 ${open?"rotate-90":""}`}',
)
replace_once(
    'className="group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold text-white/88 hover:bg-white/10"',
    'className="group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold text-white/88 transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:bg-white/10 hover:text-white hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"',
)
replace_once(
    'className="grid h-8 w-8 place-items-center rounded-xl bg-white/10"',
    'className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"',
)
replace_once(
    'className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-semibold ${active?"bg-white/12 text-white":"text-white/82 hover:bg-white/10"}`}',
    'className={`group flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-semibold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${active?"bg-white/12 text-white hover:bg-white/[0.16]":"text-white/82 hover:bg-white/10 hover:text-white"}`}',
)
replace_once(
    '<Icon className="h-3.5 w-3.5"/>',
    '<Icon className="h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105"/>',
)
replace_once(
    'className={`h-3.5 w-3.5 ${open?"rotate-90":""}`}',
    'className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:translate-x-0.5 ${open?"rotate-90":""}`}',
)
replace_once(
    'className={`group flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-semibold ${active?"bg-white text-[#17213e]":"text-white/82 hover:bg-white/10 hover:text-white"}`}',
    'className={`group flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-semibold transition-all duration-200 ease-out motion-reduce:transform-none hover:translate-x-0.5 hover:shadow-[0_8px_20px_rgba(4,10,28,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${active?"bg-white text-[#17213e] hover:bg-white":"text-white/82 hover:bg-white/10 hover:text-white"}`}',
)
replace_once(
    'className={`h-3.5 w-3.5 ${active?"text-[#6759ff]":"text-white/60"}`}',
    'className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transform-none group-hover:scale-105 ${active?"text-[#6759ff]":"text-white/60"}`}',
)

if text.count("hover:translate-x-0.5") < 6:
    raise SystemExit("Expected the shared hover motion on every sidebar interaction level")
if 'label:"Overview"' in text:
    raise SystemExit("The removed Intermediatory Overview item must not be restored")

path.write_text(text)
