import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, FileText, Image as ImageIcon, Video, Mic, Link2, FileCheck2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisMode } from "@/contexts/AnalysisContext";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface FloatingModeControlProps {
  currentMode: AnalysisMode;
  onBack: () => void;
  onSelectMode?: (mode: AnalysisMode) => void;
}

const MODES: { id: AnalysisMode; label: string; icon: LucideIcon }[] = [
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "text", label: "Text", icon: FileText },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "url", label: "URL", icon: Link2 },
  { id: "document", label: "Document", icon: FileCheck2 },
];

export const FloatingModeControl: React.FC<FloatingModeControlProps> = ({
  currentMode,
  onBack,
  onSelectMode,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 140) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
        setDropdownOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activeModeInfo = MODES.find((m) => m.id === currentMode) || MODES[0];
  const Icon = activeModeInfo.icon;

  return (
    <>
      {/* Inline state bar at top of workbench */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="glass-panel animate-lift hover:bg-primary/10 border-primary/30 text-foreground font-medium rounded-xl text-xs sm:text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4 text-primary" />
          Back to Mode Overview
        </Button>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-panel text-xs font-semibold text-muted-foreground border border-border/40">
          <Icon className="w-4 h-4 text-primary" />
          <span>
            Active Inspector: <strong className="text-foreground capitalize">{activeModeInfo.label} Analysis</strong>
          </span>
        </div>
      </div>

      {/* Floating Sticky Bubble Capsule Bar (Appears when scrolled) */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="fixed top-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 px-3 sm:px-4 rounded-full glass-panel bg-card/85 dark:bg-card/75 backdrop-blur-2xl border border-white/15 dark:border-white/[0.08] shadow-2xl shadow-black/20">
              <Button
                onClick={() => {
                  onBack();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                size="sm"
                variant="ghost"
                className="rounded-full hover:bg-primary/15 text-foreground font-semibold text-xs h-8 px-2.5 sm:px-3 gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Overview</span>
              </Button>

              <div className="h-4 w-px bg-border/60" />

              {/* Desktop Horizontal Mini-Bubble Switcher */}
              <div className="hidden lg:flex items-center gap-1">
                {MODES.map((m) => {
                  const MIcon = m.icon;
                  const isSel = m.id === currentMode;

                  return (
                    <button
                      key={`floating-${m.id}`}
                      onClick={() => onSelectMode && onSelectMode(m.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors select-none",
                        isSel ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isSel && (
                        <motion.div
                          layoutId="floatingActivePill"
                          className="absolute inset-0 rounded-full bg-primary/20 border border-primary/45 shadow-[0_0_14px_rgba(99,102,241,0.3)]"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <MIcon className={cn("w-3.5 h-3.5", isSel ? "text-primary" : "text-muted-foreground")} />
                        <span>{m.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile / Tablet Compact Dropdown Mode Switcher */}
              <div className="relative lg:hidden">
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-muted/50 transition-colors text-foreground"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold">{activeModeInfo.label}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 rounded-2xl glass-panel bg-card/95 backdrop-blur-2xl border border-white/10 dark:border-white/[0.08] shadow-2xl p-1.5 z-50"
                  >
                    <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 tracking-wider">
                      Switch Inspector
                    </div>
                    {MODES.map((m) => {
                      const MIcon = m.icon;
                      const isSel = m.id === currentMode;
                      return (
                        <button
                          key={`compact-${m.id}`}
                          onClick={() => {
                            if (onSelectMode) onSelectMode(m.id);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-colors",
                            isSel
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "hover:bg-muted/60 text-foreground"
                          )}
                        >
                          <MIcon className={cn("w-3.5 h-3.5", isSel ? "text-primary-foreground" : "text-primary")} />
                          <span>{m.label} Analysis</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
