import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2, Bot, User, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/truth-chat`;

const SUGGESTIONS = [
  "How do you detect a deepfake video?",
  "What EXIF clues reveal image manipulation?",
  "List common propaganda techniques.",
  "How do I verify a suspicious URL?",
];

// Forensic knowledge engine for instant, smooth offline intelligence
function getForensicResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("video") || q.includes("deepfake")) {
    return `### 🎥 Video Deepfake Detection Signals

When analyzing suspicious video streams, forensic systems examine:

1. **Facial Boundary Inconsistencies:** Look for subtle blurring or jitter along the jawline, neck, and hairline during rapid head rotation.
2. **Temporal Blink & Eye Dynamics:** Early GAN algorithms struggle with realistic blinking rates, asymmetric pupil reflections, or unnatural cornea light glints.
3. **Phoneme & Lip Synchronization:** Check whether high-frequency consonants (such as **P, B, M**) match mouth closure timing.
4. **Frame-to-Frame Compression Noise:** Genuine cameras exhibit uniform sensor noise (PRNU). Spliced deepfakes often reveal noise frequency discontinuities between the face crop and background.`;
  }

  if (q.includes("exif") || q.includes("image") || q.includes("photo") || q.includes("diffusion")) {
    return `### 🔍 Image & EXIF Forensic Indicators

1. **Metadata & Software Signatures:** Check EXIF for software tags like *Photoshop*, *GIMP*, or missing camera make and model fields. AI generative models often strip or randomize EXIF headers.
2. **FFT Frequency Spectrum Analysis:** Generative models (Stable Diffusion, Midjourney) produce distinct grid-like spectral artifacts in Fourier space that do not appear in natural camera sensor captures.
3. **Lighting & Reflection Consistency:** Compare shadow directions from multiple light sources. AI images frequently have conflicting catchlights in eyes or mismatched cast shadows.
4. **Fine Geometry Artifacts:** Inspect earlobes, teeth alignment, hands, text inside the image, and background geometric symmetry.`;
  }

  if (q.includes("propaganda") || q.includes("bias") || q.includes("fake news")) {
    return `### 📰 Propaganda & Manipulation Detection

1. **Emotional Triggering & Fear Appeals:** Sensationalist headlines designed to bypass critical thinking and evoke acute anger or urgency.
2. **False Dilemmas (Either/Or):** Oversimplifying complex geopolitical or social issues into binary absolutes.
3. **Source Fabrication & Quoting Out of Context:** Attributing statements to recognized authorities without citations, links, or verifiable transcripts.
4. **Wire Corroboration:** Legitimate breaking events are corroborated simultaneously across international wire services (Reuters, AP, AFP). Social-media-only claims lacking wire coverage carry a high risk of fabrication.`;
  }

  if (q.includes("url") || q.includes("link") || q.includes("domain") || q.includes("website")) {
    return `### 🌐 URL & Web Destination Verification

1. **Domain Age (RDAP / WHOIS):** Newly registered domains (under 30–60 days old) impersonating news or banking portals are strong phishing/misinformation indicators.
2. **Typosquatting & Unicode Spoofing:** Watch for lookalike characters (Cyrillic *а* instead of Latin *a*, hyphens, or unusual TLDs like *.top*, *.xyz*).
3. **SSL Certificate Chain:** Legitimate organizations use recognized root CAs with established domain validation.
4. **Redirect Chains:** Verify whether the link passes through intermediate URL shorteners hiding the actual destination IP.`;
  }

  return `### 🛡️ VeriFact Forensic Truth Assistant

I can assist you with multi-layer forensic intelligence:

- **Image Analysis:** Diffusion artifacts, EXIF inconsistencies, and sensor PRNU audit.
- **Text & News Claims:** Fact-checking corroboration, propaganda classification, and bias scoring.
- **Video Temporal Audits:** Frame-level GAN detection, facial boundary analysis, and lip-sync validation.
- **Audio Forensics:** Voice clone detection and spectral voiceprint anomalies.
- **URL & Document Verifications:** WHOIS domain age, threat intelligence, and PDF tampering detection.

Feel free to ask a specific question or paste a finding for forensic review!`;
}

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Graceful fallback in sandboxed environments
  }
}

export function TruthAssistant() {
  const [open, setOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return safeGetStorage("verifact_truth_assistant_hidden") === "true";
  });
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hello — I'm your **Forensic Truth Assistant**. Ask me about deepfakes, manipulated images, propaganda, or suspicious URLs. I can also walk you through any scan result.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Listen for external toggle events (e.g. from AppHeader or AppFooter)
  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ open?: boolean; visible?: boolean }>) => {
      if (e.detail?.visible !== undefined) {
        setIsDismissed(!e.detail.visible);
        safeSetStorage("verifact_truth_assistant_hidden", String(!e.detail.visible));
      }
      if (e.detail?.open !== undefined) {
        setOpen(e.detail.open);
      } else {
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("toggle-truth-assistant", handleToggle as EventListener);
    return () => window.removeEventListener("toggle-truth-assistant", handleToggle as EventListener);
  }, []);

  const handleDismiss = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDismissed(true);
    setOpen(false);
    safeSetStorage("verifact_truth_assistant_hidden", "true");
  }, []);

  const handleRestore = useCallback(() => {
    setIsDismissed(false);
    safeSetStorage("verifact_truth_assistant_hidden", "false");
    setOpen(true);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    let responded = false;

    // First attempt to stream from edge API if configured
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg].slice(-12) }),
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let buffer = "";
        let done = false;

        while (!done) {
          const { done: d, value } = await reader.read();
          if (d) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") { done = true; break; }
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) {
                acc += c;
                responded = true;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && prev.length > messages.length + 1) {
                    return prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, content: acc } : m));
                  }
                  return [...prev, { role: "assistant", content: acc }];
                });
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      }
    } catch {
      // Fall through to forensic knowledge responder
    }

    // Smooth offline fallback if edge API is unavailable or non-responsive
    if (!responded) {
      const fallbackText = getForensicResponse(trimmed);
      let index = 0;
      const chunkSize = 8;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const interval = setInterval(() => {
        index += chunkSize;
        const currentSlice = fallbackText.slice(0, index);
        setMessages((prev) =>
          prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, content: currentSlice } : m))
        );

        if (index >= fallbackText.length) {
          clearInterval(interval);
          setLoading(false);
        }
      }, 15);
      return;
    }

    setLoading(false);
  }

  // If user dismissed the floating assistant, render nothing on screen (re-activatable from header)
  if (isDismissed) {
    return null;
  }

  return (
    <>
      {/* Floating Launcher with Dismiss & Expand controls */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 p-1 rounded-full glass-panel bg-card/85 backdrop-blur-2xl border border-white/15 dark:border-white/[0.08] shadow-2xl shadow-black/25 group"
      >
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-semibold text-xs sm:text-sm hover:brightness-105 active:scale-[0.98] transition-all shadow-md shadow-primary/25"
          aria-label="Open Truth Assistant"
        >
          <Sparkles className="h-4 w-4" />
          <span>Truth Assistant</span>
        </button>

        {/* Optional dismiss button to hide the assistant */}
        <button
          onClick={handleDismiss}
          title="Hide Truth Assistant (Optional)"
          aria-label="Hide Truth Assistant"
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="truth-assistant-backdrop"
            className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
        {open && (
          <motion.div
            key="truth-assistant-modal"
            className={cn(
              "fixed z-50 right-2 bottom-2 sm:right-6 sm:bottom-6",
              "w-[calc(100vw-1rem)] sm:w-[440px] h-[82vh] sm:h-[620px] max-h-[760px]",
              "rounded-2xl border border-white/15 dark:border-white/[0.08] bg-card/90 dark:bg-card/80 backdrop-blur-2xl shadow-2xl",
              "flex flex-col overflow-hidden"
            )}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-gradient-to-r from-primary/10 via-indigo-500/10 to-primary/5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-md text-primary-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold leading-none text-foreground">Truth Assistant</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Forensic AI Truth & Media Guide</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  title="Hide assistant launcher"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages viewport */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex gap-2.5", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm mt-0.5",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border/50"
                    )}
                  >
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 max-w-[85%] text-xs sm:text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted/50 dark:bg-muted/40 backdrop-blur-md border border-border/40 text-foreground rounded-tl-sm"
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:my-1.5 prose-code:text-xs">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && messages[messages.length - 1]?.role === "user" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center border border-border/50">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 bg-muted/50 border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                    <span>Synthesizing forensic evidence…</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/50 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-border/50 p-3 flex items-end gap-2 bg-background/50"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about deepfakes, claims, URLs, or image artifacts…"
                className="min-h-[42px] max-h-32 resize-none text-xs sm:text-sm bg-background/70 rounded-xl"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-xl h-10 w-10 btn-tactile bg-primary text-primary-foreground"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}