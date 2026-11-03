import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const filters = readFileSync(new URL("../app/rm-performance/rm-performance-filters.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../components/reports/report-date-range-picker.tsx", import.meta.url), "utf8");
assert.match(filters, /<div className="relative shrink-0">/, "Period dropdown must anchor calendar without taking layout space");
assert.match(filters, /period\.key === "custom" \? \([\s\S]*?aria-label="Open custom date range calendar"/, "Calendar icon appears for Custom only");
assert.match(filters, /<ReportDateRangePicker[\s\S]*?hideTrigger[\s\S]*?align="left"/, "Use the triggerless shared calendar below Custom");
assert.match(filters, /<select\s+aria-label="Filter by time period"/, "Dropdown remains operable for MTD and Last Month");
assert.match(filters, /appearance-none/, "Single fixed-width period control with native menu");
assert.match(filters, /onRangeComplete=\{\(from, to\) => \{[\s\S]*?params\.set\("from", from\)[\s\S]*?params\.set\("to", to\)/, "Complete range auto-applies URL filters");
assert.match(calendar, /document\.addEventListener\("mousedown", onPointerDown\)/, "Outside click closes the calendar");
assert.match(calendar, /if \(event\.key === "Escape"\) setOpen\(false\)/, "Escape closes the calendar");
assert.match(calendar, /if \(rangeStart && !rangeEnd\)/, "Calendar waits for both range boundaries");
console.log("RM Performance inline custom calendar regression passed.");
