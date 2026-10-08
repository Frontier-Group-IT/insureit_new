import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const session = await getCustomerWebSession();
  let body: { customerId?: string; name?: string; phone?: string; email?: string; address?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const customerId = clean(body.customerId, 64);
  if (!session.accounts.some((account) => account.id === customerId)) {
    return NextResponse.json({ error: "Customer account is not authorized." }, { status: 403 });
  }

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 24);
  const email = clean(body.email, 160);
  const address = clean(body.address, 500);
  if (name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (phone && phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const customer = await supabase
    .from("customers")
    .update({ contact_name: name, phone, email: email || null, address: address || null })
    .eq("id", customerId)
    .select("id,contact_name,phone,email,address")
    .single();

  if (customer.error || !customer.data) {
    return NextResponse.json({ error: "Your contact details could not be saved." }, { status: 500 });
  }

  await supabase
    .from("profiles")
    .update({ full_name: name, phone: phone || null, email: email || null })
    .eq("id", session.user.id);

  return NextResponse.json({ customer: customer.data });
}