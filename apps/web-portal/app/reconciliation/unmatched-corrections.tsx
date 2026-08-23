"use client";

import { useState, useTransition } from "react";
import { rematchReconciliationLine } from "./rematch-action";

type UnmatchedLine = { id: string; source_row_no: number; input_policy_no: string; match_status: string };

export function UnmatchedCorrections({ cycleId, cycleStatus, lines }: { cycleId: string; cycleStatus: string; lines: UnmatchedLine[] }) {
  const unmatched = lines.filter((line) => line.match_status === "Unmatched");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(unmatched.map((line) => [line.id, line.input_policy_no])));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = ["Submitted", "Under Review", "Reopened"].includes(cycleStatus);
  if (!unmatched.length) return null;

  function rematch(line: UnmatchedLine) {
    const policyNo = (values[line.id] ?? "").trim();
    if (!policyNo) { setMessage(`Enter a policy number for row ${line.source_row_no}.`); return; }
    startTransition(async () => {
      try {
        await rematchReconciliationLine({ cycleId, lineId: line.id, policyNo });
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Policy could not be rematched.");
      }
    });
  }

  return <section className="rounded-2xl border border-[#f4c7c3] bg-[#fff8f7] p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-[13px] font-semibold text-[#9f2d20]">Unmatched policy corrections</h2><p className="mt-1 text-[8.5px] text-[#7a4b45]">Correct a mistyped insurer policy number here. The server rematches it only against the cycle insurer and records the correction in the audit history.</p></div>{message?<span className="text-[8.5px] font-semibold text-[#b42318]">{message}</span>:null}</div>
    <div className="mt-3 space-y-2">{unmatched.map((line)=><div key={line.id} className="flex flex-col gap-2 rounded-xl border border-[#f0d8d5] bg-white p-3 sm:flex-row sm:items-center"><div className="w-16 text-[8px] font-bold uppercase tracking-[.06em] text-[#8b6b67]">Row {line.source_row_no}</div><input disabled={!editable||pending} className="h-9 flex-1 rounded-lg border border-[#d9c6c3] px-3 text-[10px] font-semibold uppercase text-[#26364f] outline-none focus:border-[#b65c50] disabled:bg-[#f5f5f5]" value={values[line.id]??""} onChange={(event)=>setValues((current)=>({...current,[line.id]:event.target.value.toUpperCase()}))}/><button disabled={!editable||pending} onClick={()=>rematch(line)} className="h-9 rounded-lg bg-[#9f2d20] px-4 text-[8.5px] font-bold text-white disabled:bg-[#b9aaa8]">Correct & rematch</button></div>)}</div>
  </section>;
}
