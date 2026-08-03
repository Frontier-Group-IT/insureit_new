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
  muted?: boolean;
};

const assets: Record<string, { src: string; alt: string; position?: string }> = {
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
  training_certificate: { src: "/document-assets/education-certificate.png", alt: "Training certificate visual" },
  registration_certificate: { src: "/document-assets/registration-form.png", alt: "Registration certificate visual" },
  agreement_copy: { src: "/document-assets/agreement-copy.png", alt: "Agreement document visual" },
  gst_copy: { src: "/document-assets/gst-certificate.png", alt: "GST certificate visual" },
  registration_form: { src: "/document-assets/registration-form.png", alt: "Registration form visual" },
  custom_1: { src: "/document-assets/identity-card.png", alt: "Other document visual" },
  custom_2: { src: "/document-assets/identity-card.png", alt: "Other document visual" },
  custom_3: { src: "/document-assets/identity-card.png", alt: "Other document visual" },
  custom_4: { src: "/document-assets/identity-card.png", alt: "Other document visual" },
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
  muted = false,
}: DocumentVisualCardProps) {
  const asset = assets[type] ?? fallbackAsset;
  const resolvedTone = tone ?? (fileName ? "uploaded" : required ? "required" : "optional");
  const label = status ?? (fileName ? "Uploaded" : required ? "Required" : "Optional");

  return (
    <article id={id} className={`group relative overflow-hidden rounded-[18px] border shadow-[0_16px_38px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(15,23,42,0.09)] ${toneClasses[resolvedTone]} ${muted ? "opacity-50 hover:opacity-80" : "opacity-100"}`}>
      {clickTargetId ? <label htmlFor={clickTargetId} className="absolute inset-0 z-10 cursor-pointer" aria-label={`Upload ${title}`} /> : null}
      <div className={`relative overflow-hidden bg-white ${compact ? "h-40" : "h-72"}`}>
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes={compact ? "(max-width: 768px) 50vw, 240px" : "(max-width: 768px) 100vw, 460px"}
          className="object-cover transition duration-300 group-hover:scale-[1.015]"
          style={{ objectPosition: asset.position ?? "center" }}
        />
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.04em] ${badgeClasses[resolvedTone]}`}>{label}</span>
        </div>
      </div>
      <div className="absolute inset-x-2.5 bottom-2.5 z-20 rounded-xl border border-white/75 bg-white/84 p-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.11)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[10.5px] font-semibold leading-4 text-[#0F172A]">{title}{required ? <span className="ml-1 text-red-500">*</span> : null}</h3>
          </div>
          {action ? <div className="relative z-30 shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="relative z-30 mt-2">{children}</div> : null}
      </div>
    </article>
  );
}
