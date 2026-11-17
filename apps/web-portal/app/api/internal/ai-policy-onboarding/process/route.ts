import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { aiQueueEnabled, processAiQueueBatch } from "@/lib/ai-policy-onboarding-queue-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function authorized(request: NextRequest) {
  const token=process.env.INSUREIT_AI_QUEUE_WORKER_TOKEN??"";
  // At least 32 bytes of server-only secret, never exposed as NEXT_PUBLIC_*.
  if (token.length < 32 || token.length > 256) return false;
  const value=request.headers.get("authorization")??"";
  if (!value.startsWith("Bearer ")) return false;
  const submitted=value.slice(7);
  const a=Buffer.from(submitted,"utf8"),b=Buffer.from(token,"utf8");
  return a.length===b.length && timingSafeEqual(a,b);
}

/** Internal unattended extraction; never creates customer/vehicle/policy data. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (!aiQueueEnabled()) return NextResponse.json({error:"AI extraction queue is disabled"},{status:503});
  try {
    return NextResponse.json(await processAiQueueBatch(),{
      headers:{"Cache-Control":"no-store"},
    });
  } catch {
    // Do not log private PDF URLs, policy numbers, names or n8n body.
    return NextResponse.json({error:"AI processing queue is unavailable"},{status:503});
  }
}
