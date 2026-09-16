"use client";

import { useEffect } from "react";

type ClientRuntimeErrorSource = "react-boundary" | "global-boundary" | "window-error" | "unhandled-rejection";

type ClientRuntimeErrorPayload = {
  source: ClientRuntimeErrorSource;
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  pathname: string;
};

const ENDPOINT = "/api/client-runtime-errors";
const MAX_MESSAGE_LENGTH = 1200;
const MAX_STACK_LENGTH = 6000;
const recentReports = new Map<string, number>();

function truncate(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function safePathname() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function normalizeError(value: unknown) {
  if (value instanceof Error) {
    const digest = "digest" in value && typeof value.digest === "string" ? value.digest : undefined;
    return {
      name: value.name || "Error",
      message: value.message || "Unknown client error",
      stack: value.stack,
      digest,
    };
  }

  if (typeof value === "string") {
    return { name: "Error", message: value };
  }

  try {
    return { name: "Error", message: JSON.stringify(value) };
  } catch {
    return { name: "Error", message: "Unknown client error" };
  }
}

function shouldSkip(message: string, filename?: string) {
  if (filename?.startsWith("chrome-extension://") || filename?.startsWith("moz-extension://")) return true;
  if (message.includes("ResizeObserver loop limit exceeded")) return true;
  if (message.includes("ResizeObserver loop completed with undelivered notifications")) return true;
  return false;
}

export function reportClientRuntimeError(source: ClientRuntimeErrorSource, value: unknown, filename?: string) {
  if (typeof window === "undefined") return;

  const normalized = normalizeError(value);
  if (shouldSkip(normalized.message, filename)) return;

  const payload: ClientRuntimeErrorPayload = {
    source,
    name: truncate(normalized.name, 120) ?? "Error",
    message: truncate(normalized.message, MAX_MESSAGE_LENGTH) ?? "Unknown client error",
    stack: truncate(normalized.stack, MAX_STACK_LENGTH),
    digest: truncate(normalized.digest, 160),
    pathname: safePathname(),
  };

  const dedupeKey = `${payload.source}|${payload.pathname}|${payload.name}|${payload.message}`;
  const now = Date.now();
  const lastReportedAt = recentReports.get(dedupeKey) ?? 0;
  if (now - lastReportedAt < 30_000) return;
  recentReports.set(dedupeKey, now);

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
  } catch {
    // Fall through to fetch. Reporting must never become a new app failure.
  }

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function ClientRuntimeErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientRuntimeError("window-error", event.error ?? event.message, event.filename);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportClientRuntimeError("unhandled-rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
