import { Info, LockKeyhole } from "lucide-react";
import { AccessDeniedActions } from "@/components/access-denied-actions";

const messages = {
  profile_missing: { detail: "User profile not found" },
  account_inactive: { detail: "Account status: inactive" },
  role_not_enabled: { detail: "Assigned role is not enabled for portal access" },
  customer_workspace: {
    detail: "Customer account on a team workspace",
    home: "/customer/home",
    homeLabel: "Go to Customer Portal",
  },
  staff_workspace: { detail: "Team or partner account on the Customer Portal" },
  module_permission: { detail: "Required section permission not assigned" },
} as const;

type Reason = keyof typeof messages;

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const reason = query.reason;
  const message = reason && Object.prototype.hasOwnProperty.call(messages, reason)
    ? messages[reason as Reason]
    : { detail: "Access check needs review" };

  const home = "home" in message ? message.home : "/";
  const homeLabel = "homeLabel" in message ? message.homeLabel : "Go to Home";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F1F5FD] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 bottom-[-15rem] h-[32rem] w-[32rem] rounded-full bg-[#E4ECFC] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-[-16rem] h-[32rem] w-[32rem] rounded-full bg-[#DFE9FD] blur-3xl" />
      <section
        aria-labelledby="access-denied-title"
        className="relative w-full max-w-[490px] rounded-[26px] border border-[#E1E8F5] bg-white px-6 py-8 shadow-[0_20px_60px_rgba(31,52,98,0.10)] sm:px-10 sm:py-10"
      >
        <div className="text-center text-[22px] font-extrabold tracking-[-0.035em] text-[#102D61]">
          INSURE<span className="text-[#F47B20]">IT</span>
        </div>
        <div className="mt-9 flex items-center justify-center gap-3">
          <LockKeyhole className="h-9 w-9 shrink-0 text-[#D93545]" aria-hidden="true" />
          <span aria-hidden="true" className="h-8 w-px bg-[#DCE4F0]" />
          <h1 id="access-denied-title" className="text-[26px] font-bold leading-tight tracking-[-0.04em] text-[#101F3D] sm:text-[30px]">
            Access Denied
          </h1>
        </div>
        <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-[#FFD5DA] bg-[#FFF5F6] px-4 py-3 text-[#A71927]">
          <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <p className="min-w-0 break-words text-[13px] leading-6">
            <span className="font-medium">Reason: </span><strong className="font-semibold">{message.detail}</strong>
          </p>
        </div>
        <AccessDeniedActions homeHref={home} homeLabel={homeLabel} />
      </section>
    </main>
  );
}
