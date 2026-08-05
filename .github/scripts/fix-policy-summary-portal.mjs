import fs from "node:fs";

const path = "apps/web-portal/components/policy-form-authbridge.tsx";
let text = fs.readFileSync(path, "utf8");

const oldImport = 'import { useEffect, useMemo, useState, useTransition } from "react";';
const newImport = 'import { useEffect, useMemo, useRef, useState, useTransition } from "react";';
if (!text.includes(newImport)) {
  if (!text.includes(oldImport)) throw new Error("React import anchor not found");
  text = text.replace(oldImport, newImport);
}

const oldAside = '<aside className="xl:self-stretch"><div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm xl:fixed xl:right-4 xl:top-24 xl:z-30 xl:w-[300px] 2xl:right-[calc((100vw-1480px)/2)]"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="Net Premium" value={money.format(calculations.net)} bold/><SummaryRow label="GST" value={money.format(calculations.gst)}/><SummaryRow label="Gross Premium" value={money.format(calculations.gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(calculations.grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(calculations.payinAfterTds-calculations.grossPayout)} bold/></div></div></aside>';
const newAside = '<LiveSummary net={calculations.net} gst={calculations.gst} gross={calculations.gross} payinAfterTds={calculations.payinAfterTds} grossPayout={calculations.grossPayout}/>';
if (!text.includes(oldAside)) throw new Error("Current live summary markup not found");
text = text.replace(oldAside, newAside);

const marker = '\nfunction ModalShell(';
if (!text.includes(marker)) throw new Error("ModalShell marker not found");
const component = `
function LiveSummary({ net, gst, gross, payinAfterTds, grossPayout }: { net:number;gst:number;gross:number;payinAfterTds:number;grossPayout:number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left:number; width:number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (window.innerWidth < 1280 || !anchorRef.current) {
        setPosition(null);
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({ left: rect.left, width: rect.width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (anchorRef.current) observer.observe(anchorRef.current);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener("resize", updatePosition);
      observer.disconnect();
    };
  }, []);

  const card = <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="Net Premium" value={money.format(net)} bold/><SummaryRow label="GST" value={money.format(gst)}/><SummaryRow label="Gross Premium" value={money.format(gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(payinAfterTds-grossPayout)} bold/></div></div>;

  return <aside className="xl:self-stretch">
    <div className="xl:hidden">{card}</div>
    <div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true" />
    {position && typeof document !== "undefined" ? createPortal(
      <div className="fixed top-24 z-30" style={{ left: position.left, width: position.width }}>{card}</div>,
      document.body,
    ) : null}
  </aside>;
}
`;
text = text.replace(marker, `\n${component}${marker}`);
fs.writeFileSync(path, text);
