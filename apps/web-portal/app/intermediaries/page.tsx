import { IntermediaryRegister, type IntermediaryType } from "./intermediary-register";
import { OverviewIntermediaryRegister } from "./overview-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query={q?:string;type?:string;account_status?:string;registration_status?:string;portal_access?:string;success?:string;error?:string};
export default async function IntermediariesPage({searchParams}:{searchParams:Promise<Query>}){
 const query=await searchParams;const typeFilter=["posp","misp","partner"].includes(query.type??"")?query.type as IntermediaryType:null;
 const search=query.q?.trim().slice(0,80)??"";
 if(!typeFilter&&!query.account_status&&!query.registration_status&&!query.portal_access){
  return <OverviewIntermediaryRegister search={search} success={query.success} error={query.error}/>;
 }
 return <IntermediaryRegister selectedType={null} typeFilter={typeFilter} search={search} accountStatus={query.account_status??""} registrationStatus={query.registration_status??""} portalAccess={query.portal_access??""} success={query.success} error={query.error}/>;
}
