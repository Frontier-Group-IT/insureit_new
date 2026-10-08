import type { ReactNode } from "react";
import { CustomerNavigation } from "@/components/customer-portal/customer-navigation";
import { CustomerHeaderActions } from "@/components/customer-portal/customer-header-actions";
import { getCustomerWebSession } from "@/lib/customer-web";

export default async function CustomerProtectedLayout({ children }: { children: ReactNode }) {
  const { profile } = await getCustomerWebSession();

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <CustomerNavigation />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-40 border-b border-[#C8D4E3]/75 bg-white/95 backdrop-blur">
          <div className="flex min-h-[66px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6E7E94]">Customer Portal</p>
              <p className="mt-0.5 text-sm font-semibold text-[#142746]">{profile.full_name || "Customer"}</p>
            </div>
            <CustomerHeaderActions name={profile.full_name || "Customer"} />
          </div>
        </header>
        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
