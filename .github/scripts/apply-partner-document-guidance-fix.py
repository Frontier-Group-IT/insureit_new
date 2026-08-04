from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
text = path.read_text()
old = "Upload Aadhaar, PAN and bank proof to move this Partner to activation."
new = "Upload Aadhaar, PAN, bank proof and photograph. Add the GST certificate when the Partner is GST-registered."
if text.count(old) != 1:
    raise SystemExit(f"Expected exactly one guidance line, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
