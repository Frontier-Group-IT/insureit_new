import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const GENERIC = "If this email is registered with an active portal account, password reset instructions will be sent.";
const INACTIVE = "Portal access is inactive or suspended. Please contact your administrator to restore access before resetting your password.";

export async function POST(request: Request) {
  let email: string;
  try {
    const input = await request.json() as { email?: unknown };
    email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  const headers = { "Cache-Control": "no-store" };
  try {
    const admin = createSupabaseAdminClient();
    const { data: eligibility, error } = await admin.rpc("portal_password_recovery_eligibility", { p_email: email });
    if (error) throw error;
    if (eligibility === "inactive") {
      return NextResponse.json({ status: "inactive", message: INACTIVE }, { headers });
    }
    if (eligibility !== "active") {
      return NextResponse.json({ status: "processed", message: GENERIC }, { headers });
    }

    const redirectTo = new URL("/reset-password", request.url).toString();
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) {
      // Do not expose account existence or provider error details to anonymous callers.
      console.error("Portal password recovery provider failed:", resetError.code ?? "unknown");
      return NextResponse.json({ status: "processed", message: GENERIC }, { headers });
    }
    return NextResponse.json({
      status: "sent",
      message: "Password reset instructions have been sent. Please check your inbox and spam folder.",
    }, { headers });
  } catch {
    return NextResponse.json({ status: "error", message: "Unable to process the request right now. Please try again later." }, { status: 503, headers });
  }
}
