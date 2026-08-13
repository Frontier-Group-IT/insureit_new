"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ReportRegisterEnhancer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => enhanceReportTables());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchParams]);

  return null;
}

function enhanceReportTables() {
  const tables = document.querySelectorAll<HTMLTableElement>(".report-page-shell table");

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map((cell) =>
      (cell.textContent ?? "").trim()
    );
    if (!headers.length) return;

    const wrapper = table.parentElement;
    const isWide = Boolean(wrapper && table.scrollWidth > wrapper.clientWidth + 8);
    table.classList.toggle("report-mobile-card-table", isWide);

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        cell.dataset.reportLabel = headers[index] || "Value";
      });
    });
  });
}
