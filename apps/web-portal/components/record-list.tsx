import type { ReactNode } from "react";
import { Card } from "./shell";
import { EmptyState } from "./ui";

export function DataError({ message }: { message?: string }) {
  return (
    <Card>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Unable to load records</p>
        <p className="mt-1 text-red-600">{message ?? "Please refresh the page or contact an administrator if the issue continues."}</p>
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
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Card>
    );
  }

  return (
    <Card className={compact ? "border-0 p-0 shadow-none" : ""}>
      <div className={`overflow-hidden border border-slate-200 ${compact ? "rounded-lg" : "rounded-2xl"}`}>
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[760px] text-left ${compact ? "text-[12px]" : "text-sm"}`}>
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
              <tr>{columns.map((column) => <th className={compact ? "px-2.5 py-1.5 text-[10px]" : "px-4 py-3 text-xs"} key={column.header}>{column.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, index) => <tr className="hover:bg-slate-50" key={index}>{columns.map((column) => <td className={compact ? "px-2.5 py-1.5 align-middle" : "px-4 py-4"} key={column.header}>{column.cell(row)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
