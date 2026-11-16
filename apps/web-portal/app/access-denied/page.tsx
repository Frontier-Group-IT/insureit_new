import { Info, ShieldCheck } from "lucide-react";
import { AccessDeniedActions } from "@/components/access-denied-actions";

const messages = {
  profile_missing: {
    title: "Account setup is incomplete",
    description: "You're signed in, but your user profile hasn't been set up yet. Please contact your administrator to complete the setup.",
    detail: "User profile not found",
  },
  account_inactive: {
    title: "Your account is currently inactive",
    description: "Your account is currently marked inactive. Please contact your administrator if you need access restored.",
    detail: "Account status: inactive",
  },
  role_not_enabled: {
    title: "This account needs portal access",
    description: "Your account is signed in, but its assigned role isn't enabled for this portal. Please ask your administrator to check your role.",
    detail: "Assigned role is not enabled for portal access",
  },
  customer_workspace: {
    title: "This page is for team members",
    description: "You're signed in with a customer account. This area is for InsureIt team members. You can continue to your Customer Portal instead.",
    detail: "Customer account on a team workspace",
    home: "/customer/home",
    homeLabel: "Go to Customer Portal",
  },
  staff_workspace: {
    title: "You're in the team account",
    description: "You're signed in with a team or partner account. The Customer Portal requires a customer login. Use your customer account to continue.",
    detail: "Team or partner account on the Customer Portal",
  },
  module_permission: {
    title: "This section isn't available for your role",
    description: "Your account is active, but this section requires an additional permission. Please contact your administrator if you need it.",
    detail: "Required section permission not assigned",
  },
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
    : {
        title: "We couldn't open this page",
        description: "We couldn't confirm access to this page. Try opening your home page or contact your administrator if the issue continues.",
        detail: "Access check needs review",
      };

  const home = "home" in message ? message.home : undefined;
  const homeLabel = "homeLabel" in message ? message.homeLabel : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FB] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#17365D]" />
      <section
        aria-labelledby="access-denied-title"
        className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_60px_rgba(15,35,66,0.08)]"
      >
        <div className="px-6 pb-5 pt-7 sm:px-8 sm:pt-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE9F7] bg-[#EDF5FE] text-[#235B97]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#56779B]">Access information</p>
          <h1 id="access-denied-title" className="mt-2 text-[23px] font-bold leading-[1.3] tracking-[-0.025em] text-[#132D4F] sm:text-[25px]">
            {message.title}
          </h1>
          <p className="mt-3 text-[13px] leading-[1.8] text-[#586B83]">{message.description}</p>
        </div>
        <div className="mx-6 flex items-start gap-3 rounded-xl border border-[#E4EBF4] bg-[#F7F9FC] px-4 py-3 sm:mx-8">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#55789F]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#405C7C]">Why am I seeing this?</p>
            <p className="mt-1 break-words text-[12px] leading-5 text-[#61758C]">{message.detail}</p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-1 sm:px-8 sm:pb-7">
          <AccessDeniedActions homeHref={home} homeLabel={homeLabel} />
        </div>
        <div className="border-t border-[#EDF1F6] bg-[#FBFCFE] px-6 py-3 text-center text-[11px] text-[#8290A2] sm:px-8">
          INSUREIT · Secure account access
        </div>
      </section>
    </main>
  );
}
