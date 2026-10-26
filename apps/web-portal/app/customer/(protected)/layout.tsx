import type { ReactNode } from "react";
import "./customer-compact.css";
import { CustomerSidebarShell } from "@/components/customer-portal/customer-sidebar-shell";
import { CustomerHeaderActions } from "@/components/customer-portal/customer-header-actions";
import { CustomerRouteBreadcrumbs } from "@/components/customer-portal/customer-route-breadcrumbs";
import { getCustomerWebSession } from "@/lib/customer-web";

export default async function CustomerProtectedLayout({ children }: { children: ReactNode }) {
  const { profile, user } = await getCustomerWebSession();

  return (
    <div className="customer-compact min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <CustomerSidebarShell
        breadcrumbs={<CustomerRouteBreadcrumbs />}
        headerActions={<CustomerHeaderActions name={profile.full_name || "Customer"} userId={user.id} />}
      >
        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-6 lg:pt-3">
          <div className="customer-content-container mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </CustomerSidebarShell>
    </div>
  );
}
