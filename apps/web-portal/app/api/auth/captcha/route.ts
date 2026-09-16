import { NextResponse } from "next/server";
import { createLoginCaptcha, verifyLoginCaptcha } from "@/lib/login-captcha";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const captcha = createLoginCaptcha();
    return NextResponse.json(captcha, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[login-captcha] challenge generation failed", error);
    return NextResponse.json({ error: "Captcha is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; answer?: unknown };
    if (typeof body.token !== "string" || typeof body.answer !== "string") {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    return NextResponse.json(
      { valid: verifyLoginCaptcha(body.token, body.answer) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
