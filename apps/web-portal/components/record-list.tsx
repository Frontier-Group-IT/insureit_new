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
  emptyDescription
}: {
  rows: T[];
  columns: Array<{ header: string; cell: (row: T) => ReactNode }>;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{columns.map((column) => <th className="px-4 py-3" key={column.header}>{column.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, index) => <tr className="hover:bg-slate-50" key={index}>{columns.map((column) => <td className="px-4 py-4" key={column.header}>{column.cell(row)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
