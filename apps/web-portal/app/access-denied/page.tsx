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
    <main className="flex min-h-screen items-center justify-center bg-[#F3F6FB] px-4 py-8">
      <section className="w-full max-w-[490px] rounded-2xl border border-[#E0E8F2] bg-white px-6 py-7 text-center shadow-[0_14px_45px_rgba(23,54,93,.08)] sm:px-9">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EBF3FD] text-[#285A93]">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[.15em] text-[#6982A2]">Access information</p>
        <h1 className="mt-2 text-[22px] font-bold leading-snug text-[#102A50]">{message.title}</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#5D718D]">{message.description}</p>
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#E3ECF6] bg-[#F8FAFD] px-3 py-2.5 text-left">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5B7CA3]" aria-hidden="true" />
          <span className="text-[11px] leading-5 text-[#506A8A]"><strong className="font-semibold">Reason:</strong> {message.detail}</span>
        </div>
        <AccessDeniedActions homeHref={home} homeLabel={homeLabel} />
      </section>
    </main>
  );
}
