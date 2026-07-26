import { IntermediaryRegister } from "./intermediary-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IntermediariesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  return <IntermediaryRegister selectedType={null} search={query.q?.trim().slice(0, 80) ?? ""} />;
}
