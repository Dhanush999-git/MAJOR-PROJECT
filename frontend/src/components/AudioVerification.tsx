import { useState, useRef } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload, Loader2, Mic, ShieldCheck, ShieldAlert, AlertTriangle,
  Sparkles, Waves, Activity, FileAudio, Play, Pause,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { SpeedMetrics } from "@/lib/analysisTypes";

interface ForensicScores {
  syntheticSpeech: number;
  voiceCloneLikelihood: number;
  spliceDetection: number;
  speakerInconsistency: number;
  spectrogramAnomaly: number;
  unnaturalSilence: number;
  roboticPitchVariation: number;
  backgroundNoiseAnomaly: number;
  codecReencoding: number;
}
interface TamperingEvent {
  timestampSec: number;
  type: "splice" | "insertion" | "cut" | "speaker-change" | "noise-loop";
  severity: "low" | "medium" | "high";
  note: string;
}
interface AudioResult {
  verdictTag: "REAL AUDIO" | "AI GENERATED VOICE" | "VOICE CLONED" | "MANIPULATED AUDIO" | "EDITED SPEECH" | "SUSPICIOUS CONTENT";
  confidence: number;
  category: "authentic" | "suspicious" | "fake";
  isAuthentic: boolean;
  probabilities: {
    real: number; aiGenerated: number; voiceCloned: number;
    manipulated: number; editedSpeech: number; suspicious: number;
  };
  transcript: string;
  language?: string;
  speakerCount?: number;
  durationSec?: number;
  forensicScores?: ForensicScores;
  reasons?: string[];
  tamperingEvents?: TamperingEvent[];
  transcriptFakeNews?: {
    verdict: "Real" | "Misleading" | "Fake" | "N/A";
    probabilities: { real: number; misleading: number; fake: number };
    summary: string;
  };
  aiExplanation?: string;
  speedMetrics?: SpeedMetrics;
  executionTimeMs?: number;
}

const VERDICT_STYLES: Record<string, { ring: string; text: string; gradient: string; icon: JSX.Element }> = {
  "REAL AUDIO":          { ring: "ring-success/40",     text: "text-success",     gradient: "from-success/30 to-success/5",         icon: <ShieldCheck className="w-7 h-7" /> },
  "AI GENERATED VOICE":  { ring: "ring-destructive/50", text: "text-destructive", gradient: "from-destructive/30 to-primary/10",    icon: <Sparkles className="w-7 h-7" /> },
  "VOICE CLONED":        { ring: "ring-destructive/50", text: "text-destructive", gradient: "from-destructive/35 to-accent/10",    icon: <Mic className="w-7 h-7" /> },
  "MANIPULATED AUDIO":   { ring: "ring-destructive/40", text: "text-destructive", gradient: "from-destructive/30 to-destructive/5", icon: <ShieldAlert className="w-7 h-7" /> },
  "EDITED SPEECH":       { ring: "ring-warning/40",     text: "text-warning",     gradient: "from-warning/25 to-warning/5",         icon: <AlertTriangle className="w-7 h-7" /> },
  "SUSPICIOUS CONTENT":  { ring: "ring-warning/40",     text: "text-warning",     gradient: "from-warning/25 to-warning/5",         icon: <AlertTriangle className="w-7 h-7" /> },
};

const SEVERITY_CLS: Record<string, string> = {
  low: "bg-muted/40 border-border/50 text-foreground",
  medium: "bg-warning/15 border-warning/40 text-warning",
  high: "bg-destructive/15 border-destructive/40 text-destructive",
};

function fmtTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const idx = r.indexOf(",");
      resolve(idx >= 0 ? r.slice(idx + 1) : r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import { useAnalysis } from "@/contexts/AnalysisContext";

export const AudioVerification = () => {
  const { audioState, runAudioAnalysis } = useAnalysis();
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const isAnalyzing = audioState.isAnalyzing;
  const result = audioState.result as AudioResult | null;

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      toast.error("Please upload an audio file (mp3, wav, m4a, ogg, flac).");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("Audio file too large. Max 25MB.");
      return;
    }
    setFile(f);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setIsPlaying(true); }
    else { el.pause(); setIsPlaying(false); }
  };

  const analyze = async () => {
    if (!file) { toast.error("Please upload an audio file first."); return; }
    const audioBase64 = await fileToBase64(file);
    runAudioAnalysis(audioBase64, file.type, file.name);
  };

  const v = result ? VERDICT_STYLES[result.verdictTag] : null;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card className="glass-panel p-6">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
          className="border-2 border-dashed border-border/60 hover:border-primary/60 rounded-xl p-10 text-center cursor-pointer transition-all"
        >
          <input
            ref={inputRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-gradient-primary glass-glow">
              <FileAudio className="w-10 h-10 text-primary-foreground" />
            </div>
            <p className="font-medium">
              {file ? file.name : "Drop audio here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground">
              MP3, WAV, M4A, OGG, FLAC · max 25MB
            </p>
          </div>
        </div>

        {audioUrl && (
          <div className="mt-4 flex items-center gap-3 glass-panel p-3 rounded-lg">
            <Button size="icon" variant="ghost" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <audio
              ref={audioRef} src={audioUrl} className="flex-1"
              controls onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)}
            />
          </div>
        )}

        <Button
          onClick={analyze} disabled={!file || isAnalyzing}
          className="w-full mt-4 bg-gradient-primary"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running 6-layer forensic analysis…</>
          ) : (
            <><Waves className="w-4 h-4 mr-2" /> Analyze audio</>
          )}
        </Button>
      </Card>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && v && (
          <motion.div
            key="audio-result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Hero verdict */}
            <Card className={`glass-panel p-6 ring-2 ${v.ring} bg-gradient-to-br ${v.gradient} animate-glass-ripple`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl bg-background/40 ${v.text}`}>{v.icon}</div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Forensic verdict</div>
                  <div className={`text-3xl font-bold ${v.text}`}>{result.verdictTag}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Confidence: <span className={`font-semibold ${v.text}`}>{result.confidence}%</span>
                    {result.durationSec ? ` · Duration: ${fmtTime(result.durationSec)}` : ""}
                    {result.speakerCount ? ` · Speakers: ${result.speakerCount}` : ""}
                    {result.language ? ` · Language: ${result.language}` : ""}
                  </div>
                </div>
              </div>
            </Card>

            {/* Probability breakdown */}
            <Card className="glass-panel p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Probability breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["Real", result.probabilities.real, "bg-success"],
                  ["AI Generated", result.probabilities.aiGenerated, "bg-destructive"],
                  ["Voice Cloned", result.probabilities.voiceCloned, "bg-destructive"],
                  ["Manipulated", result.probabilities.manipulated, "bg-destructive"],
                  ["Edited Speech", result.probabilities.editedSpeech, "bg-warning"],
                  ["Suspicious", result.probabilities.suspicious, "bg-warning"],
                ].map(([label, val, color]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{val as number}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className={`h-full ${color as string} transition-all`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Detail tabs */}
            <Card className="glass-panel p-6">
              <Tabs defaultValue="reasons">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="reasons">Reasons</TabsTrigger>
                  <TabsTrigger value="forensic">Forensic scores</TabsTrigger>
                  {result.tamperingEvents?.length ? <TabsTrigger value="events">Tampering events</TabsTrigger> : null}
                  {result.transcript ? <TabsTrigger value="transcript">Transcript</TabsTrigger> : null}
                  {result.transcriptFakeNews && result.transcriptFakeNews.verdict !== "N/A" ? (
                    <TabsTrigger value="fakenews">Fake-news on speech</TabsTrigger>
                  ) : null}
                  {result.aiExplanation ? <TabsTrigger value="explain">AI explanation</TabsTrigger> : null}
                </TabsList>

                <TabsContent value="reasons" className="mt-4">
                  {result.reasons?.length ? (
                    <ul className="space-y-2">
                      {result.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary mt-0.5">•</span><span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No specific reasons returned.</p>}
                </TabsContent>

                <TabsContent value="forensic" className="mt-4">
                  {result.forensicScores ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(result.forensicScores).map(([k, val]) => (
                        <div key={k}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span className="font-semibold">{val}%</span>
                          </div>
                          <Progress value={val as number} className="h-2" />
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No forensic scores.</p>}
                </TabsContent>

                <TabsContent value="events" className="mt-4">
                  <div className="space-y-2">
                    {result.tamperingEvents?.map((e, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${SEVERITY_CLS[e.severity]}`}>
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="capitalize">{e.type.replace("-", " ")}</span>
                          <span>{fmtTime(e.timestampSec)}</span>
                        </div>
                        <p className="text-xs opacity-80 mt-1">{e.note}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="transcript" className="mt-4">
                  <div className="text-xs text-muted-foreground mb-2">
                    Whisper speech-to-text {result.language ? `· ${result.language}` : ""}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.transcript}</p>
                </TabsContent>

                <TabsContent value="fakenews" className="mt-4">
                  {result.transcriptFakeNews && (
                    <div className="space-y-3">
                      <div className="text-sm">
                        Verdict on spoken content:{" "}
                        <span className="font-semibold">{result.transcriptFakeNews.verdict}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {(["real", "misleading", "fake"] as const).map((k) => (
                          <div key={k}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize text-muted-foreground">{k}</span>
                              <span className="font-semibold">{result.transcriptFakeNews!.probabilities[k]}%</span>
                            </div>
                            <Progress value={result.transcriptFakeNews!.probabilities[k]} className="h-2" />
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{result.transcriptFakeNews.summary}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="explain" className="mt-4">
                  <p className="text-sm leading-relaxed">{result.aiExplanation}</p>
                </TabsContent>
              </Tabs>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
