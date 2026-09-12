"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CircleStop, Headphones, Mic, PhoneOff, Play, ShieldCheck, Sparkles, Volume2 } from "lucide-react";

type ConnectionState = "idle" | "connecting" | "connected" | "ending" | "error";

type FeedItem = {
  id: string;
  role: "agent" | "customer" | "system";
  text: string;
};

const SAMPLE_PROSPECT = {
  customer: "Rajesh Sharma",
  vehicle: "Mahindra Scorpio N",
  registration: "MP20 AB 1234",
  insurer: "ICICI Lombard",
  expiry: "24 Sep 2026",
  previousIdv: "₹14.2 lakh",
  lastPremium: "₹19,450",
};

const INITIAL_FEED: FeedItem[] = [
  {
    id: "ready",
    role: "system",
    text: "Browser role-play only. No real customer will be called and no prospect data will be changed.",
  },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RenewalVoiceLab() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [elapsed, setElapsed] = useState(0);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = state === "connecting" || state === "connected" || state === "ending";

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = (elapsed % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [elapsed]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      dataChannelRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  function addFeed(role: FeedItem["role"], text: string) {
    if (!text.trim()) return;
    setFeed((current) => [...current, { id: makeId(), role, text: text.trim() }].slice(-24));
  }

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as Record<string, unknown>;
      const type = String(event.type ?? "");

      if (type === "response.audio.started" || type === "response.output_audio.started") {
        setAgentSpeaking(true);
      }
      if (type === "response.audio.done" || type === "response.output_audio.done" || type === "response.done") {
        setAgentSpeaking(false);
      }

      if (type === "response.audio_transcript.done" || type === "response.output_audio_transcript.done") {
        const transcript = typeof event.transcript === "string" ? event.transcript : "";
        addFeed("agent", transcript);
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = typeof event.transcript === "string" ? event.transcript : "";
        addFeed("customer", transcript);
      }

      if (type === "error") {
        const detail = event.error as { message?: string } | undefined;
        setError(detail?.message || "The voice session reported an error.");
      }
    } catch {
      // Ignore non-JSON WebRTC control frames.
    }
  }

  async function startSession() {
    if (isActive) return;
    setError(null);
    setElapsed(0);
    setFeed(INITIAL_FEED);
    setState("connecting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = localStream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

      peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (audioRef.current && remoteStream) {
          audioRef.current.srcObject = remoteStream;
          void audioRef.current.play().catch(() => undefined);
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setState("error");
          setError("Voice connection was interrupted. End the test and start again.");
        }
      };

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => handleRealtimeEvent(String(event.data));
      dataChannel.onopen = () => {
        setState("connected");
        addFeed("system", "Connected. Speak naturally and interrupt the agent whenever you want.");
        timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);

        dataChannel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Begin the browser role-play now. Greet Rajesh Sharma naturally in warm Hinglish, mention that this is regarding the Scorpio N insurance renewal expiring on 24 September 2026, ask permission to continue, and keep the opening under two short sentences.",
            },
          }),
        );
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("Could not create the browser audio session.");

      const response = await fetch("/api/renewal-voice-lab/connect", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || `Voice service returned ${response.status}.`);
      }

      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (caught) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      dataChannelRef.current?.close();
      dataChannelRef.current = null;
      setState("error");
      setError(caught instanceof Error ? caught.message : "Unable to start the voice test.");
    }
  }

  function endSession() {
    if (!isActive && state !== "error") return;
    setState("ending");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setAgentSpeaking(false);
    setState("idle");
    addFeed("system", "Test ended. Start again to run another role-play.");
  }

  return (
    <div className="space-y-3 pb-5" data-renewal-voice-lab="true">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <section className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
        <div className="flex flex-col gap-3 border-b border-[#E7EDF4] px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E8F0FF] text-[#2F62C9]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-[13px] font-extrabold text-[#172B4D]">AI Renewal Voice Lab</h1>
              <p className="mt-0.5 text-[9.5px] font-medium text-[#7A8AA0]">Private browser role-play · Hindi / Hinglish / English · no phone call</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF8F3] px-2.5 py-1 text-[8.5px] font-extrabold text-[#18845B]">
              <ShieldCheck className="h-3.5 w-3.5" /> Sandbox mode
            </span>
            <span className="rounded-full bg-[#F1F4F8] px-2.5 py-1 text-[8.5px] font-bold text-[#60728D]">{timerLabel}</span>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="border-b border-[#E8EDF4] bg-[#FBFCFE] p-4 xl:border-b-0 xl:border-r">
            <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#7E8DA2]">Test prospect</p>
            <h2 className="mt-1 text-[14px] font-extrabold text-[#1B2F4E]">{SAMPLE_PROSPECT.customer}</h2>
            <div className="mt-3 space-y-2 text-[9.5px]">
              {[
                ["Vehicle", SAMPLE_PROSPECT.vehicle],
                ["Registration", SAMPLE_PROSPECT.registration],
                ["Current insurer", SAMPLE_PROSPECT.insurer],
                ["Policy expiry", SAMPLE_PROSPECT.expiry],
                ["Previous IDV", SAMPLE_PROSPECT.previousIdv],
                ["Last premium", SAMPLE_PROSPECT.lastPremium],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-[#ECF0F5] pb-2 last:border-b-0">
                  <span className="font-semibold text-[#7D8CA0]">{label}</span>
                  <span className="text-right font-extrabold text-[#263B59]">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-[#DDE7F2] bg-white p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#6C7C92]">Try interrupting with</p>
              <div className="mt-2 space-y-1.5 text-[9px] font-semibold leading-4 text-[#455A76]">
                <p>“Premium pehle batao.”</p>
                <p>“Dealer ne ₹19,000 ka quote diya hai.”</p>
                <p>“Kal 11:30 baje call karna.”</p>
                <p>“Zero dep mein kitna padega?”</p>
              </div>
            </div>
          </aside>

          <div className="p-4">
            <div className="flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-[#E0E7F0] bg-gradient-to-b from-[#FBFDFF] to-[#F6F9FD] px-4 py-6 text-center">
              <div className={`relative grid h-20 w-20 place-items-center rounded-full border ${state === "connected" ? "border-[#B8D1F6] bg-[#EAF2FF]" : "border-[#DDE5EF] bg-white"}`}>
                {state === "connected" ? <span className="absolute inset-[-8px] animate-pulse rounded-full border border-[#C9DAF5]" /> : null}
                {agentSpeaking ? <Volume2 className="h-8 w-8 text-[#2563D8]" /> : <Bot className="h-8 w-8 text-[#3156B8]" />}
              </div>
              <h3 className="mt-4 text-[13px] font-extrabold text-[#1A2F50]">
                {state === "connecting" ? "Connecting secure voice session…" : state === "connected" ? (agentSpeaking ? "Agent is speaking" : "Agent is listening") : "Ready for browser test"}
              </h3>
              <p className="mt-1 max-w-[520px] text-[9.5px] font-medium leading-4 text-[#74859B]">
                Use headphones if possible. The agent should let you interrupt naturally, answer in the language you use, and never invent a premium or policy term.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {!isActive ? (
                  <button type="button" onClick={startSession} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#166EF0] px-4 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(22,110,240,0.2)] transition hover:bg-[#0F60D8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166EF0]/30">
                    <Play className="h-4 w-4" /> Start voice test
                  </button>
                ) : (
                  <button type="button" onClick={endSession} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#C93F4A] px-4 text-[10px] font-extrabold text-white transition hover:bg-[#B23540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C93F4A]/25">
                    <PhoneOff className="h-4 w-4" /> End test
                  </button>
                )}
                <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DCE5F0] bg-white px-3 text-[9px] font-bold text-[#5F718A]">
                  <Mic className="h-3.5 w-3.5" /> Microphone
                </span>
                <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DCE5F0] bg-white px-3 text-[9px] font-bold text-[#5F718A]">
                  <Headphones className="h-3.5 w-3.5" /> Live audio
                </span>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg border border-[#F1C8CC] bg-[#FFF7F8] px-3 py-2.5 text-[9.5px] font-semibold leading-4 text-[#9B3540]">
                {error}
              </div>
            ) : null}

            <div className="mt-3 overflow-hidden rounded-xl border border-[#E0E7F0] bg-white">
              <div className="flex items-center justify-between border-b border-[#E8EDF4] px-3.5 py-2.5">
                <div>
                  <p className="text-[10px] font-extrabold text-[#233A5C]">Conversation monitor</p>
                  <p className="mt-0.5 text-[8.5px] font-medium text-[#8795A8]">Transcript events appear when the voice service supplies them.</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.06em] ${state === "connected" ? "bg-[#EAF8F1] text-[#14815A]" : "bg-[#F0F3F7] text-[#738299]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${state === "connected" ? "bg-[#1AA572]" : "bg-[#9AA7B8]"}`} />
                  {state === "connected" ? "Live" : "Offline"}
                </span>
              </div>
              <div className="max-h-[260px] min-h-[145px] space-y-2 overflow-y-auto bg-[#FBFCFE] p-3">
                {feed.map((item) => (
                  <div key={item.id} className={`flex ${item.role === "customer" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[86%] rounded-lg px-3 py-2 text-[9.5px] font-medium leading-4 ${item.role === "agent" ? "bg-[#E9F1FF] text-[#234A84]" : item.role === "customer" ? "bg-[#173B70] text-white" : "border border-[#E0E7F0] bg-white text-[#6B7C92]"}`}>
                      <p className="mb-0.5 text-[7.5px] font-black uppercase tracking-[0.07em] opacity-70">{item.role === "agent" ? "AI Agent" : item.role === "customer" ? "You" : "System"}</p>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-3">
        {[
          ["Human conversation", "Short replies, interruption-friendly pacing and automatic language matching."],
          ["Safe sandbox", "Uses sample renewal context only. No CRM write, quote generation or customer contact."],
          ["Next milestone", "After voice quality is approved, connect read-only renewal context and controlled tools."],
        ].map(([title, text], index) => (
          <div key={title} className="rounded-xl border border-[#DDE6F0] bg-white p-3.5 shadow-[0_3px_12px_rgba(37,61,103,0.035)]">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF4FF] text-[9px] font-black text-[#3156B8]">0{index + 1}</span>
              <p className="text-[10px] font-extrabold text-[#243A59]">{title}</p>
            </div>
            <p className="mt-2 text-[9px] font-medium leading-4 text-[#74859B]">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
