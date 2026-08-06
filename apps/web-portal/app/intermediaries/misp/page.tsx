import { StructuredAccountRegister } from "../structured-account-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { q?: string; status?: string };

export default async function MispRegisterPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <StructuredAccountRegister type="misp" search={query.q?.trim().slice(0, 80) ?? ""} status={query.status === "active" || query.status === "onboarding" ? query.status : "all"} />;
}
