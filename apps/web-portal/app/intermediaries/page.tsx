import { redirect } from "next/navigation";

// The legacy Intermediaries Overview has been retired. Keep the old URL as a
// safe entry point, but never render the removed Overview register.
type Query = {
  q?: string;
  type?: string;
  account_status?: string;
  registration_status?: string;
  portal_access?: string;
  success?: string;
  error?: string;
};

export default async function IntermediariesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const destination = query.type === "posp"
    ? "/intermediaries/posp"
    : query.type === "misp"
      ? "/intermediaries/misp"
      : "/intermediaries/partner";
  const params = new URLSearchParams();
  for (const key of ["q", "account_status", "registration_status", "portal_access", "success", "error"] as const) {
    const value = query[key];
    if (typeof value === "string" && value.trim()) params.set(key, value.slice(0, 200));
  }
  redirect(params.size ? `${destination}?${params.toString()}` : destination);
}
