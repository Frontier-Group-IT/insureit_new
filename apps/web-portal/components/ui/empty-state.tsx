import { ArrowRight } from "lucide-react";
import { VisualAsset } from "./visual-asset";

type EmptyStateProps = {
  title: string;
  description?: string;
  visual?: string;
  visualAlt?: string;
  actionLabel?: string;
  action?: React.ReactNode;
  compact?: boolean;
};

export function EmptyState({
  title,
  description,
  visual,
  visualAlt,
  actionLabel,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <section className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-6" : "px-6 py-10"}`}>
      {visual ? (
        <VisualAsset
          type="image"
          src={visual}
          label={visualAlt ?? title}
          className={compact ? "h-20 w-20" : "h-28 w-28"}
          sizes={compact ? "80px" : "112px"}
        />
      ) : null}
      <h3 className={`${visual ? "mt-4" : ""} text-[13px] font-semibold text-slate-900`}>{title}</h3>
      {description ? <p className="mt-1 max-w-md text-[10.5px] leading-5 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : actionLabel ? (
        <span className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-indigo-600">
          {actionLabel}
          <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
        </span>
      ) : null}
    </section>
  );
}
