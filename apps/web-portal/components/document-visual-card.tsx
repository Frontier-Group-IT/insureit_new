import { AlertCircle, CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { documentVisuals, fallbackDocumentVisual } from "@/lib/visual-assets";
import { VisualAsset } from "@/components/ui/visual-asset";

type Tone = "missing" | "uploaded" | "required" | "optional" | "error";

type DocumentVisualCardProps = {
  type: string;
  title: string;
  fileName?: string | null;
  required?: boolean;
  status?: string;
  meta?: string;
  tone?: Tone;
  action?: React.ReactNode;
  children?: React.ReactNode;
  id?: string;
  clickTargetId?: string;
  compact?: boolean;
};

const toneClasses: Record<Tone, string> = {
  missing: "border-slate-200 bg-white",
  uploaded: "border-emerald-200 bg-white",
  required: "border-amber-200 bg-white",
  optional: "border-[#DCE5EF] bg-white",
  error: "border-red-300 bg-red-50",
};

const badgeClasses: Record<Tone, string> = {
  missing: "border-slate-200 bg-slate-50 text-slate-600",
  uploaded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  required: "border-amber-200 bg-amber-50 text-amber-800",
  optional: "border-[#DCE5EF] bg-[#F8FAFC] text-[#64748B]",
  error: "border-red-200 bg-red-50 text-red-700",
};

function StatusIcon({ tone }: { tone: Tone }) {
  if (tone === "uploaded") return <CheckCircle2 aria-hidden="true" size={12} strokeWidth={2} />;
  if (tone === "error") return <AlertCircle aria-hidden="true" size={12} strokeWidth={2} />;
  return <UploadCloud aria-hidden="true" size={12} strokeWidth={1.9} />;
}

export function DocumentVisualCard({
  type,
  title,
  fileName,
  required = false,
  status,
  meta,
  tone,
  action,
  children,
  id,
  clickTargetId,
  compact = false,
}: DocumentVisualCardProps) {
  const asset = documentVisuals[type] ?? fallbackDocumentVisual;
  const resolvedTone = tone ?? (fileName ? "uploaded" : required ? "required" : "optional");
  const label = status ?? (fileName ? "Uploaded" : required ? "Required" : "Optional");

  return (
    <article
      id={id}
      className={`group relative overflow-hidden rounded-[22px] border shadow-[0_20px_48px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_64px_rgba(15,23,42,0.09)] ${toneClasses[resolvedTone]}`}
    >
      {clickTargetId ? (
        <label
          htmlFor={clickTargetId}
          className="absolute inset-x-0 top-0 z-10 h-[68%] cursor-pointer"
          aria-label={`Upload ${title}`}
        />
      ) : null}

      <div className={`relative overflow-hidden bg-white ${compact ? "h-48" : "h-64"}`}>
        <VisualAsset
          type="image"
          src={asset.src}
          label={asset.alt}
          className="h-full w-full"
          sizes={compact ? "(max-width: 768px) 100vw, 360px" : "(max-width: 768px) 100vw, 460px"}
          imageClassName="object-cover transition duration-300 group-hover:scale-[1.015]"
          position={asset.position}
        />

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.04em] ${badgeClasses[resolvedTone]}`}>
            <StatusIcon tone={resolvedTone} />
            {label}
          </span>
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/75 bg-white/90 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.11)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[12px] font-semibold text-[#0F172A]">
              {title}
              {required ? <span className="ml-1 text-red-500">*</span> : null}
            </h3>
            {fileName ? (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[9px] text-slate-500">
                <FileText aria-hidden="true" size={12} strokeWidth={1.8} className="shrink-0" />
                <span className="truncate">{fileName}</span>
              </p>
            ) : meta ? (
              <p className="mt-1 truncate text-[9px] text-slate-500">{meta}</p>
            ) : (
              <p className="mt-1 text-[9px] text-slate-500">{required ? "Select PDF, JPG or PNG" : "Upload when available"}</p>
            )}
          </div>
          {action ? <div className="relative z-30 shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="relative z-30 mt-2 border-t border-slate-200/80 pt-2">{children}</div> : null}
      </div>
    </article>
  );
}
