from pathlib import Path

path = Path("apps/web-portal/components/claim-manager/app-navigation.tsx")
text = path.read_text()

old = 'onClick={()=>setOpenSection(current=>current===section.key&&!active?null:section.key)}'
new = 'onClick={()=>setOpenSection(current=>current===section.key?null:section.key)}'

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly one active-section toggle guard, found {count}")

text = text.replace(old, new, 1)

if old in text:
    raise SystemExit("The active-section collapse guard is still present")
if text.count(new) != 1:
    raise SystemExit("Expected exactly one collapsible top-level section toggle")

path.write_text(text)
