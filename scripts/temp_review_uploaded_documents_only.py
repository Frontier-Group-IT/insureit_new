from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
text = path.read_text()
old = '''function DocumentChecklist({ documents }: { documents: Document[] }) { const education = documents.find((document) => document.document_type.startsWith("education_")); const expected = [...partnerDocuments.filter(([type]) => !type.startsWith("education_")), ["education", "Education Marksheet"] as const]; return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{expected.map(([type, label]) => { const document = type === "education" ? education : documents.find((item) => item.document_type === type); return <DocumentStatus key={type} type={type} label={label} document={document} />; })}</div>; }'''
new = '''function DocumentChecklist({ documents }: { documents: Document[] }) { const education = documents.find((document) => document.document_type.startsWith("education_")); const expected = [...partnerDocuments.filter(([type]) => !type.startsWith("education_")), ["education", "Education Marksheet"] as const]; return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{expected.map(([type, label]) => { const document = type === "education" ? education : documents.find((item) => item.document_type === type); if (!document) return null; return <DocumentStatus key={type} type={type} label={label} document={document} />; })}</div>; }'''
if old not in text:
    raise SystemExit("DocumentChecklist target not found")
path.write_text(text.replace(old, new, 1))
