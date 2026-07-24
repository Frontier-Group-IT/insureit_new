import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function authorizePanWorker(request: NextRequest) {
  const expected = process.env.PAN_VERIFICATION_WORKER_KEY?.trim();
  const provided = request.headers.get("x-pan-worker-key")?.trim();

  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
