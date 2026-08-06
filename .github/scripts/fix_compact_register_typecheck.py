from pathlib import Path

p = Path('apps/web-portal/app/intermediaries/intermediary-register.tsx')
s = p.read_text()
s = s.replace(' className="font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline" title={row.display_name}', ' className="font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline"', 1)
p.write_text(s)
