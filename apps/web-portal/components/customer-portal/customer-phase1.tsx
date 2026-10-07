import Link from "next/link";
import { Building2 } from "lucide-react";
import type { CustomerWebAccount } from "@/lib/customer-web";

function accountLabel(account: CustomerWebAccount) {
  return account.customer_name?.trim() || account.contact_name?.trim() || "Customer account";
}

export function CustomerAccountTabs({
  accounts,
  selectedId,
  pathname,
}: {
  accounts: CustomerWebAccount[];
  selectedId: string;
  pathname: string;
}) {
  if (accounts.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#70809A]">
        <Building2 className="h-3.5 w-3.5" /> Account
      </span>
      {accounts.map((account) => {
        const active = account.id === selectedId;
        return (
          <Link
            key={account.id}
            href={{ pathname, query: { account: account.id } }}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              active
                ? "border-[#142746] bg-[#142746] text-white"
                : "border-[#D8E1EC] bg-white text-[#53627A] hover:border-[#AAB9CD] hover:text-[#142746]"
            }`}
          >
            {accountLabel(account)}
          </Link>
        );
      })}
    </div>
  );
}

export function CustomerPageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C7E99]">{eyebrow}</p>
        <h1 className="mt-1 text-[24px] font-black tracking-[-0.02em] text-[#10213D]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[12px] font-medium text-[#6B7890]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#7B899F]">{label}</p>
      <p className="mt-1 text-[25px] font-black tracking-[-0.03em] text-[#10213D]">{value}</p>
      {helper ? <p className="mt-1 text-[10.5px] font-semibold text-[#7B899F]">{helper}</p> : null}
    </div>
  );
}

export function EmptyCustomerState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C9D5E3] bg-white px-5 py-10 text-center">
      <p className="text-sm font-black text-[#142746]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[11px] font-medium leading-5 text-[#718096]">{body}</p>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "active" | "due" | "expired" | "neutral"; children: React.ReactNode }) {
  const style =
    tone === "active"
      ? "border-[#C8EAD9] bg-[#ECF8F2] text-[#0B7A54]"
      : tone === "due"
        ? "border-[#F0D9AA] bg-[#FFF7E8] text-[#9B6718]"
        : tone === "expired"
          ? "border-[#F1CCCC] bg-[#FFF0F0] text-[#C53232]"
          : "border-[#DCE4EE] bg-[#F5F8FC] text-[#607089]";
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${style}`}>{children}</span>;
}
