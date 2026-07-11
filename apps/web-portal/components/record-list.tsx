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
      <div className={`overflow-hidden border border-slate-200 ${compact ? "rounded-xl" : "rounded-2xl"}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{columns.map((column) => <th className={compact ? "px-3 py-2.5" : "px-4 py-3"} key={column.header}>{column.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, index) => <tr className="hover:bg-slate-50" key={index}>{columns.map((column) => <td className={compact ? "px-3 py-2.5 align-middle" : "px-4 py-4"} key={column.header}>{column.cell(row)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
