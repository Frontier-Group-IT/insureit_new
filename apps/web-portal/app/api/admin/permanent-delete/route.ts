import { NextResponse } from "next/server";
import {
  permanentDeleteEntity,
  type PermanentDeleteKind,
} from "@/lib/admin-permanent-delete";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPermanentDeleteKind(value: unknown): value is PermanentDeleteKind {
  return value === "user" || value === "branch" || value === "partner";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      kind?: unknown;
      id?: unknown;
      relatedId?: unknown;
    } | null;

    if (!body || !isPermanentDeleteKind(body.kind) || typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json(
        { status: "error", message: "Invalid permanent-delete request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const relatedId = typeof body.relatedId === "string" && body.relatedId.trim()
      ? body.relatedId.trim()
      : undefined;

    const result = await permanentDeleteEntity(body.kind, body.id.trim(), relatedId);

    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 409,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Permanent deletion could not be completed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
