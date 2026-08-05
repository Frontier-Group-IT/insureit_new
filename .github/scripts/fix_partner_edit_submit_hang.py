from pathlib import Path

path = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')
text = path.read_text()

text = text.replace(
    ' forcePending={submittingIntent === "exit"} onSubmitStart={() => setSubmittingIntent("exit")}',
    ' forcePending={submittingIntent === "exit"}',
    1,
)
text = text.replace(
    ' forcePending={submittingIntent === "documents"} onSubmitStart={() => setSubmittingIntent("documents")}',
    ' forcePending={submittingIntent === "documents"}',
    1,
)

marker = '''  useEffect(() => {
    setActionTarget(actionTargetId ? document.getElementById(actionTargetId) : null);
  }, [actionTargetId]);
'''
addition = marker + '''
  useEffect(() => {
    if (!submittingIntent) return;
    const timeout = window.setTimeout(() => setSubmittingIntent(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [submittingIntent]);
'''

if marker not in text:
    raise SystemExit('Action target effect not found')
if 'onSubmitStart={() => setSubmittingIntent("exit")}' not in path.read_text():
    raise SystemExit('Expected premature exit trigger not found')

text = text.replace(marker, addition, 1)
path.write_text(text)
