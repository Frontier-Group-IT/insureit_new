import type { ReactNode } from "react";

export function PartnerPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#DCE4ED] pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[8.5px] font-black uppercase tracking-[0.15em] text-[#74839A]">{eyebrow}</p> : null}
        <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.025em] text-[#142541] sm:text-[24px]">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-[10.5px] font-medium leading-5 text-[#71819A]">{description}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function PartnerSectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#7A899F]">{eyebrow}</p> : null}
        <h3 className="mt-0.5 text-[14px] font-extrabold tracking-[-0.01em] text-[#182A47] sm:text-[15px]">{title}</h3>
        {description ? <p className="mt-1 text-[10px] font-medium leading-4 text-[#7A899F]">{description}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function PartnerMetricStrip({
  items,
  columns = 4,
}: {
  items: Array<{ label: string; value: ReactNode; meta?: ReactNode }>;
  columns?: 3 | 4 | 5;
}) {
  const grid = columns === 5 ? "xl:grid-cols-5" : columns === 3 ? "lg:grid-cols-3" : "xl:grid-cols-4";
  return (
    <div className={"grid border-y border-[#DCE4ED] sm:grid-cols-2 " + grid}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={
            "min-w-0 px-1 py-3.5 sm:px-4 sm:py-4 " +
            (index > 0 ? "border-t border-[#E5EBF2] sm:border-l sm:border-t-0" : "") +
            (index === 2 && columns === 4 ? " sm:border-l-0 xl:border-l" : "")
          }
        >
          <p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#7A899F]">{item.label}</p>
          <div className="mt-1.5 truncate text-[18px] font-extrabold tracking-[-0.025em] text-[#162746] sm:text-[20px]">{item.value}</div>
          {item.meta ? <div className="mt-1 text-[9.5px] font-medium text-[#8794A7]">{item.meta}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function PartnerFlatSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"py-1 " + className}>{children}</section>;
}

export function PartnerDivider() {
  return <div className="h-px bg-[#DCE4ED]" />;
}
