import Link from "next/link";
import { requireCapability } from "@/lib/master-data-server";
import { loadRmReport } from "@/lib/rm-performance-pdf";
import type { RmPerformanceQuery } from "@/lib/rm-performance";
export const dynamic="force-dynamic";
export default async function ReportPage({searchParams}:{searchParams:Promise<RmPerformanceQuery>}){
  const profile=await requireCapability("view_reports");
  if(!profile)return null;
  const query=await searchParams;
  const {data}=await loadRmReport(profile,query);
  const qs=new URLSearchParams();
  for(const key of ["rm","period","from","to"] as const)if(query[key])qs.set(key,query[key]!);
  return <main className="min-h-screen bg-slate-100 p-4 md:p-8">
    <div className="mx-auto max-w-5xl rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><h1 className="text-xl font-bold text-[#17365D]">INSUREIT · RM Business Performance Report</h1><p className="text-sm text-slate-500">Today + {data.period.shortLabel} · {data.period.from} to {data.period.to}</p></div><Link href="/rm-performance" className="text-sm text-blue-700">Back to RM Performance</Link></div>
      <div className="mt-4 flex gap-3"><a className="rounded-lg bg-[#17365D] px-4 py-2 text-sm text-white" href={"/api/reports/rm-performance/pdf?"+qs}>Download PDF</a></div>
      <iframe title="RM performance report PDF" src={"/api/reports/rm-performance/pdf?"+qs} className="mt-4 h-[75vh] w-full rounded-lg border" />
    </div>
  </main>;
}
