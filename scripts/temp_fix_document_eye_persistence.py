from pathlib import Path

grid_path = Path('apps/web-portal/components/intermediary-document-grid.tsx')
workflow_path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')

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

workflow = workflow_path.read_text()
subtitle = 'Ten compact slots are shown. GST uses an available Other Document slot when applicable.'
if subtitle not in workflow:
    raise SystemExit('documents subtitle not found')
workflow = workflow.replace(subtitle, '', 1)
workflow = workflow.replace('<p className="mt-0.5 text-[9px] font-medium text-[#64748B]"></p>', '', 1)
workflow = workflow.replace('<p className="mt-0.5 text-[9.5px] font-medium text-[#64748B]"></p>', '', 1)
workflow_path.write_text(workflow)

assert 'setResolvedDocuments((current) => nextDocuments.map' in grid_path.read_text()
assert 'previousDocument?.href ? { ...nextDocument, href: previousDocument.href } : nextDocument' in grid_path.read_text()
assert 'action={(existingDocument || (editable' in grid_path.read_text()
assert subtitle not in workflow_path.read_text()
