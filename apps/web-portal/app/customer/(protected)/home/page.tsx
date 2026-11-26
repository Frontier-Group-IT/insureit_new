import "./customer-home-modern.css";
import Link from "next/link";
import { ArrowRight, BellRing, CarFront, CheckCircle2, Clock, FilePlus2, FileText, Headset, ShieldCheck, ShieldPlus, Star, Zap, ArrowLeftRight } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { customerPolicyTone, loadCustomerWebPolicies, loadCustomerWebVehicles, resolveCustomerWebScope } from "@/lib/customer-web-data";
import { isCompletedCustomerClaim, loadCustomerClaimListContext } from "@/lib/customer-web-phase2-data";
import { HomeVehicleCarousel, HomeVehicleArt } from "./home-vehicle-carousel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerHomePage({ searchParams }: { searchParams?: Promise<{ account?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies, claimContext] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
    loadCustomerClaimListContext(account.id),
  ]);
  const { claims, milestones_by_claim } = claimContext;
  const classified = policies.map(policy => ({policy, ...customerPolicyTone(policy.end_date)}));
  const active = classified.filter(p => p.tone === "active").length;
  const due = classified.filter(p => p.tone === "due");
  const expired = classified.filter(p => p.tone === "expired");
  const coveredIds = new Set(classified.filter(p => p.tone !== "expired").map(p => p.policy.vehicle_id).filter(Boolean));
  const uncoveredVehicles = vehicles.filter(vehicle => !coveredIds.has(vehicle.id));
  const completedClaims = claims.filter(claim => isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []));
  const openClaims = claims.filter(claim => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected");
  const accountQuery = { account: account.id };
  const href = (pathname:string) => ({pathname,query:accountQuery});
  const urgent = [...expired.filter(p=>!p.policy.vehicle_id||!coveredIds.has(p.policy.vehicle_id)), ...due].sort((a,b)=>a.days-b.days)[0];
  const urgentVehicle = urgent ? vehicles.find(v=>v.id===urgent.policy.vehicle_id) : uncoveredVehicles[0];
  const total = policies.length;
  const activeArc = total ? active / total * 100 : 0;
  const dueArc = total ? due.length / total * 100 : 0;
  const actions = [
    {label:"Renew Policy",path:"/customer/renewals",Icon:ShieldPlus},
    {label:"New Claim",path:"/customer/start-claim",Icon:FilePlus2},
    {label:"Get a Quote",path:"/customer/insurance-quote",Icon:FileText},
    {label:"Add Vehicle",path:"/customer/add-vehicle",Icon:CarFront},
    {label:"Vehicle Exchange",path:"/customer/exchange",Icon:ArrowLeftRight},
    {label:"Support",path:"/customer/support",Icon:Headset},
  ];
  return <div data-customer-home className="customer-home-modern customer-reference-home">
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />
    <section className="ref-home-hero">
      <div className="ref-home-copy">
        <p className="ref-home-eyebrow">Complete vehicle insurance solution</p>
        <h1>Drive Worry-Free<br/>with <span>Insureit</span></h1>
        <p>Buy, renew, claim and manage your<br className="hidden sm:block"/> vehicle insurance – all in one place.</p>
        <div className="ref-home-buttons">
          <Link className="ref-home-primary" href={{ pathname: "/customer/start-claim", query: accountQuery }}>Start New Claim <ArrowRight size={19}/></Link>
          <Link className="ref-home-secondary" href={href("/customer/insurance-quote")}><FilePlus2 size={21}/> Get a Quote</Link>
        </div>
      </div>
      <div className="ref-home-art" aria-hidden="true">
        <ShieldCheck className="ref-home-shield"/>
        <img className="ref-home-hero-car" src="/assets/exchange-vehicles/pcp-car.webp" alt=""/>
        <img className="ref-home-hero-bike" src="/assets/exchange-vehicles/twp-bike.png" alt=""/>
        <img className="ref-home-hero-truck" src="/assets/exchange-vehicles/insureit-branded-truck.webp" alt=""/>
      </div>
    </section>
    <div className="ref-home-dashboard">
      <div className="ref-home-main">
        <div className="ref-home-benefits">
          {[[ShieldCheck,"Trusted Partners"],[Zap,"Quick Claims"],[Headset,"Expert Support"],[Star,"Hassle-Free Process"]].map(([Icon,label])=>{const Glyph=Icon as typeof ShieldCheck;return <div key={String(label)}><Glyph aria-hidden="true"/><span>{String(label)}</span></div>;})}
        </div>
        <div className="ref-home-top-grid">
          <section className="ref-home-card ref-home-summary">
            <h2>Your Insurance Summary</h2>
            <Link href={href("/customer/policies")} className="ref-home-summary-body" aria-label={`View all ${total} policies: ${active} active, ${due.length} expiring soon, ${expired.length} expired`}>
              <div className="ref-home-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="49" stroke="#dbe6fc" strokeWidth="10" fill="none"/>
                  {total>0?<g transform="rotate(-90 60 60)" fill="none" strokeWidth="10">
                    <circle cx="60" cy="60" r="49" pathLength="100" stroke="#285bfa" strokeDasharray={`${activeArc} ${100-activeArc}`}/>
                    <circle cx="60" cy="60" r="49" pathLength="100" stroke="#86a8ff" strokeDasharray={`${dueArc} ${100-dueArc}`} strokeDashoffset={-activeArc}/>
                    <circle cx="60" cy="60" r="49" pathLength="100" stroke="#c1d3ff" strokeDasharray={`${100-activeArc-dueArc} ${activeArc+dueArc}`} strokeDashoffset={-(activeArc+dueArc)}/>
                  </g>:null}
                </svg><div><strong>{total}</strong><span>Policies</span></div>
              </div>
              <div className="ref-home-legend"><span><i className="active"/><b>{active}</b> Active</span><span><i className="due"/><b>{due.length}</b> Expiring Soon</span><span><i className="expired"/><b>{expired.length}</b> Expired</span></div><ArrowRight size={17}/>
            </Link>
          </section>
          <section className={`ref-home-card ref-home-attention ${urgent||urgentVehicle?"has-action":""}`}>
            <h2><BellRing size={24}/> Action Required</h2>
            {urgent||urgentVehicle?<div className="ref-home-alert-row">
              <HomeVehicleArt vehicleType={urgentVehicle?.vehicle_type} />
              <div className="ref-home-alert-text"><strong>{urgentVehicle?.vehicle_no || urgent?.policy.vehicle_no || urgent?.policy.policy_no || "Unregistered vehicle"}</strong>
                <p>{urgent ? urgent.days<0 ? `Policy expired ${-urgent.days} day${urgent.days===-1?"":"s"} ago` : urgent.days===0?"Policy expires today":`Policy expires in ${urgent.days} days` : "No active insurance cover"}</p>
              </div>
              <Link className="ref-home-renew" href={urgent?href("/customer/renewals"):href("/customer/insurance-quote")}>{urgent?"Renew Now":"Get a Quote"} <ArrowRight size={17}/></Link>
            </div>:<p className="ref-home-clear"><CheckCircle2 size={22}/> No urgent insurance actions.</p>}
            {urgent||urgentVehicle?<Link className="ref-home-alert-more" href={href("/customer/renewals")}>View renewals <ArrowRight size={13}/></Link>:null}
            {uncoveredVehicles.length>0?<Link className="ref-home-alert-more" href={href("/customer/vehicles")}>View uninsured vehicles ({uncoveredVehicles.length})</Link>:null}
          </section>
        </div>
        <div className="ref-home-bottom-grid">
          <section className="ref-home-card ref-home-vehicles"><div className="ref-home-section-heading"><h2>My Vehicles ({vehicles.length})</h2><Link href={href("/customer/vehicles")}>View All <ArrowRight size={16}/></Link></div>
            <HomeVehicleCarousel accountId={account.id} items={vehicles.map(v=>({id:v.id,number:v.vehicle_no||(v.chassis_no?`New-${v.chassis_no}`:"Unregistered"),model:v.model||v.make||"Vehicle",vehicleType:v.vehicle_type,insured:coveredIds.has(v.id)}))}/>
          </section>
          <section className="ref-home-card ref-home-claims"><div className="ref-home-section-heading"><h2><FileText size={24}/> My Claims</h2><Link href={{pathname:"/customer/claims",query:accountQuery}}>View All <ArrowRight size={16}/></Link></div>
            <Link className="ref-home-claim-row" href={{pathname:"/customer/claims",query:{...accountQuery,filter:"completed"}}}><CheckCircle2 className="settled"/><span>Settled Claims</span><b>{completedClaims.length}</b></Link>
            <Link className="ref-home-claim-row" href={{pathname:"/customer/claims",query:{...accountQuery,filter:"open"}}}><Clock className="pending"/><span>Open Claims</span><b>{openClaims.length}</b></Link>
          </section>
        </div>
      </div>
      <aside className="ref-home-aside">
        <section className="ref-home-quick" aria-label="Quick actions"><h2><Zap size={24}/> Quick Actions</h2><nav aria-label="Customer quick actions">{actions.map(({label,path,Icon})=><Link key={path} href={href(path)}><Icon size={32}/><span>{label}</span></Link>)}</nav></section>
        <section className="ref-home-support"><div><h2><Headset size={25}/> Need Help?</h2><p>Our support team is here for you.</p><Link href={href("/customer/support")}>Contact Support <ArrowRight size={16}/></Link></div><img src="/assets/customer-3d-icons/help_and_support.png" alt="" aria-hidden="true" loading="lazy"/></section>
      </aside>
    </div>
  </div>;
}
