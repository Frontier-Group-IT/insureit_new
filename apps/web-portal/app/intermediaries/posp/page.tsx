import { IntermediaryRegister } from "../intermediary-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospRegisterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  return <IntermediaryRegister selectedType="posp" search={query.q?.trim().slice(0, 80) ?? ""} />;
}
