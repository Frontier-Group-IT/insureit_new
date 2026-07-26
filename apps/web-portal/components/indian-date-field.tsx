"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { normalizeImportedDate } from "@/lib/indian-date";

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
};

export function IndianDateField({ label, name, defaultValue, required = false, disabled = false }: Props) {
  const [value, setValue] = useState(() => normalizeImportedDate(defaultValue) ?? "");

  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor={`${name}-date`}>
        {label}{required ? " *" : ""}
      </label>
      <div className="relative">
        <input
          id={`${name}-date`}
          name={name}
          type="date"
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => setValue(event.target.value)}
          onClick={(event) => {
            const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
            input.showPicker?.();
          }}
          className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 pr-10 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
        />
        <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
      </div>
    </div>
  );
}
