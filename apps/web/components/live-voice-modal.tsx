"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Send,
  Code2,
  Loader2,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  files?: Record<string, string>;
  time: string;
}

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  onCodeGenerated?: (files: Record<string, string>) => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      0: SpeechRecognitionResultItem;
      isFinal: boolean;
    };
  };
}

interface WindowWithSpeech extends Window {
  AudioContext?: typeof AudioContext;
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitAudioContext?: typeof AudioContext;
}

// Clean markdown and code blocks for speech reading
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "J'ai généré le code correspondant.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "welcome-live",
    role: "assistant",
    text: "Bonjour ! Je suis Gemini Live. Parlez-moi ou posez-moi vos questions en direct, je vous écoute.",
    time: "En direct",
  },
];

export function LiveVoiceModal({
  isOpen,
  onClose,
  sessionId,
  onCodeGenerated,
}: LiveVoiceModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  // Audio synthesis playback
  const speakResponse = useCallback(
    (text: string) => {
      if (!audioEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel();
      const clean = cleanTextForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Select French voice if available
      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find(
        (v) => v.lang.startsWith("fr") && !v.name.includes("bad"),
      );
      if (frenchVoice) {
        utterance.voice = frenchVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [audioEnabled],
  );

  // Send message to Gemini Live backend
  const sendLiveMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsProcessing(true);
      setInterimTranscript("");

      const userMsg: LiveMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const historyPayload = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.text,
        }));

        const res = await fetch("/api/live/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            sessionId,
          }),
        });

        if (!res.ok) {
          throw new Error("Erreur de communication avec Gemini Live");
        }

        const data = await res.json();
        const aiText = data.text || "J'ai bien reçu votre message.";
        const generatedFiles = data.files;

        const aiMsg: LiveMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: aiText,
          files: generatedFiles && Object.keys(generatedFiles).length > 0 ? generatedFiles : undefined,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, aiMsg]);

        if (generatedFiles && Object.keys(generatedFiles).length > 0) {
          onCodeGenerated?.(generatedFiles);
        }

        speakResponse(aiText);
      } catch (err) {
        console.error("Live voice error:", err);
        const errorMsg: LiveMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Désolé, une erreur s'est produite lors de la génération vocale.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [messages, sessionId, onCodeGenerated, speakResponse],
  );

  // Setup Web Audio Analyser for visual frequency waves
  const setupAudioAnalyser = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const win = window as WindowWithSpeech;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("AudioContext setup notice:", err);
    }
  }, []);

  // Initialize Speech Recognition
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const win = window as WindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn("SpeechRecognition not available in this browser");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "fr-FR";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final && final.trim()) {
          setInterimTranscript("");
          void sendLiveMessage(final);
        }
      };

      recognition.onerror = (e: { error: string }) => {
        console.warn("Recognition error:", e.error);
      };

      recognition.onend = () => {
        if (!isMuted && isOpen) {
          try {
            recognition.start();
          } catch {
            // Already started
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Failed to start SpeechRecognition:", err);
    }
  }, [isMuted, isOpen, sendLiveMessage]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (!isOpen) return;

    void setupAudioAnalyser();
    startListening();
    speakResponse("Bonjour ! Je suis Gemini Live. Parlez-moi ou posez-moi vos questions en direct, je vous écoute.");

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, setupAudioAnalyser, startListening, speakResponse]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[88vh] max-h-[760px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#141210] text-white shadow-2xl">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#c6623f]/30 to-transparent blur-3xl" />

        {/* Modal Header */}
        <div className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#c6623f] to-[#e88d67] shadow-lg shadow-[#c6623f]/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Gemini Live
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                  EN DIRECT
                </span>
              </div>
              <p className="text-xs text-white/50">
                gemini-3.8-live • Conversation vocale en temps réel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
              title={audioEnabled ? "Désactiver le son" : "Activer le son"}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
              title="Fermer la session Live"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Central Audio Orb & Visualizer */}
        <div className="relative flex flex-col items-center justify-center py-6 px-6 shrink-0">
          <div className="relative flex items-center justify-center">
            {/* Pulsing visual halo */}
            <div
              className={`absolute h-40 w-40 rounded-full transition-all duration-300 ${
                isSpeaking
                  ? "bg-[#c6623f]/40 scale-125 blur-xl animate-pulse"
                  : isListening
                    ? "bg-emerald-500/30 scale-110 blur-xl animate-pulse"
                    : "bg-white/10 scale-95 blur-md"
              }`}
            />

            {/* Core Orb */}
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-gradient-to-b from-[#2a2420] to-[#1a1714] shadow-2xl">
              {isSpeaking ? (
                <div className="flex items-center gap-1.5 h-10">
                  {[40, 75, 100, 60, 85].map((height, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-[#e88d67] animate-pulse"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : isListening ? (
                <div className="flex items-center gap-1.5 h-10">
                  {[25, 60, 90, 50, 70].map((base, i) => {
                    const dynamicHeight = Math.max(20, Math.min(100, base * (audioLevel / 40)));
                    return (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75"
                        style={{ height: `${dynamicHeight}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <Radio className="h-10 w-10 text-white/40" />
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-white/90">
              {isProcessing
                ? "Gemini réfléchit..."
                : isSpeaking
                  ? "Gemini parle..."
                  : isListening
                    ? "À votre écoute, parlez librement..."
                    : "Microphone en pause"}
            </p>
            {interimTranscript && (
              <p className="mt-1 text-xs text-[#e88d67] italic font-mono animate-pulse">
                « {interimTranscript} »
              </p>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-[#c6623f] text-white rounded-br-sm"
                    : "bg-white/10 text-white/90 border border-white/10 rounded-bl-sm"
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {msg.files && Object.keys(msg.files).length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-white/80 font-mono">
                      <Code2 className="h-3.5 w-3.5 text-[#e88d67]" />
                      {Object.keys(msg.files).join(", ")}
                    </span>
                    <button
                      onClick={() => onCodeGenerated?.(msg.files!)}
                      className="text-[11px] font-semibold text-[#e88d67] hover:underline"
                    >
                      Ouvrir dans l&apos;éditeur →
                    </button>
                  </div>
                )}
              </div>
              <span className="mt-1 text-[10px] text-white/40 px-1 font-mono">
                {msg.role === "user" ? "Vous" : "Gemini"} • {msg.time}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Live Controls */}
        <div className="relative z-10 shrink-0 border-t border-white/10 bg-[#191613] p-4">
          <div className="flex items-center gap-3">
            {/* Mic Toggle Button */}
            <button
              onClick={() => {
                if (isListening) {
                  if (recognitionRef.current) recognitionRef.current.stop();
                  setIsListening(false);
                  setIsMuted(true);
                } else {
                  setIsMuted(false);
                  startListening();
                }
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition shadow-lg ${
                isListening
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 ring-4 ring-emerald-500/20"
                  : "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              }`}
              title={isListening ? "Couper le micro" : "Activer le micro"}
            >
              {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            {/* Fallback Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && transcript.trim()) {
                    void sendLiveMessage(transcript);
                    setTranscript("");
                  }
                }}
                placeholder="Parlez au micro ou tapez un message..."
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
              />
            </div>

            <Button
              onClick={() => {
                if (transcript.trim()) {
                  void sendLiveMessage(transcript);
                  setTranscript("");
                }
              }}
              disabled={!transcript.trim() || isProcessing}
              className="h-12 w-12 shrink-0 rounded-2xl bg-[#c6623f] hover:bg-[#b05332] text-white p-0 disabled:opacity-40"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
