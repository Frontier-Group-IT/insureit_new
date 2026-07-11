import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ locations: [] });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("india_locations")
    .select("id, city_name, district, state_name, pincode")
    .ilike("search_text", `%${query}%`)
    .order("city_name")
    .limit(12);

  if (error) {
    return NextResponse.json({ error: error.message, locations: [] }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}
