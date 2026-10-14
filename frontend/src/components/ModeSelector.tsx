import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image, Video, Link2, Mic, BookOpen, FileCheck2, ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/components/ui/GlassCard";
import { type AnalysisMode } from "@/contexts/AnalysisContext";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  onSelectMode: (mode: AnalysisMode) => void;
}

export const ModeSelector = ({ onSelectMode }: ModeSelectorProps) => {
  const [hoveredMode, setHoveredMode] = useState<AnalysisMode | null>(null);

  const modes = [
    {
      id: "image" as const,
      icon: Image,
      title: "Image Analysis",
      badge: "Vision AI & FFT",
      description: "Detect AI-generated synthetic images, diffusion artifacts & EXIF inconsistencies",
      accent: "from-blue-500/25 to-indigo-500/15 text-blue-400 border-blue-500/30",
      glow: "rgba(59, 130, 246, 0.18)",
    },
    {
      id: "text" as const,
      icon: FileText,
      title: "Text Fake-News Detection",
      badge: "NLP & Fact-Checking",
      description: "Cross-examine claims with live news wire corroboration, bias & propaganda scoring",
      accent: "from-violet-500/25 to-purple-500/15 text-violet-400 border-violet-500/30",
      glow: "rgba(139, 92, 246, 0.18)",
    },
    {
      id: "video" as const,
      icon: Video,
      title: "Video Deepfake Check",
      badge: "Temporal Frame Audit",
      description: "Identify facial reenactment, frame-to-frame inconsistencies & GAN generation artifacts",
      accent: "from-sky-500/25 to-blue-500/15 text-sky-400 border-sky-500/30",
      glow: "rgba(14, 165, 233, 0.18)",
    },
    {
      id: "audio" as const,
      icon: Mic,
      title: "Audio Forensic Analysis",
      badge: "Acoustic & Spectrogram",
      description: "Detect synthetic voices, voice cloning, unnatural pitch transitions & audio splicing",
      accent: "from-amber-500/25 to-orange-500/15 text-amber-400 border-amber-500/30",
      glow: "rgba(245, 158, 11, 0.18)",
    },
    {
      id: "url" as const,
      icon: Link2,
      title: "URL Fact-Check",
      badge: "Domain & Threat Intel",
      description: "Verify domain WHOIS age, SSL trust chain, typosquatting & Safe Browsing threats",
      accent: "from-emerald-500/25 to-teal-500/15 text-emerald-400 border-emerald-500/30",
      glow: "rgba(16, 185, 129, 0.18)",
    },
    {
      id: "document" as const,
      icon: FileCheck2,
      title: "Document Verification",
      badge: "OCR & Signature Audit",
      description: "Detect forged PDFs, font substitutions, tampered stamps & metadata anomalies",
      accent: "from-indigo-500/25 to-blue-500/15 text-indigo-400 border-indigo-500/30",
      glow: "rgba(99, 102, 241, 0.18)",
    },
  ];

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-12 bg-gradient-hero">
      <div className="w-full max-w-6xl space-y-10">
        {/* Header Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-md text-xs font-semibold text-primary uppercase tracking-wider shadow-sm shadow-primary/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Forensic Intelligence Suite</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
            AI Forensic Verification Platform
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Select a specialized forensic analysis modality to begin comprehensive multi-layer authenticity verification.
          </p>

          {/* Quick Gliding Bubble Navigation Pill Bar */}
          <div className="pt-2 flex justify-center">
            <nav
              aria-label="Quick Modality Switcher"
              className="inline-flex items-center p-1.5 rounded-2xl glass-panel bg-card/60 border border-white/10 dark:border-white/[0.08] shadow-lg max-w-full overflow-x-auto"
            >
              <div className="flex items-center gap-1 min-w-max">
                {modes.map((mode) => {
                  const Icon = mode.icon;
                  const isHovered = hoveredMode === mode.id;

                  return (
                    <button
                      key={`bubble-${mode.id}`}
                      onClick={() => onSelectMode(mode.id)}
                      onMouseEnter={() => setHoveredMode(mode.id)}
                      onMouseLeave={() => setHoveredMode(null)}
                      className={cn(
                        "relative px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors duration-150 flex items-center gap-2",
                        isHovered ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Smooth Gliding Bubble Pill Indicator on Hover */}
                      {isHovered && (
                        <motion.div
                          layoutId="heroBubbleIndicator"
                          className="absolute inset-0 rounded-xl bg-primary/15 dark:bg-primary/20 border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className={cn("w-3.5 h-3.5 transition-colors", isHovered ? "text-primary" : "text-muted-foreground")} />
                        <span>{mode.title.split(" ")[0]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        </motion.div>

        {/* 6 Mode Cards Grid with Cursor Spotlight and Spring Elevation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modes.map((mode, index) => {
            const Icon = mode.icon;

            return (
              <motion.div
                key={mode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
                whileHover={{ y: -4, scale: 1.012 }}
                whileTap={{ scale: 0.985 }}
                className="h-full"
              >
                <GlassCard
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMode(mode.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectMode(mode.id);
                    }
                  }}
                  glowColor={mode.glow}
                  className="cursor-pointer p-6 h-full flex flex-col justify-between select-none"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "p-3 rounded-xl bg-gradient-to-br border transition-transform duration-200 group-hover:scale-105 shadow-sm",
                          mode.accent
                        )}
                      >
                        <Icon className="w-6 h-6 transition-transform duration-200 group-hover:scale-105" />
                      </div>
                      <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/50 backdrop-blur-sm">
                        {mode.badge}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {mode.title}
                        <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-1 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 text-primary" />
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {mode.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80 group-hover:text-primary transition-colors">
                      Launch Inspector
                    </span>
                    <span className="text-[10px] uppercase font-mono text-primary font-semibold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                      Ready
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Forensic Guide Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-center pt-2"
        >
          <Link
            to="/guides/how-to-detect-deepfakes"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-colors py-2 px-4 rounded-full glass-panel hover:border-primary/40 shadow-sm"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Forensic AI Guide: How to detect deepfakes & synthetic media</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
