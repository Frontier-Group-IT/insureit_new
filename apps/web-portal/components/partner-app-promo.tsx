import Image from "next/image";
import compactStyles from "./partner-app-promo.module.css";
import { BellRing, ClipboardCheck, ExternalLink, QrCode, ShieldCheck, Users, CalendarClock } from "lucide-react";

// The QR matrix encodes only the permanent first-party /download/partner URL.
// It is generated as an SVG from a fixed, verified QR matrix; no third-party QR API,
// remote image loading, browser fingerprinting or client-side JS is necessary.
const QR_MATRIX = "0000000000000000000000000000000000000\n0000000000000000000000000000000000000\n0011111110001010101011110100111111100\n0010000010011110011010110000100000100\n0010111010110100101000111010101110100\n0010111010101000000010010010101110100\n0010111010101010111100101000101110100\n0010000010101111100011011110100000100\n0011111110101010101010101010111111100\n0000000000111000101001110100000000000\n0010111110001011100101000110111110000\n0001111000010001001101100100110110100\n0000000111011111110100001010001011000\n0001110000000111011111000000101111100\n0010110010111100111000111011001101100\n0010000000001101010010000011100011100\n0010001111111110011000101011100111000\n0000111101101010110010010111110110000\n0010110111010111110110101001011000100\n0010101001011100001011110101110110100\n0001100011011011011010110011011011000\n0011100101011100001000111110011110000\n0010111110011100000010010001011101100\n0010101101001001111100101100100110100\n0010101111111111100101010000010011000\n0010110000100001001011111000010011100\n0010011011010111000101101011111000100\n0000000000111110100111100110001010100\n0011111110010000110100101110101011000\n0010000010111110101111000110001110100\n0010111010101101001000111011111101100\n0010111010101110010110000101001100100\n0010111010100010011010101100110100000\n0010000010001011110000010001101110000\n0011111110101010010100101110110101000\n0000000000000000000000000000000000000\n0000000000000000000000000000000000000";
const STORE_PLAY = "https://play.google.com/store/apps/details?id=com.insureit.partner";
const STORE_APPLE = "https://apps.apple.com/in/app/insureit-partner/id6822622280";
const DOWNLOAD_URL = "https://portal.insureit.in/download/partner";
const qrPath = QR_MATRIX.split("\n").flatMap((row, y) =>
  Array.from(row, (cell, x) => cell === "1" ? `M${x} ${y}h1v1h-1z` : "").filter(Boolean),
).join(" ");

const features = [
  { icon: ClipboardCheck, text: "Create and track policy intakes", tone: "from-[#179AFF] to-[#0068DB]" },
  { icon: Users, text: "Manage policies and customers", tone: "from-[#11D9B0] to-[#069B82]" },
  { icon: CalendarClock, text: "Monitor business and renewals", tone: "from-[#FFB737] to-[#F17B11]" },
  { icon: ShieldCheck, text: "Track claims and service updates", tone: "from-[#FE5689] to-[#D82B6B]" },
] as const;

export function PartnerAppPromo() {
  return (
    <aside aria-label="Download INSUREIT Partner App" className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#2B76DF]/65 bg-[linear-gradient(132deg,#061B4D_0%,#073785_44%,#075DCE_77%,#041D5A_100%)] px-5 py-6 text-white shadow-[0_22px_54px_rgba(12,54,135,0.22)] sm:px-7">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-36 h-[380px] w-[380px] rounded-full bg-[#00C9FF]/30 blur-[75px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-[640px] rotate-[-11deg] rounded-[100%] border-t-[26px] border-[#03D3FF]/50 bg-[#087CEF]/15 blur-[9px]" />
      <div aria-hidden className="pointer-events-none absolute right-3 top-3 h-40 w-48 opacity-25" style={{ backgroundImage: "radial-gradient(#59B6FF 1px,transparent 1px)", backgroundSize: "13px 13px" }} />

      <div className="relative z-10 mb-5 flex items-center gap-3">
        <Image src="/assets/brand/insureit-mark.webp" alt="INSUREIT shield emblem" width={57} height={57} className="h-[57px] w-[57px] shrink-0 rounded-lg bg-white object-contain p-1" />
        <div className="border-l border-white/55 pl-3 leading-none">
          <div className="text-[24px] font-extrabold tracking-tight">insureit</div>
          <div className="mt-1 text-[22px] font-black text-[#FFC53A]">Partner</div>
        </div>
      </div>

      <div className="relative z-10 grid flex-1 gap-5 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] items-center">
        <div className="min-w-0">
          <h2 className="max-w-xl text-[clamp(25px,2vw,36px)] font-black leading-[1.09] tracking-tight">Get the INSUREIT <span className="block text-[#FFCE3A]">Partner App</span></h2>
          <div className="mt-3 h-[3px] w-36 rounded-full bg-gradient-to-r from-[#04DBFE] to-transparent" />
          <p className="mt-4 max-w-md text-[14px] leading-6 text-[#EBF5FF]">Manage your insurance business anywhere, anytime.</p>
          <ul className="mt-6 space-y-3">
            {features.map(({ icon: Icon, text, tone }) => (
              <li key={text} className="flex items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tone} shadow-[0_5px_16px_rgba(0,0,0,0.15)]`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-[13px] font-semibold leading-[1.4]">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <a href="/download/partner" aria-label="Scan the QR code to download INSUREIT Partner App" className="group relative mx-auto flex w-full max-w-[290px] flex-col items-center rounded-[28px] border-2 border-[#54EFFF] bg-[#052660]/70 px-4 py-5 shadow-[0_0_30px_rgba(0,222,255,0.48),inset_0_0_25px_rgba(15,153,255,0.22)] transition-transform hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <div className="absolute -top-1 left-[20%] right-[20%] h-2 rounded-full bg-[#7BFCFF] blur-sm" />
          <div className="w-full max-w-[228px] rounded-[18px] bg-white p-3 shadow-xl">
            <svg role="img" aria-label="QR code linking to the INSUREIT Partner App smart download page" viewBox="0 0 37 37" className="h-auto w-full" shapeRendering="crispEdges">
              <rect width="37" height="37" fill="#FFFFFF" />
              <path d={qrPath} fill="#071D49" />
            </svg>
          </div>
          <span className="mt-4 flex items-center gap-2 text-center text-[19px] font-bold"><QrCode aria-hidden className="h-5 w-5" /> Scan to Download</span>
          <span className="mt-1 text-center text-[11px] text-[#C8EAFF]">iPhone or Android — one QR code</span>
        </a>
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-white/20 pt-5">
        <a href={STORE_PLAY} target="_blank" rel="noopener noreferrer" aria-label="Download INSUREIT Partner from Google Play" className="flex min-h-[47px] items-center gap-2 rounded-lg border border-white/50 bg-black px-3 py-1.5 shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-7 w-7 shrink-0"><path fill="#00D7FE" d="M5 3v42l22-21z"/><path fill="#00F076" d="M5 3q2-2 5 0l25 14-8 7z"/><path fill="#FFCE00" d="M35 17l10 6q2 1 0 3l-10 6-8-8z"/><path fill="#F33C51" d="M5 45q2 2 5 0l25-13-8-8z"/></svg>
          <span className="leading-none"><span className="block text-[9px] tracking-[.03em]">GET IT ON</span><span className="mt-1 block text-[17px] font-semibold">Google Play</span></span>
          <ExternalLink aria-hidden className="h-3 w-3 opacity-70" />
        </a>
        <a href={STORE_APPLE} target="_blank" rel="noopener noreferrer" aria-label="Download INSUREIT Partner from Apple App Store" className="flex min-h-[47px] items-center gap-2 rounded-lg border border-white/50 bg-black px-3 py-1.5 shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-7 w-7 shrink-0"><g fill="none" stroke="white" strokeWidth="5.5" strokeLinecap="round"><path d="M11 29h26M12 40l3-5M18 29 29 10M19 10l2.5 4.5M28 26l8 14"/></g></svg>
          <span className="leading-none"><span className="block text-[9px]">Download on the</span><span className="mt-1 block text-[17px] font-semibold">App Store</span></span>
          <ExternalLink aria-hidden className="h-3 w-3 opacity-70" />
        </a>
        <span className="flex items-center gap-1.5 text-[11px] text-[#C9EAFF]"><BellRing className="h-4 w-4" aria-hidden /> Available on Android & iOS</span>
      </div>
      <span className="sr-only">Smart download link: {DOWNLOAD_URL}</span>
    </aside>
  );
}

/** Header-only promotion: bounded height, no new dashboard row or network fetch. */
export function CompactPartnerAppPromo() {
  return (
    <aside aria-label="INSUREIT Partner App downloads" className="relative flex h-11 min-w-0 max-w-[370px] flex-1 items-center justify-between gap-2 overflow-hidden rounded-lg bg-[linear-gradient(110deg,#061B4D,#075DCE)] px-2 text-white">
      <a href="/download/partner" className="flex min-w-0 items-center gap-1.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Get the INSUREIT Partner App">
        <Image src="/assets/brand/insureit-mark.webp" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded bg-white object-contain p-0.5" />
        <span className={`${compactStyles.copy} min-w-0 leading-tight`}>
          <span className="block truncate text-[9px] font-bold">insureit <span className="text-[#FFCE3A]">Partner</span></span>
          <span className="block truncate text-[10px] font-bold">Get the Partner App</span>
        </span>
      </a>
      <div className={`${compactStyles.stores} min-w-0 grid-cols-2 gap-1`}>
        <a href={STORE_PLAY} target="_blank" rel="noopener noreferrer" className="flex h-7 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded bg-black px-1.5 text-[9px] font-semibold focus-visible:outline focus-visible:outline-white" aria-label="Download from Google Play"><svg aria-hidden="true" viewBox="0 0 48 48" className="h-3.5 w-3.5 shrink-0"><path fill="#00D7FE" d="M5 3v42l22-21z"/><path fill="#00F076" d="M5 3q2-2 5 0l25 14-8 7z"/><path fill="#FFCE00" d="M35 17l10 6q2 1 0 3l-10 6-8-8z"/><path fill="#F33C51" d="M5 45q2 2 5 0l25-13-8-8z"/></svg>Google Play</a>
        <a href={STORE_APPLE} target="_blank" rel="noopener noreferrer" className="flex h-7 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded bg-black px-1.5 text-[9px] font-semibold focus-visible:outline focus-visible:outline-white" aria-label="Download from Apple App Store"><svg aria-hidden="true" viewBox="0 0 48 48" className="h-3.5 w-3.5 shrink-0"><g fill="none" stroke="white" strokeWidth="5.5" strokeLinecap="round"><path d="M11 29h26M12 40l3-5M18 29 29 10M19 10l2.5 4.5M28 26l8 14"/></g></svg>App Store</a>
      </div>
    </aside>
  );
}

/** Separate dashboard QR; same permanent first-party download URL and matrix. */
export function CompactPartnerAppQr() {
  return (
    <a href="/download/partner" aria-label="Scan or open INSUREIT Partner App download" className="flex h-20 shrink-0 items-center gap-1.5 rounded-md px-1 text-[#174B83] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174B83]">
      <svg role="img" aria-label="Partner App download QR code" viewBox="-2 -2 41 41" className="h-20 w-20 shrink-0 rounded-sm border border-[#CFD9E7] bg-white" shapeRendering="crispEdges">
        <rect x="-2" y="-2" width="41" height="41" fill="#FFFFFF" />
        <path d={qrPath} fill="#071D49" />
      </svg>
      <span className="whitespace-nowrap text-[8px] font-semibold leading-none [writing-mode:vertical-rl] rotate-180">Scan to download</span>
    </a>
  );
}
