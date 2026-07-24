"use client";

import { useMemo, useState } from "react";
import { formatIndianDate, maskIndianDate, parseIndianDate } from "@/lib/indian-date";

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
};

export function IndianDateField({ label, name, defaultValue, required = false, disabled = false }: Props) {
  const [displayValue, setDisplayValue] = useState(() => formatIndianDate(defaultValue));
  const canonicalValue = useMemo(() => parseIndianDate(displayValue), [displayValue]);
  const invalid = Boolean(displayValue.length === 10 && !canonicalValue);

  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor={`${name}-display`}>
        {label}{required ? " *" : ""}
      </label>
      <input
        id={`${name}-display`}
        value={displayValue}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        required={required}
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        maxLength={10}
        aria-invalid={invalid}
        onChange={(event) => setDisplayValue(maskIndianDate(event.target.value))}
        className={`h-9 w-full rounded-md border bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:ring-2 ${
          invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-[#CBD5E1] focus:border-[#4F46E5] focus:ring-[#E0E7FF]"
        }`}
      />
      <input type="hidden" name={name} value={canonicalValue ?? ""} />
      {invalid ? <p className="mt-1 text-[9.5px] font-medium text-red-600">Enter a valid date in dd/mm/yyyy format.</p> : null}
    </div>
  );
}
