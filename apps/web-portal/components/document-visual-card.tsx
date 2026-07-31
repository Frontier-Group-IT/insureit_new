import Image from "next/image";

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

const assets: Record<string, { src: string; alt: string; fit?: "contain" | "cover" }> = {
  aadhaar_front: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card front visual" },
  aadhaar_back: { src: "/document-assets/pan-card.png", alt: "Aadhaar card back visual" },
  representative_aadhaar_front: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card front visual" },
  representative_aadhaar_back: { src: "/document-assets/pan-card.png", alt: "Aadhaar card back visual" },
  pan_copy: { src: "/document-assets/identity-card.png", alt: "PAN card visual" },
  company_pan_copy: { src: "/document-assets/identity-card.png", alt: "PAN card visual" },
  representative_pan_copy: { src: "/document-assets/identity-card.png", alt: "PAN card visual" },
  photograph: { src: "/document-assets/photograph.png", alt: "Photograph visual" },
  cancelled_cheque: { src: "/document-assets/cancelled-cheque.png", alt: "Cancelled cheque visual" },
  education: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_10th_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_12th_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_graduation_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_post_graduation_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  agreement_copy: { src: "/document-assets/agreement-copy.png", alt: "Agreement document visual" },
  gst_copy: { src: "/document-assets/gst-certificate.png", alt: "GST certificate visual" },
  registration_form: { src: "/document-assets/registration-form.png", alt: "Registration form visual" },
};

const fallbackAsset = { src: "/document-assets/identity-card.png", alt: "Document visual" };

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

export function DocumentVisualCard({
  type,
  title,
  fileName,
  required = false,
  status,
  tone,
  action,
  children,
  id,
  clickTargetId,
  compact = false,
}: DocumentVisualCardProps) {
  const asset = assets[type] ?? fallbackAsset;
  const resolvedTone = tone ?? (fileName ? "uploaded" : required ? "required" : "optional");
  const label = status ?? (fileName ? "Uploaded" : required ? "Required" : "Optional");

  return (
    <article id={id} className={`group relative overflow-hidden rounded-[22px] border shadow-[0_24px_60px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:shadow-[0_34px_76px_rgba(15,23,42,0.1)] ${toneClasses[resolvedTone]}`}>
      {clickTargetId ? <label htmlFor={clickTargetId} className="absolute inset-0 z-10 cursor-pointer" aria-label={`Upload ${title}`} /> : null}
      <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_50%_34%,#FFFFFF_0%,#F9FBFF_38%,#EDF4FF_100%)] ${compact ? "h-44" : "h-64"}`}>
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes={compact ? "(max-width: 768px) 100vw, 360px" : "(max-width: 768px) 100vw, 460px"}
          className={`scale-[1.34] drop-shadow-[0_30px_34px_rgba(15,23,42,0.2)] transition duration-300 group-hover:scale-[1.4] ${asset.fit === "cover" ? "object-cover" : "object-contain"}`}
        />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.04em] ${badgeClasses[resolvedTone]}`}>{label}</span>
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/80 bg-white/88 p-3 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[12px] font-semibold text-[#0F172A]">{title}{required ? <span className="ml-1 text-red-500">*</span> : null}</h3>
          </div>
          {action ? <div className="relative z-30 shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="relative z-30 mt-2">{children}</div> : null}
      </div>
    </article>
  );
}
