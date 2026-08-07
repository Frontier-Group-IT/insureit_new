from pathlib import Path

layout_path = Path("apps/web-portal/app/intermediaries/applications/[id]/layout.tsx")
page_path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
workflow_path = Path(".github/workflows/temp-fix-application-review-uploaded-documents.yml")
script_path = Path("scripts/temp_fix_application_review_uploaded_documents.py")

layout = layout_path.read_text()
layout = layout.replace('import { IntermediaryDocumentReviewPortal } from "@/components/intermediary-document-review-portal";\n', '')
layout = layout.replace('      <IntermediaryDocumentReviewPortal />\n', '')
layout_path.write_text(layout)

page = page_path.read_text()
old = '''function DocumentChecklist({ documents }: { documents: Document[] }) { const education = documents.find((document) => document.document_type.startsWith("education_")); const expected = [...partnerDocuments.filter(([type]) => !type.startsWith("education_")), ["education", "Education Marksheet"] as const]; return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{expected.map(([type, label]) => { const document = type === "education" ? education : documents.find((item) => item.document_type === type); if (!document) return null; return <DocumentStatus key={type} type={type} label={label} document={document} />; })}</div>; }'''
new = '''function DocumentChecklist({ documents }: { documents: Document[] }) {
  const education = documents.find((document) => document.document_type.startsWith("education_"));
  const ordered: Array<{ key: string; type: string; label: string; document: Document }> = [];
  const used = new Set<string>();
  const add = (key: string, type: string, label: string, document: Document | undefined) => {
    if (!document || used.has(document.id)) return;
    used.add(document.id);
    ordered.push({ key, type, label, document });
  };

  for (const [type, label] of partnerDocuments.filter(([type]) => !type.startsWith("education_"))) {
    add(type, type, label, documents.find((document) => document.document_type === type));
  }
  add("education", "education", "Education Marksheet", education);
  add(
    "signed_registration_form",
    "signed_registration_form",
    "Signed Registration Certificate",
    documents.find((document) => document.document_type === "signed_registration_form"),
  );

  documents
    .filter((document) => document.document_type.startsWith("custom_"))
    .forEach((document) => add(document.id, document.document_type, "Other Document", document));

  documents
    .filter((document) => !document.document_type.startsWith("education_") && !document.document_type.startsWith("custom_"))
    .forEach((document) => add(document.id, document.document_type, pretty(document.document_type), document));

  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{ordered.map((item) => <DocumentStatus key={item.key} type={item.type} label={item.label} document={item.document} />)}</div>;
}'''
if old not in page:
    raise SystemExit("DocumentChecklist source block not found")
page = page.replace(old, new)
page_path.write_text(page)

# Focused assertions: the review route no longer mounts the 10-slot portal, and the server list is uploaded-record driven.
assert "IntermediaryDocumentReviewPortal" not in layout_path.read_text()
updated = page_path.read_text()
assert '"Signed Registration Certificate"' in updated
assert 'document.document_type.startsWith("custom_")' in updated
assert 'ordered.map((item) => <DocumentStatus' in updated

script_path.unlink(missing_ok=True)
workflow_path.unlink(missing_ok=True)
