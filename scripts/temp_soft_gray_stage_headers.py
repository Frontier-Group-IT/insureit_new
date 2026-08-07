from pathlib import Path

branch_files = {
    "editor": Path("apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx"),
    "training": Path("apps/web-portal/app/intermediaries/applications/training-exam-stage.tsx"),
    "iib": Path("apps/web-portal/app/intermediaries/applications/iib-submission-stage.tsx"),
}

# Primary + Documents shared header.
p = branch_files["editor"]
s = p.read_text()
old = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b border-[#E2E8F0] !bg-white px-4 py-3 !text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF2F7] text-[9px] font-bold text-[#071D49]">{number}</span>'
new = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-4 py-3 text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span>'
assert old in s, "Primary/Documents header pattern not found"
s = s.replace(old, new, 1)
p.write_text(s)

# Registration + Training + Agreement shared process header.
p = branch_files["training"]
s = p.read_text()
old = '<div className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${state === "completed" ? "border-[#E5EAF0] bg-white" : "border-[#DCE5EF] bg-[#F8FAFC]"}`}>'
new = '<div className="flex items-center justify-between gap-4 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4">'
assert old in s, "ProcessSection header pattern not found"
s = s.replace(old, new, 1)
p.write_text(s)

# IIB Upload: use the same soft gray header in both pending and completed states.
p = branch_files["iib"]
s = p.read_text()
old_registered = '<header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">'
new_registered = '<header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4">'
old_default = '<header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F8FAFC] px-5 py-4">'
new_default = '<header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4">'
assert old_registered in s, "Registered IIB header pattern not found"
assert old_default in s, "Default IIB header pattern not found"
s = s.replace(old_registered, new_registered, 1).replace(old_default, new_default, 1)
p.write_text(s)

# Focused assertions.
editor = branch_files["editor"].read_text()
training = branch_files["training"].read_text()
iib = branch_files["iib"].read_text()
assert 'bg-[#F4F7FB]' in editor
assert 'bg-[#071D49] text-[9px] font-bold text-white' in editor
assert 'flex items-center justify-between gap-4 border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4' in training
assert iib.count('border-b border-[#DCE5EF] bg-[#F4F7FB] px-5 py-4') >= 2
print("Soft gray stage header patch assertions passed")
