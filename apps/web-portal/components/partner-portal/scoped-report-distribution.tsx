"use client";
type Item = { label: string; value: number };
export function ScopedReportDistribution({ title, items }: { title: string; items: Item[] }) {
  const cleaned = items.map(item=>({...item,value:Math.max(0,Number(item.value)||0)}));
  const total = cleaned.reduce((sum,item)=>sum+item.value,0);
  const palette=["#1e5e9b","#3591c9","#6ab1d6","#96c6df","#c5dce9","#7199b8","#a4b5cd"];
  return <section className="ov-card ov-section">
    <div className="ov-section-head"><h2>{title}</h2><span className="text-[10px] font-semibold text-slate-500">Authorized scope</span></div>
    {!total?<div className="r2-empty">No records available for this reporting scope.</div>:<div className="grid gap-4 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-[175px] items-center justify-center">
        <div className="relative h-[160px] w-[160px] rounded-full" style={{background:`conic-gradient(${cleaned.reduce<{parts:string[];offset:number}>((state,item,index)=>{const next=state.offset+item.value/total*100;state.parts.push(`${palette[index%palette.length]} ${state.offset}% ${next}%`);state.offset=next;return state;},{parts:[],offset:0}).parts.join(", ")})`}}>
          <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-[10px] font-semibold text-slate-500">Total</span><strong className="text-lg text-slate-800">{new Intl.NumberFormat("en-IN").format(total)}</strong></div>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2">{cleaned.map((item,index)=><div key={item.label} className="flex items-center gap-2 border-b border-slate-100 pb-1.5 text-[11px]"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{background:palette[index%palette.length]}}/><span className="min-w-0 flex-1 text-slate-600">{item.label}</span><strong className="tabular-nums text-slate-800">{new Intl.NumberFormat("en-IN").format(item.value)}</strong><span className="w-10 text-right text-slate-500">{(item.value/total*100).toFixed(0)}%</span></div>)}</div>
    </div>}
  </section>;
}
