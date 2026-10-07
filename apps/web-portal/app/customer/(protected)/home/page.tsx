import { ShieldCheck } from "lucide-react";
import { getCustomerWebSession } from "@/lib/customer-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerHomePage() {
  const session = await getCustomerWebSession();
  const accountCount = session.accounts.length;

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#D8E2EF] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(17,38,70,0.06)] sm:px-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EAF1FA] text-[#245A9A]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#718198]">Foundation status</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.035em] text-[#142746]">Customer Web is isolated and ready for feature parity work.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758A]">
              This protected area accepts active Customer profiles only. Partner and Operations authorization remain unchanged.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[#D8E2EF] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718198]">Authorized customer accounts</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#142746]">{accountCount}</p>
          <p className="mt-1 text-xs text-[#718198]">Resolved through the signed-in Customer identity and active memberships.</p>
        </div>
        <div className="rounded-[18px] border border-[#D8E2EF] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718198]">Existing portals</p>
          <p className="mt-2 text-sm font-semibold text-[#142746]">No Partner or Operations behavior changed</p>
          <p className="mt-1 text-xs leading-5 text-[#718198]">The next stages will port Customer App features into this isolated surface one module at a time.</p>
        </div>
      </section>
    </div>
  );
}
