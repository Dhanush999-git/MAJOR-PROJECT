import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  Link2,
  Menu,
  FileCheck2,
  X,
  type LucideIcon,
} from "lucide-react";
import { TextVerification } from "./TextVerification";
import { ImageVerification } from "./ImageVerification";
import { VideoVerification } from "./VideoVerification";
import { UrlVerification } from "./UrlVerification";
import { AudioVerification } from "./AudioVerification";
import { DocumentVerification } from "./DocumentVerification";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnalysis, type AnalysisMode } from "@/contexts/AnalysisContext";

const NAV: {
  id: AnalysisMode;
  label: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tag: string;
}[] = [
  {
    id: "image",
    label: "Image Analysis",
    icon: ImageIcon,
    title: "Image Deepfake & Artifact Detection",
    subtitle: "Analyze photos and visual media for generative diffusion, spatial anomalies, EXIF & sensor noise",
    tag: "Vision AI",
  },
  {
    id: "text",
    label: "Text Verification",
    icon: FileText,
    title: "Text Fake-News & Bias Detection",
    subtitle: "Analyze text content for misinformation, propaganda patterns, sentiment manipulation & fact checks",
    tag: "NLP Audit",
  },
  {
    id: "video",
    label: "Video Deepfake",
    icon: VideoIcon,
    title: "Video Deepfake & Temporal Analysis",
    subtitle: "Inspect video streams, frame consistency, face reenactment patterns & synthetic artifacts",
    tag: "Frame Audit",
  },
  {
    id: "audio",
    label: "Audio Forensics",
    icon: Mic,
    title: "Audio Forensic & Voice Clone Detection",
    subtitle: "Detect synthetic speech, cloned voices, spectral discontinuities, and audio splicing",
    tag: "Acoustic AI",
  },
  {
    id: "url",
    label: "URL Fact-Check",
    icon: Link2,
    title: "URL Credibility & Security Fact-Check",
    subtitle: "Audit web destinations for WHOIS domain age, SSL certificate trust, phishing & threat flags",
    tag: "Domain Intel",
  },
  {
    id: "document",
    label: "Document Verification",
    icon: FileCheck2,
    title: "Document Forgery & Tamper Verification",
    subtitle: "Verify PDFs, digital documents and scans for digital forgery, font changes & metadata tampering",
    tag: "OCR Forensics",
  },
];

interface VerificationSectionProps {
  initialMode?: AnalysisMode;
}

export const VerificationSection = ({ initialMode }: VerificationSectionProps) => {
  const { activeModule, setActiveModule } = useAnalysis();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync initialMode if provided on mount
  useEffect(() => {
    if (initialMode && NAV.some((n) => n.id === initialMode)) {
      setActiveModule(initialMode);
    }
  }, [initialMode, setActiveModule]);

  const active = activeModule;
  const current = NAV.find((n) => n.id === active) || NAV[0];

  return (
    <section id="verify" className="py-2 sm:py-4 px-1 sm:px-4">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Horizontal Bubble Navigation for Desktop & Scrollable Segmented for Mobile */}
        <div className="w-full flex justify-center">
          <nav
            aria-label="Forensic Modality Selector"
            className="w-full sm:w-auto p-1.5 rounded-2xl glass-panel bg-card/70 border border-white/10 dark:border-white/[0.08] shadow-lg overflow-x-auto scrollbar-none"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;

                return (
                  <button
                    key={`h-bubble-${item.id}`}
                    onClick={() => setActiveModule(item.id)}
                    aria-label={`Switch to ${item.label}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-200 flex items-center gap-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {/* Smooth Luminous Gliding Bubble Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="activeHorizontalBubble"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-indigo-500/20 to-primary/15 border border-primary/45 shadow-[0_0_22px_rgba(99,102,241,0.28)]"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 32,
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-colors duration-150",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="hidden md:inline">{item.label}</span>
                      <span className="md:hidden">{item.label.split(" ")[0]}</span>
                    </span>
                    <span
                      className={cn(
                        "relative z-10 text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors hidden lg:inline",
                        isActive
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-muted/40 text-muted-foreground/80"
                      )}
                    >
                      {item.tag.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mobile top bar toggle */}
          <div className="lg:hidden flex items-center justify-between glass-panel p-3.5 rounded-2xl border border-white/10 dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <current.icon className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm">{current.label}</span>
                <span className="text-[10px] block font-mono text-muted-foreground uppercase">{current.tag}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Toggle analysis modules menu"
              onClick={() => setMobileOpen((v) => !v)}
              className="glass-panel text-xs gap-1.5"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              {mobileOpen ? "Close" : "Modalities"}
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <aside
            className={cn(
              "lg:w-64 lg:shrink-0",
              mobileOpen ? "block" : "hidden lg:block"
            )}
          >
            <div className="glass-panel rounded-2xl p-3 sticky top-24 space-y-3 border border-white/10 dark:border-white/[0.08] shadow-md">
              <div className="px-3 pt-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Forensic Modalities
                </div>
                <div className="font-bold text-sm text-foreground">Analysis Workbench</div>
              </div>

              <nav className="flex flex-col gap-1.5 relative">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;

                  return (
                    <button
                      key={`side-${item.id}`}
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileOpen(false);
                      }}
                      aria-label={`Open ${item.title}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isActive
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {/* Shared Gliding Spring Pill for Sidebar */}
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebarBubble"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/18 via-indigo-500/15 to-primary/12 border border-primary/40 shadow-[0_0_18px_rgba(99,102,241,0.22)]"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 32,
                          }}
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            "w-4 h-4 transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      <span
                        className={cn(
                          "relative z-10 text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors",
                          isActive
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "text-muted-foreground/70"
                        )}
                      >
                        {item.tag.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Workbench Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Header info badge */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 dark:border-white/[0.08] shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono font-semibold uppercase tracking-wider mb-2">
                    {current.tag} Mode
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    {current.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                    {current.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Preserved Analysis Views (Mounted so input, progress & state are retained) */}
            <div className="relative">
              <div className={active === "image" ? "block animate-glass-fade" : "hidden"}>
                <ImageVerification />
              </div>
              <div className={active === "text" ? "block animate-glass-fade" : "hidden"}>
                <TextVerification />
              </div>
              <div className={active === "video" ? "block animate-glass-fade" : "hidden"}>
                <VideoVerification />
              </div>
              <div className={active === "audio" ? "block animate-glass-fade" : "hidden"}>
                <AudioVerification />
              </div>
              <div className={active === "url" ? "block animate-glass-fade" : "hidden"}>
                <UrlVerification />
              </div>
              <div className={active === "document" ? "block animate-glass-fade" : "hidden"}>
                <DocumentVerification />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
