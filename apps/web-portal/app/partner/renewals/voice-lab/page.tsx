import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { RenewalVoiceLab } from "./renewal-voice-lab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RenewalVoiceLabPage() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || !profile.is_active) {
    redirect("/access-denied");
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-6 text-[#10213D] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px] space-y-4">
        <div className="rounded-xl border border-[#DCE5F0] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(37,61,103,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#6A7A90]">INSUREIT Internal Lab</p>
          <h1 className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-[#142A50]">AI Renewal Voice Lab</h1>
          <p className="mt-1 text-sm text-[#6A7A90]">Private browser role-play for authenticated INSUREIT users. No real customer call or CRM update is performed.</p>
        </div>
        <RenewalVoiceLab />
      </div>
    </main>
  );
}
