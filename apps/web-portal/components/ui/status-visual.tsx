import { CheckCircle2, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import { VisualAsset } from "./visual-asset";

type StatusTone = "neutral" | "pending" | "success" | "warning" | "error";

type StatusVisualProps = {
  title: string;
  description?: string;
  tone?: StatusTone;
  visual?: string;
  visualAlt?: string;
  compact?: boolean;
  action?: React.ReactNode;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  pending: "border-blue-200 bg-blue-50/60 text-blue-800",
  success: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/60 text-amber-900",
  error: "border-red-200 bg-red-50/60 text-red-800",
};

const toneIcons = {
  neutral: Clock3,
  pending: LoaderCircle,
  success: CheckCircle2,
  warning: CircleAlert,
  error: CircleAlert,
} as const;

export function StatusVisual({
  title,
  description,
  tone = "neutral",
  visual,
  visualAlt,
  compact = false,
  action,
}: StatusVisualProps) {
  const Icon = toneIcons[tone];

  return (
    <section className={`flex items-center gap-4 rounded-2xl border ${compact ? "p-3" : "p-4"} ${toneClasses[tone]}`}>
      {visual ? (
        <VisualAsset
          type="image"
          src={visual}
          label={visualAlt ?? title}
          className={compact ? "h-14 w-14 shrink-0" : "h-20 w-20 shrink-0"}
          sizes={compact ? "56px" : "80px"}
        />
      ) : (
        <VisualAsset
          type="icon"
          icon={Icon}
          label={title}
          className={`shrink-0 rounded-xl bg-white/80 ${compact ? "h-10 w-10" : "h-12 w-12"}`}
          iconClassName={tone === "pending" ? "animate-spin" : undefined}
          size={compact ? 18 : 22}
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[12px] font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-[10px] leading-4 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
