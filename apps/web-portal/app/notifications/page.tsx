import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";

export default function NotificationsPage() {
  return (
    <ClaimManagerShell title="Notifications" backHref="/dashboard" activeNav="more">
      <section className="rounded-xl border border-[#E1E7F0] bg-white p-5 shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
        <p className="text-sm font-semibold text-[#071D49]">Activity center</p>
        <p className="mt-1 text-sm text-[#5C6878]">Customer updates and claim alerts will appear here.</p>
      </section>
    </ClaimManagerShell>
  );
}
