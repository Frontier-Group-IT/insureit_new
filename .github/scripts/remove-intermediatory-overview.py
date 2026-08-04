from pathlib import Path

path = Path("apps/web-portal/components/claim-manager/app-navigation.tsx")
text = path.read_text()
old = '  {href:"/intermediaries",label:"Overview",icon:UsersRound,capability:"view_intermediaries"},\n'
if text.count(old) != 1:
    raise SystemExit(f"Expected exactly one Intermediatory Overview menu entry, found {text.count(old)}")
text = text.replace(old, "", 1)
path.write_text(text)

updated = path.read_text()
if old.strip() in updated:
    raise SystemExit("Intermediatory Overview menu entry still exists")
if '{key:"distribution",label:"Intermediatory"' not in updated:
    raise SystemExit("Intermediatory section was unexpectedly changed")
