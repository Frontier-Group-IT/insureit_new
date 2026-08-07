from pathlib import Path

component = Path("apps/web-portal/components/policy-form-authbridge.tsx")
text = component.read_text()

inline = '    {submitError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{submitError}</div> : null}\n'
if text.count(inline) != 1:
    raise SystemExit("Expected exactly one inline submit error banner")
text = text.replace(inline, "", 1)

modal_anchor = '    {rcReview ? <RcModal review={rcReview} groups={applyGroups} setGroups={setApplyGroups} onCancel={()=>setRcReview(null)} onUse={useRcDetails}/> : null}\n'
if text.count(modal_anchor) != 1:
    raise SystemExit("Expected exactly one policy modal render anchor")
text = text.replace(
    modal_anchor,
    '    {submitError ? <ValidationErrorDialog message={submitError} onClose={()=>setSubmitError(null)} /> : null}\n' + modal_anchor,
    1,
)

component_anchor = 'function ModalShell({ title, subtitle, onClose, children, footer }: { title:string;subtitle:string;onClose:()=>void;children:ReactNode;footer:ReactNode }) {'
if text.count(component_anchor) != 1:
    raise SystemExit("Expected exactly one ModalShell anchor")

dialog = '''function ValidationErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    okRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="policy-validation-title" aria-describedby="policy-validation-message">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(7,29,73,.42)]">
        <div className="px-6 pb-5 pt-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF3E8] text-[#D45B16] ring-8 ring-[#FFF8F2]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 2.7 17.1A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h2 id="policy-validation-title" className="mt-5 text-[17px] font-bold text-[#102A4C]">Please check the form</h2>
          <p id="policy-validation-message" className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#667085]">{message}</p>
        </div>
        <div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-6 py-4">
          <button ref={okRef} type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#102A4C] focus:outline-none focus:ring-2 focus:ring-[#315B9A] focus:ring-offset-2">OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

'''
text = text.replace(component_anchor, dialog + component_anchor, 1)

if 'submitError ? <div className="mb-4 rounded-xl border border-red-200' in text:
    raise SystemExit("Inline submit error banner still present")
for expected in (
    "ValidationErrorDialog message={submitError}",
    'role="alertdialog"',
    ">OK</button>",
):
    if expected not in text:
        raise SystemExit(f"Missing expected dialog marker: {expected}")

component.write_text(text)

Path("scripts/temp_policy_validation_error_dialog.py").unlink()
Path(".github/workflows/apply-policy-validation-error-dialog.yml").unlink()
