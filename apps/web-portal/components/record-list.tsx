import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Card } from "./shell";
import { EmptyState } from "./ui";

export function DataError({ message }: { message?: string }) {
  return (
    <Card className="overflow-hidden border-red-100 bg-red-50/75 p-0">
      <div className="flex items-start gap-3 px-5 py-4 text-red-700">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle className="h-4 w-4" /></span>
        <div><p className="text-[12px] font-semibold">Unable to load records</p><p className="mt-1 text-[10.5px] leading-5 text-red-600">{message ?? "Please refresh the page or contact an administrator if the issue continues."}</p></div>
      </div>
    </Card>
  );
}

export function DataTable<T>({
  rows,
  columns,
  emptyTitle,
  emptyDescription,
  compact = false
}: {
  rows: T[];
  columns: Array<{ header: string; cell: (row: T) => ReactNode }>;
  emptyTitle: string;
  emptyDescription?: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card className={compact ? "border-0 p-0 shadow-none" : ""}>
        <EmptyState title={emptyTitle} description={emptyDescription} icon={<Inbox className="h-5 w-5" />} />
      </Card>
    );
  }

  return (
    <Card className={compact ? "border-0 p-0 shadow-none" : "p-0"}>
      <div className={`ui-table-shell overflow-hidden border border-white/80 bg-white/72 ${compact ? "rounded-2xl" : "rounded-[22px]"}`}>
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[760px] text-left ${compact ? "text-[11px]" : "text-[11.5px]"}`}>
            <thead className="sticky top-0 z-10 border-b border-[#E7E8F3] bg-[#F7F8FF]/95 uppercase tracking-[0.08em] text-[#77809A] backdrop-blur-xl">
              <tr>{columns.map((column) => <th className={compact ? "px-3 py-2.5 text-[8.5px]" : "px-4 py-3 text-[9px]"} key={column.header}>{column.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0F6] bg-white/75">
              {rows.map((row, index) => <tr className="group transition duration-200 hover:bg-[#F6F4FF]" key={index}>{columns.map((column) => <td className={compact ? "px-3 py-2.5 align-middle" : "px-4 py-3.5"} key={column.header}>{column.cell(row)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
