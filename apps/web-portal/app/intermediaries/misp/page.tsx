import { IntermediaryRegister } from "../page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MispRegisterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  return <IntermediaryRegister selectedType="misp" search={query.q?.trim().slice(0, 80) ?? ""} />;
}
