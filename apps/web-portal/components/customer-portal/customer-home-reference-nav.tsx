"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {BrandLockup} from "@/components/brand-lockup";
import {Home,CarFront,ShieldCheck,FileText,Grid2X2} from "lucide-react";
export function CustomerHomeReferenceNav(){
 const account=useSearchParams().get("account");
 const href=(pathname:string)=>account?{pathname,query:{account}}:pathname;
 return <div className="ref-home-header-nav"><Link href={href("/customer/home")} aria-label="Insureit home"><BrandLockup compact/></Link>
 <nav aria-label="Customer homepage navigation">
 {[[Home,"Home","/customer/home"],[CarFront,"My Vehicles","/customer/vehicles"],[ShieldCheck,"My Policies","/customer/policies"],[FileText,"My Claims","/customer/claims"]].map(([icon,label,path])=>{const Icon=icon as typeof Home;return <Link key={String(path)} href={href(String(path))} aria-current={label==="Home"?"page":undefined}><Icon size={22}/><span>{String(label)}</span></Link>;})}
 <details><summary><Grid2X2 size={22}/> Services</summary><div>{[["Renew Policy","/customer/renewals"],["Get a Quote","/customer/insurance-quote"],["Add Vehicle","/customer/add-vehicle"],["Vehicle Exchange","/customer/exchange"],["E-Challan","/customer/e-challan"],["Documents","/customer/documents"],["Support","/customer/support"],["Settings","/customer/settings"]].map(([label,path])=><Link key={path} href={href(path)}>{label}</Link>)}</div></details>
 </nav></div>;
}
