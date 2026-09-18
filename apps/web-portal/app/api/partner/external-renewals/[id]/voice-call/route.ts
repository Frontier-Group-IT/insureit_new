import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = new URL(`/partner/renewals/external/${encodeURIComponent(id)}`, request.url);
  target.searchParams.set("voice_error", "AI voice calling is controlled by INSUREIT IT Super User.");
  return NextResponse.redirect(target, 303);
}
