"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mic, Square } from "lucide-react";

const ALLOWED_SARVAM_HOSTS = ["sarvam.ai", "www.sarvam.ai", "apps.sarvam.ai", "platform.sarvam.ai", "indus.sarvam.ai"];

function isAllowedSarvamUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" && ALLOWED_SARVAM_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function sanitizeNode(node: Element): Element | null {
  const tag = node.tagName.toLowerCase();
  const allowed = tag === "div" || tag === "span" || tag === "button" || tag === "style" || tag.includes("-");
  if (!allowed) return null;

  const clone = node.cloneNode(false) as Element;
  for (const attribute of Array.from(clone.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on") || name === "srcdoc") clone.removeAttribute(attribute.name);
    if ((name === "src" || name === "href") && attribute.value && !isAllowedSarvamUrl(attribute.value)) clone.removeAttribute(attribute.name);
  }

  for (const child of Array.from(node.children)) {
    const safeChild = sanitizeNode(child);
    if (safeChild) clone.appendChild(safeChild);
  }

  if (node.childNodes.length && !node.children.length) clone.textContent = node.textContent;
  return clone;
}

type Props = {
  embedSnippet: string | null;
};

export default function SarvamVoiceAgentEmbed({ embedSnippet }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"not-configured" | "loading" | "ready" | "error">(embedSnippet ? "loading" : "not-configured");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!embedSnippet || !hostRef.current) return;

    const host = hostRef.current;
    host.replaceChildren();
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(embedSnippet, "text/html");
    const scripts = Array.from(documentFragment.body.querySelectorAll("script"));

    try {
      for (const child of Array.from(documentFragment.body.children)) {
        if (child.tagName.toLowerCase() === "script") continue;
        const safeChild = sanitizeNode(child);
        if (safeChild) host.appendChild(safeChild);
      }

      if (!scripts.length) throw new Error("The configured Sarvam embed snippet does not contain a script.");

      let loaded = 0;
      for (const sourceScript of scripts) {
        const src = sourceScript.getAttribute("src");
        if (!src || !isAllowedSarvamUrl(src)) throw new Error("The Sarvam embed script URL is missing or not on an approved Sarvam domain.");

        const script = document.createElement("script");
        for (const attribute of Array.from(sourceScript.attributes)) {
          const name = attribute.name.toLowerCase();
          if (!name.startsWith("on") && name !== "srcdoc") script.setAttribute(attribute.name, attribute.value);
        }
        script.async = sourceScript.async !== false;
        script.addEventListener("load", () => {
          loaded += 1;
          if (loaded === scripts.length) {
            setState("ready");
            setMessage(null);
          }
        });
        script.addEventListener("error", () => {
          setState("error");
          setMessage("Sarvam's web agent script could not be loaded. Check the current embed snippet and deployment settings in Sarvam Voice Agents.");
        });
        host.appendChild(script);
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Sarvam Voice Agent could not be initialized.");
    }

    return () => host.replaceChildren();
  }, [embedSnippet]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#071D49] text-white"><Mic className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Sarvam Full Voice Agent</p>
            <p className="text-xs text-slate-500">Official Sarvam Voice Agents web channel · browser microphone test</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {state === "ready" ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-emerald-700">Widget ready</span></> : null}
          {state === "loading" ? <><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" /><span className="text-amber-700">Loading widget</span></> : null}
          {state === "not-configured" ? <><Square className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600">Awaiting Sarvam embed</span></> : null}
          {state === "error" ? <><AlertTriangle className="h-4 w-4 text-rose-600" /><span className="text-rose-700">Needs attention</span></> : null}
        </div>
      </div>

      {state === "not-configured" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">Sarvam Full is prepared but not connected to a Sarvam agent yet.</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">Create and commit the INSUREIT renewal agent in Sarvam Voice Agents, choose the Web channel, copy Sarvam's official Embed snippet, then store that snippet server-side as <code className="rounded bg-white/70 px-1 py-0.5">SARVAM_VOICE_AGENT_EMBED_SNIPPET</code>. Do not put a Sarvam API key or secret in the embed snippet.</p>
        </div>
      ) : null}

      {message ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</div> : null}

      <div ref={hostRef} className="min-h-[420px] rounded-2xl border border-dashed border-slate-200 bg-white p-3" aria-label="Sarvam Voice Agent web embed" />
    </div>
  );
}
