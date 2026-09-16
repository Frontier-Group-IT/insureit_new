import { NextResponse } from "next/server";

const MAX_MESSAGE_LENGTH = 1200;
const MAX_STACK_LENGTH = 6000;

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function cleanPathname(value: unknown) {
  const pathname = cleanString(value, 500) ?? "/";
  if (!pathname.startsWith("/")) return "/";
  return pathname.split(/[?#]/, 1)[0] || "/";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const source = cleanString(body.source, 80) ?? "unknown";
  const name = cleanString(body.name, 120) ?? "Error";
  const message = cleanString(body.message, MAX_MESSAGE_LENGTH) ?? "Unknown client error";
  const stack = cleanString(body.stack, MAX_STACK_LENGTH);
  const digest = cleanString(body.digest, 160);
  const pathname = cleanPathname(body.pathname);
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown";

  console.error(
    "[client-runtime-error]",
    JSON.stringify({
      source,
      name,
      message,
      stack,
      digest,
      pathname,
      deploymentSha,
      observedAt: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true }, { status: 202 });
}
