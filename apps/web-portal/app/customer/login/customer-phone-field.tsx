"use client";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
};

function normalizeLocalMobile(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function CustomerPhoneField({
  id,
  value,
  onChange,
  disabled = false,
  autoComplete = "tel-national",
  placeholder = "Enter 10 digit number",
}: Props) {
  return (
    <div className={`flex h-12 overflow-hidden rounded-xl border border-[#CFD8E6] bg-white transition focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15 ${disabled ? "bg-slate-50" : ""}`}>
      <div className="flex min-w-[66px] items-center justify-center border-r border-[#D9E2EE] bg-[#F2F7FD] px-3 text-sm font-bold text-[#142746]">
        +91
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(normalizeLocalMobile(event.target.value))}
        disabled={disabled}
        maxLength={10}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#10213D] outline-none placeholder:text-[#A0AABD] disabled:cursor-not-allowed"
        required
      />
    </div>
  );
}

export function toIndianE164(value: string) {
  const digits = normalizeLocalMobile(value);
  return digits.length === 10 ? `+91${digits}` : "";
}
