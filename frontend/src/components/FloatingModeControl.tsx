import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, FileText, Image as ImageIcon, Video, Mic, Link2, FileCheck2, QrCode, ChevronDown, Sparkles } from "lucide-react";
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
  { id: "text", label: "Text", icon: FileText },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "url", label: "URL", icon: Link2 },
  { id: "document", label: "Document", icon: FileCheck2 },
  { id: "qr", label: "QR Code", icon: QrCode },
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
      if (window.scrollY > 120) {
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
      {/* Inline state at top of container */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="glass-panel animate-lift hover:bg-primary/10 border-primary/30 text-foreground font-medium"
        >
          <ArrowLeft className="mr-2 h-4 w-4 text-primary" />
          Back to Mode Selector
        </Button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-muted-foreground border border-border/40">
          <Icon className="w-4 h-4 text-primary" />
          <span>Active Mode: <strong className="text-foreground capitalize">{activeModeInfo.label} Analysis</strong></span>
        </div>
      </div>

      {/* Floating Sticky Bar when user scrolls/moves the screen */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3 p-2 px-4 rounded-full glass-panel bg-card/90 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/10">
              <Button
                onClick={() => {
                  onBack();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                size="sm"
                variant="ghost"
                className="rounded-full hover:bg-primary/20 text-foreground font-semibold text-xs h-8 px-3 gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-primary" />
                Back to Modes
              </Button>

              <div className="h-4 w-px bg-border/60" />

              {/* Mode Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors text-foreground"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold">{activeModeInfo.label} Analysis</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 top-full mt-2 w-48 rounded-xl glass-panel bg-card/95 backdrop-blur-xl border border-border/60 shadow-xl p-1.5 z-50"
                  >
                    <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">Switch Mode</div>
                    {MODES.map((m) => {
                      const MIcon = m.icon;
                      const isSel = m.id === currentMode;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (onSelectMode) onSelectMode(m.id);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                            isSel ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted/60 text-foreground"
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
