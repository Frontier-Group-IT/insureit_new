import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Search, ShieldAlert, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { listPartnerWebClaims, listPartnerWebCustomers, listPartnerWebPolicies } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const ready = q.length >= 2;

  const settled = ready
    ? await Promise.allSettled([
        listPartnerWebCustomers({ search: q, limit: 6, offset: 0 }),
        listPartnerWebPolicies({ search: q, limit: 6, offset: 0, lifecycle: "all" }),
        listPartnerWebClaims({ search: q, limit: 6, offset: 0, state: "all" }),
      ])
    : null;

  const customers = settled?.[0].status === "fulfilled" ? settled[0].value : [];
  const policies = settled?.[1].status === "fulfilled" ? settled[1].value : [];
  const claims = settled?.[2].status === "fulfilled" ? settled[2].value : [];
  const failed = settled ? settled.filter((result) => result.status === "rejected").length : 0;
  const hasResults = customers.length + policies.length + claims.length > 0;

  return (
    <PartnerPortalShell title="Search">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="Universal Search"
          title="Search your business"
          description="Customers, policies and claims are searched only inside your authorized Partner scope."
        />

        <section>
          <form action="/partner/search" className="flex max-w-2xl gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
              <input name="q" defaultValue={q} autoFocus placeholder="Customer, policy, claim, vehicle or insurer" className="h-10 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
            </div>
            <button type="submit" className="h-10 rounded-lg bg-[#111A35] px-4 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25">Search</button>
          </form>

          {failed ? <div className="mt-4 rounded-lg border border-[#F0D7AE] bg-[#FFF8EC] px-4 py-3 text-[10px] font-semibold text-[#80511A]">{failed} search section{failed === 1 ? "" : "s"} could not be refreshed. Available results are shown below.</div> : null}
        </section>

        {!ready ? (
          <Empty icon={Search} title="Search your authorized records" text="Enter at least 2 characters to search customers, policies and claims." />
        ) : !hasResults ? (
          <Empty icon={Search} title="No matching records" text="Try a customer name, mobile, policy number, vehicle number, claim number or insurer." />
        ) : (
          <>
            {customers.length ? (
              <ResultSection title="Customers" count={customers.length}>
                {customers.map((row) => (
                  <Result key={row.customer_id} href={"/partner/customers/" + encodeURIComponent(row.customer_id)} icon={UsersRound} title={row.customer_name} subtitle={[row.customer_code, row.phone, row.city].filter(Boolean).join(" · ") || "Customer record"} />
                ))}
              </ResultSection>
            ) : null}

            {policies.length ? (
              <ResultSection title="Policies" count={policies.length}>
                {policies.map((row) => (
                  <Result key={row.policy_id} href={"/partner/policies/" + encodeURIComponent(row.policy_id)} icon={ShieldCheck} title={row.policy_no || row.policy_code || "Policy"} subtitle={[row.customer_name, row.vehicle_no || row.insurer_name].filter(Boolean).join(" · ")} status={humanize(row.lifecycle_status)} />
                ))}
              </ResultSection>
            ) : null}

            {claims.length ? (
              <ResultSection title="Claims" count={claims.length}>
                {claims.map((row) => (
                  <Result key={row.claim_id} href={"/partner/claims/" + encodeURIComponent(row.claim_id)} icon={ShieldAlert} title={row.claim_no || row.insurer_claim_no || "Claim"} subtitle={[row.customer_name, row.vehicle_no || row.policy_no].filter(Boolean).join(" · ")} status={humanize(row.current_status || row.claim_state)} />
                ))}
              </ResultSection>
            ) : null}
          </>
        )}
      </div>
    </PartnerPortalShell>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <PartnerSectionHeading title={title} description={count + " shown"} />
      <div className="mt-3 divide-y divide-[#E8EDF4] border-y border-[#DCE4ED]">{children}</div>
    </section>
  );
}

function Result({ href, icon: Icon, title, subtitle, status }: { href: string; icon: LucideIcon; title: string; subtitle: string; status?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="break-words text-[11.5px] font-extrabold leading-4 text-[#1B2F4E]">{title}</p><p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-[#74839A]">{subtitle || "Record"}</p></div>
      {status ? <span className="hidden rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672] sm:inline-flex">{status}</span> : null}
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <section className="border-y border-[#DCE4ED] py-14 text-center"><Icon className="mx-auto h-7 w-7 text-[#9AABC0]" /><p className="mt-3 text-[12px] font-bold text-[#23395D]">{title}</p><p className="mt-1 text-[10.5px] text-[#7A899F]">{text}</p></section>;
}
