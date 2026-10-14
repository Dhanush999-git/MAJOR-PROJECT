import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

interface AnalysisProgressProps {
  onComplete: () => void;
}

const STATUSES = [
  "Scanning pixels...",
  "Detecting patterns...",
  "Reading metadata...",
  "Analyzing content...",
  "Finalizing forensic verdict...",
];

export const AnalysisProgress = ({ onComplete }: AnalysisProgressProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Scanning pixels...");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }

        const statusIndex = Math.floor((next / 100) * STATUSES.length);
        setStatus(STATUSES[Math.min(statusIndex, STATUSES.length - 1)]);

        return next;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="glass-panel p-8 rounded-2xl space-y-6 border border-white/10 dark:border-white/[0.08] shadow-2xl relative overflow-hidden"
    >
      {/* Subtle background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="text-center space-y-2 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary mb-1">
          <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
          <span>Forensic Deep Scan</span>
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-foreground">Analyzing Content</h3>
        <p className="text-xs sm:text-sm text-muted-foreground font-mono">{status}</p>
      </div>

      <div className="space-y-3 relative z-10">
        <div className="relative">
          <Progress value={progress} className="h-3 glass-panel rounded-full overflow-hidden" />
          <div
            className="absolute top-0 bottom-0 left-0 bg-primary/30 rounded-full blur-sm pointer-events-none transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Processing pipeline</span>
          <span className="font-semibold text-foreground">{progress}%</span>
        </div>
      </div>
    </motion.div>
  );
};
