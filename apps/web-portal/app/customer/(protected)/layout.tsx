import type { ReactNode } from "react";
import "./customer-compact.css";
import { CustomerNavigation } from "@/components/customer-portal/customer-navigation";
import { CustomerHeaderActions } from "@/components/customer-portal/customer-header-actions";
import { CustomerRouteBreadcrumbs } from "@/components/customer-portal/customer-route-breadcrumbs";
import { getCustomerWebSession } from "@/lib/customer-web";

export default async function CustomerProtectedLayout({ children }: { children: ReactNode }) {
  const { profile } = await getCustomerWebSession();

  return (
    <div className="customer-compact min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <CustomerNavigation />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-40 border-b border-[#476184]/35 bg-[linear-gradient(110deg,rgba(188,203,224,0.88),rgba(203,215,232,0.82),rgba(230,236,245,0.72))] shadow-[0_12px_36px_rgba(18,40,75,0.14)] backdrop-blur-2xl">
          <div className="flex min-h-[66px] items-center justify-between gap-2 px-3 sm:px-5 lg:px-7">
            <div className="min-w-0 flex-1"><CustomerRouteBreadcrumbs /></div>
            <CustomerHeaderActions name={profile.full_name || "Customer"} />
          </div>
        </header>
        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-6 lg:pt-3">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
