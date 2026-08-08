from pathlib import Path

grid_path = Path('apps/web-portal/components/intermediary-document-grid.tsx')
editor_path = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')

grid = grid_path.read_text()
old = '''      .then((payload) => {
        if (cancelled) return;
        const nextDocuments = payload.documents ?? [];
        setResolvedDocuments(nextDocuments);
        setResolvedLegacy(payload.legacy === true);'''
new = '''      .then((payload) => {
        if (cancelled) return;
        const nextDocuments = payload.documents ?? [];
        setResolvedDocuments((current) => nextDocuments.map((nextDocument) => {
          if (nextDocument.href) return nextDocument;
          const previousDocument = current.find((document) =>
            document.document_type === nextDocument.document_type
            && document.file_name === nextDocument.file_name,
          );
          return previousDocument?.href ? { ...nextDocument, href: previousDocument.href } : nextDocument;
        }));
        setResolvedLegacy(payload.legacy === true);'''
if old not in grid:
    raise SystemExit('context refresh block not found')
grid = grid.replace(old, new, 1)

old = '''              action={(existingDocument?.href || (editable && (slot.system ? Boolean(existingDocument) : true))) ? (
                <div className="flex items-center gap-1.5">
                  {existingDocument?.href ? (
                    <a
                      href={existingDocument.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${title}`}
                      title="View"
                      className={compactActionClass}
                    >
                      <EyeIcon />
                    </a>
                  ) : null}'''
new = '''              action={(existingDocument || (editable && (slot.system ? Boolean(existingDocument) : true))) ? (
                <div className="flex items-center gap-1.5">
                  {existingDocument ? (
                    existingDocument.href ? (
                      <a
                        href={existingDocument.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${title}`}
                        title="View"
                        className={compactActionClass}
                      >
                        <EyeIcon />
                      </a>
                    ) : (
                      <span
                        aria-label={`View ${title}`}
                        title="View"
                        className={compactActionClass}
                      >
                        <EyeIcon />
                      </span>
                    )
                  ) : null}'''
if old not in grid:
    raise SystemExit('eye action block not found')
grid = grid.replace(old, new, 1)
grid_path.write_text(grid)

editor = editor_path.read_text()
old = '<Header number="2" title="Documents" subtitle="Ten compact slots are shown. GST uses an available Other Document slot when applicable." />'
new = '<Header number="2" title="Documents" />'
if old not in editor:
    raise SystemExit('documents header subtitle not found')
editor = editor.replace(old, new, 1)
old = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-4 py-3 text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p></div></div>; }'
new = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) { return <div className="flex items-start gap-3 border-b border-[#DCE5EF] bg-[#F4F7FB] px-4 py-3 text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3>{subtitle ? <p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p> : null}</div></div>; }'
if old not in editor:
    raise SystemExit('Header component signature not found')
editor = editor.replace(old, new, 1)
editor_path.write_text(editor)

assert 'setResolvedDocuments((current) => nextDocuments.map' in grid_path.read_text()
assert 'previousDocument?.href ? { ...nextDocument, href: previousDocument.href } : nextDocument' in grid_path.read_text()
assert 'action={(existingDocument || (editable' in grid_path.read_text()
assert 'Ten compact slots are shown. GST uses an available Other Document slot when applicable.' not in editor_path.read_text()
assert '<Header number="2" title="Documents" />' in editor_path.read_text()
