import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { aiQueueEnabled, processAiQueueBatch } from "@/lib/ai-policy-onboarding-queue-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function authorized(request: NextRequest, secret: string) {
  // Both scheduler and manual worker tokens must remain private and high entropy.
  if (secret.length < 32 || secret.length > 256) return false;
  const value=request.headers.get("authorization")??"";
  if (!value.startsWith("Bearer ")) return false;
  const submitted=value.slice(7);
  const a=Buffer.from(submitted,"utf8"),b=Buffer.from(secret,"utf8");
  return a.length===b.length && timingSafeEqual(a,b);
}

async function process() {
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

/**
 * Vercel Cron sends a GET with Authorization: Bearer CRON_SECRET.
 * The secret is required; an untrusted user-agent is never enough.
 * Unlike the opt-in GitHub Actions scheduler, this native Pro cron needs no
 * GitHub Actions secret or automatic Git deploy.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request, process.env.CRON_SECRET??""))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  return process();
}

/** Separate optional manual worker endpoint, never a booking action. */
export async function POST(request: NextRequest) {
  if (!authorized(request, process.env.INSUREIT_AI_QUEUE_WORKER_TOKEN??""))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  return process();
}
