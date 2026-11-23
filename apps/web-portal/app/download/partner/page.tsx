import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.insureit.partner";
const APP_STORE = "https://apps.apple.com/in/app/insureit-partner/id6822622280";

/**
 * Permanent, first-party QR destination.
 * Phone browsers are sent to their own store; desktop / unrecognized
 * browsers get an accessible choice rather than an incorrect redirect.
 */
export default async function PartnerAppDownloadPage() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  if (/iPhone|iPad|iPod/i.test(userAgent)) redirect(APP_STORE);
  if (/Android/i.test(userAgent)) redirect(GOOGLE_PLAY);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(130deg,#061C4A,#075BC3)] px-4 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/10 px-7 py-9 text-center shadow-2xl backdrop-blur-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
          {/* Reuse the Operations Portal's official INSUREIT shield asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/insureit-mark.webp" width="52" height="52" alt="INSUREIT shield logo" />
        </div>
        <h1 className="text-3xl font-extrabold">INSUREIT <span className="text-[#FFD04E]">Partner</span></h1>
        <p className="mt-3 text-sm text-blue-100">Choose your device to download the official INSUREIT Partner App.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={GOOGLE_PLAY} className="rounded-xl bg-white px-5 py-3 font-bold text-[#0D3470] transition hover:bg-blue-100">Google Play</Link>
          <Link href={APP_STORE} className="rounded-xl bg-[#FFC943] px-5 py-3 font-bold text-[#102B59] transition hover:bg-[#FFDC82]">Apple App Store</Link>
        </div>
        <p className="mt-6 text-xs text-blue-200">For authorized INSUREIT partners and team members.</p>
      </section>
    </main>
  );
}
