import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assistantToolDefinitions, callAssistantTool } from "./tools";

export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "insureit-assistant", version: "1.1.0" };
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2026-07-28", "2025-06-18", "2025-03-26"]);

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

export async function GET() {
  return new NextResponse(null, {
    status: 405,
    headers: secureHeaders({ Allow: "POST, OPTIONS" }),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: secureHeaders({ Allow: "POST, OPTIONS" }),
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: secureHeaders({ "WWW-Authenticate": "Bearer" }) },
    );
  }

  const payload = await request.json().catch(() => null) as JsonRpcRequest | JsonRpcRequest[] | null;
  if (!payload) return rpcHttpError(-32700, "Parse error", null, 400);

  if (Array.isArray(payload)) {
    if (!payload.length) return rpcHttpError(-32600, "Invalid Request", null, 400);
    const responses = (await Promise.all(payload.map(handleRpcMessage))).filter(Boolean);
    if (!responses.length) return new NextResponse(null, { status: 202, headers: secureHeaders() });
    return NextResponse.json(responses, { headers: secureHeaders() });
  }

  const response = await handleRpcMessage(payload);
  if (!response) return new NextResponse(null, { status: 202, headers: secureHeaders() });
  return NextResponse.json(response, { headers: secureHeaders() });
}

async function handleRpcMessage(message: JsonRpcRequest) {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id ?? null, -32600, "Invalid Request");
  }

  const id = message.id ?? null;
  const isNotification = message.id === undefined;

  switch (message.method) {
    case "initialize": {
      if (isNotification) return null;
      const requested = cleanString(message.params?.protocolVersion, 32);
      const protocolVersion = requested && SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : "2025-06-18";
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Read-only INSUREIT operational assistant. It can search policy, customer, vehicle, business and claim summaries. Policy-copy downloads remain private and are exposed only through five-minute signed URLs.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return isNotification ? null : rpcResult(id, {});
    case "tools/list":
      return isNotification ? null : rpcResult(id, { tools: assistantToolDefinitions() });
    case "tools/call": {
      if (isNotification) return null;
      const name = cleanString(message.params?.name, 120);
      if (!name) return rpcError(id, -32602, "Tool name is required");
      const args = isRecord(message.params?.arguments) ? message.params.arguments : {};
      const result = await callAssistantTool(name, args);
      if (!result.ok) return rpcResult(id, toolError(result.error));
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result.data) }],
        structuredContent: result.data,
        isError: false,
      });
    }
    default:
      return isNotification ? null : rpcError(id, -32601, "Method not found");
  }
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.INSUREIT_ASSISTANT_API_KEY?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  return Boolean(expected && provided && safeEqual(expected, provided));
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function rpcHttpError(code: number, message: string, id: JsonRpcId, status: number) {
  return NextResponse.json(rpcError(id, code, message), { status, headers: secureHeaders() });
}

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function secureHeaders(extra: Record<string, string> = {}) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}
