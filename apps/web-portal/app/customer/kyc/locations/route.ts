import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

export async function GET(request: Request) {
  await getCustomerWebSession();
  const pincode = new URL(request.url).searchParams.get("pincode")?.replace(/\D/g, "").slice(0, 6) ?? "";
  if (pincode.length !== 6) return NextResponse.json({ locations: [] });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("india_locations")
    .select("id,pincode,city_name,district,state_name")
    .eq("pincode", pincode)
    .order("city_name")
    .limit(12);
  if (error) return NextResponse.json({ error: "PIN code lookup is unavailable." }, { status: 500 });
  return NextResponse.json({ locations: data ?? [] });
}
