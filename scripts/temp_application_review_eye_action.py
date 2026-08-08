from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
text = path.read_text()

text = text.replace(
    'import { compactLightActionClassName, primaryActionClassName, secondaryActionClassName } from "@/components/action-styles";',
    'import { compactLightActionClassName, primaryActionClassName } from "@/components/action-styles";',
)

old = '''async function DocumentStatus({ type, label, document }: { type: string; label: string; document?: Document }) { const admin = createSupabaseAdminClient(); const { data } = document ? await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 900) : { data: null }; return <DocumentVisualCard type={type} title={label} fileName={document?.file_name} required={type !== "photograph" && type !== "education"} tone={document ? "uploaded" : type === "photograph" || type === "education" ? "optional" : "required"} status={document ? "Uploaded" : type === "photograph" || type === "education" ? "Optional" : "Missing"} meta={document ? date(document.created_at) : "Awaiting upload"} compact action={document && data?.signedUrl ? <a href={data.signedUrl} target="_blank" rel="noreferrer" className={`${secondaryActionClassName} h-8 rounded-lg px-3 text-[9px]`}>Open</a> : null} />; }'''
new = '''async function DocumentStatus({ type, label, document }: { type: string; label: string; document?: Document }) {
  const admin = createSupabaseAdminClient();
  const { data } = document ? await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 900) : { data: null };
  return <DocumentVisualCard type={type} title={label} fileName={document?.file_name} required={type !== "photograph" && type !== "education"} tone={document ? "uploaded" : type === "photograph" || type === "education" ? "optional" : "required"} status={document ? "Uploaded" : type === "photograph" || type === "education" ? "Optional" : "Missing"} meta={document ? date(document.created_at) : "Awaiting upload"} compact action={document && data?.signedUrl ? <a href={data.signedUrl} target="_blank" rel="noreferrer" aria-label={`View ${label}`} title={`View ${label}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7DDF0] bg-white text-[#0F2A55] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition hover:border-[#B8C7DE] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7D2FE]"><EyeIcon /></a> : null} />;
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}'''

if old not in text:
    raise SystemExit("DocumentStatus target not found")
text = text.replace(old, new)

path.write_text(text)
