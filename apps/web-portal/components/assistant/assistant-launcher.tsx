"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LoaderCircle, RotateCcw, Send, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { NavigationCatalogueSection } from "@/lib/navigation-catalogue";
import { limitAssistantReplyLinks, normalizeAssistantReply, type AssistantLink } from "@/components/assistant/assistant-response";

type Message = { id: number; role: "user" | "assistant"; text: string; links?: AssistantLink[] };
type Props = { navigation: NavigationCatalogueSection[] };
const REQUEST_TIMEOUT_MS = 20_000;

function assistantNavigation(sections: NavigationCatalogueSection[]) {
  return sections.map((section) => ({
    label: section.label,
    routes: section.items.flatMap((node) => node.kind === "group"
      ? node.items.map((entry) => ({ label: `${node.label} · ${entry.label}`, href: entry.href }))
      : [{ label: node.label, href: node.href }]),
  }));
}

export function AssistantLauncher({ navigation }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "timeout" | "no-answer">("idle");
  const [lastQuestion, setLastQuestion] = useState("");
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const availableNavigation = assistantNavigation(navigation);
  const allowedHrefs = new Set(availableNavigation.flatMap((section) => section.routes.map((route) => route.href)));

  function close() {
    abortRef.current?.abort();
    setStatus("idle");
    setOpen(false);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }

  function launch() {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function ask(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || status === "loading") return;
    setLastQuestion(cleanQuestion);
    setDraft("");
    setMessages((current) => [...current, { id: nextId.current++, role: "user", text: cleanQuestion }]);
    setStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          message: cleanQuestion,
          pathname,
          history: messages.slice(-10).map(({ role, text }) => ({ role, text })),
        }),
      });
      if (!response.ok) throw new Error(`assistant_${response.status}`);
      const normalizedReply = normalizeAssistantReply(await response.json());
      if (!normalizedReply) { setStatus("no-answer"); return; }
      const reply = limitAssistantReplyLinks(normalizedReply, allowedHrefs);
      setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: reply.text, links: reply.links }]);
      setStatus("idle");
    } catch {
      if (controller.signal.aborted && !timedOut) return;
      setStatus(timedOut ? "timeout" : "error");
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(draft); }

  return <>
    <button type="button" onClick={launch} aria-haspopup="dialog" aria-expanded={open} className="fixed bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+70px)] right-3 z-[85] inline-flex h-12 items-center gap-2 rounded-full bg-[#6759ff] px-4 text-xs font-bold text-white shadow-[0_16px_40px_rgba(55,48,163,.35)] hover:bg-[#5748e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6759ff]/30 md:bottom-6 md:right-6">
      <Bot className="h-5 w-5" aria-hidden="true" /> Ask INSUREIT
    </button>
    {open ? <div className="fixed inset-0 z-[100] bg-[#081127]/45 md:bg-[#081127]/20" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="assistant-title" className="absolute inset-x-2 bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+70px)] flex max-h-[calc(100dvh-96px)] flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(8,17,39,.32)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(430px,100vw)] md:rounded-none md:border-y-0 md:border-r-0">
        <header className="flex shrink-0 items-center justify-between border-b border-[#DDE5F0] bg-[#111A35] px-4 py-3 text-white">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#6759ff]"><Bot className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="assistant-title" className="text-sm font-bold">INSUREIT Assistant</h2><p className="text-[10px] text-white/65">Navigation and operational guidance</p></div></div>
          <button type="button" onClick={close} aria-label="Close assistant" className="grid h-10 w-10 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4" aria-live="polite" aria-busy={status === "loading"}>
          {!messages.length ? <div className="rounded-2xl border border-[#DDE5F0] bg-white p-4 text-sm text-[#475569]"><p className="font-semibold text-[#14213D]">How can I help?</p><p className="mt-1 text-xs leading-5">Ask where to find an INSUREIT workflow or how to continue from this page.</p></div> : null}
          {messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-[#6759ff] text-white" : "border border-[#DDE5F0] bg-white text-[#263650]"}`}><p className="whitespace-pre-wrap break-words">{message.text}</p>{message.links?.length ? <div className="mt-2 flex flex-wrap gap-2">{message.links.map((link) => <Link key={`${message.id}:${link.href}:${link.label}`} href={link.href} onClick={close} className="rounded-lg border border-[#C9D4E5] bg-[#F7F9FC] px-2.5 py-1.5 font-semibold text-[#4F46E5] hover:bg-white">{link.label}</Link>)}</div> : null}</div>)}
          {status === "loading" ? <div className="flex items-center gap-2 text-xs text-[#64748B]"><LoaderCircle className="h-4 w-4 animate-spin" /> Thinking…</div> : null}
          {status === "error" || status === "timeout" || status === "no-answer" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p>{status === "timeout" ? "The assistant took too long to respond." : status === "no-answer" ? "The assistant did not return an answer." : "The assistant could not respond. Please try again."}</p><button type="button" onClick={() => void ask(lastQuestion)} className="mt-2 inline-flex items-center gap-1 font-bold text-amber-950"><RotateCcw className="h-3.5 w-3.5" /> Retry</button></div> : null}
        </div>
        <form onSubmit={submit} className="shrink-0 border-t border-[#DDE5F0] bg-white p-3"><label htmlFor="assistant-question" className="sr-only">Ask INSUREIT Assistant</label><div className="flex items-center gap-2"><input ref={inputRef} id="assistant-question" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={status === "loading"} maxLength={2_000} autoComplete="off" placeholder="Ask about this workspace…" className="min-h-11 flex-1 rounded-xl border border-[#C9D4E5] px-3 text-sm outline-none focus:border-[#6759ff] focus:ring-2 focus:ring-[#6759ff]/15" /><button type="submit" disabled={!draft.trim() || status === "loading"} aria-label="Send question" className="grid h-11 w-11 place-items-center rounded-xl bg-[#6759ff] text-white disabled:cursor-not-allowed disabled:opacity-45"><Send className="h-4 w-4" /></button></div><p className="mt-2 text-[10px] text-[#7A889D]">Links are limited to pages available in your navigation. Current page is context only.</p></form>
      </div>
    </div> : null}
  </>;
}
