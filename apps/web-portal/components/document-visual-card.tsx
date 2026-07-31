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
  uploaded: "border-emerald-200 bg-emerald-50/30",
  required: "border-amber-200 bg-amber-50/25",
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
  meta,
  tone,
  action,
  children,
  id,
  compact = false,
}: DocumentVisualCardProps) {
  const asset = assets[type] ?? fallbackAsset;
  const resolvedTone = tone ?? (fileName ? "uploaded" : required ? "required" : "optional");
  const label = status ?? (fileName ? "Uploaded" : required ? "Required" : "Optional");

  return (
    <article id={id} className={`overflow-hidden rounded-2xl border shadow-sm transition ${toneClasses[resolvedTone]}`}>
      <div className={`relative overflow-hidden bg-gradient-to-br from-[#F8FBFF] via-white to-[#EEF4FF] ${compact ? "h-28" : "h-40"}`}>
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes={compact ? "(max-width: 768px) 50vw, 260px" : "(max-width: 768px) 100vw, 360px"}
          className={`p-3 drop-shadow-[0_18px_26px_rgba(15,23,42,0.16)] ${asset.fit === "cover" ? "object-cover" : "object-contain"}`}
        />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.04em] ${badgeClasses[resolvedTone]}`}>{label}</span>
          {required ? <span className="rounded-full border border-red-100 bg-white/90 px-2 py-1 text-[8.5px] font-bold uppercase text-red-600">Mandatory</span> : null}
        </div>
      </div>
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[12px] font-semibold text-[#0F172A]">{title}</h3>
            <p className="mt-1 truncate text-[9.5px] font-medium text-[#64748B]">{fileName || "No file attached yet"}</p>
            {meta ? <p className="mt-1 text-[8.5px] font-medium text-[#94A3B8]">{meta}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="mt-3 space-y-2">{children}</div> : null}
      </div>
    </article>
  );
}
