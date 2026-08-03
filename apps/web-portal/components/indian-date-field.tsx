"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { inlineFieldErrorId } from "@/components/inline-field-validation";
import { normalizeImportedDate } from "@/lib/indian-date";

type Props = {
  label?: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
};

const defaultInputClassName = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 pr-10 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";

export function IndianDateField({ label, name, defaultValue, required = false, disabled = false, inputClassName }: Props) {
  const [value, setValue] = useState(() => normalizeImportedDate(defaultValue) ?? "");
  const errorId = inlineFieldErrorId(name);

  return (
    <div data-field-container>
      {label ? (
        <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor={`${name}-date`}>
          {label}{required ? " *" : ""}
        </label>
      ) : null}
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
          className={inputClassName ?? defaultInputClassName}
        />
        <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
      </div>
      <p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold text-red-600" />
    </div>
  );
}
