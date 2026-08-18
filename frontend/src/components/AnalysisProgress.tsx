import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface AnalysisProgressProps {
  onComplete: () => void;
}

export const AnalysisProgress = ({ onComplete }: AnalysisProgressProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Scanning pixels...");

  const statuses = [
    "Scanning pixels...",
    "Detecting patterns...",
    "Reading metadata...",
    "Analyzing content...",
    "Finalizing...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        
        const statusIndex = Math.floor((next / 100) * statuses.length);
        setStatus(statuses[Math.min(statusIndex, statuses.length - 1)]);
        
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="glass-panel animate-glass-ripple p-8 rounded-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="text-2xl font-semibold">Analyzing Content</div>
        <p className="text-muted-foreground">{status}</p>
      </div>
      
      <div className="space-y-2">
        <Progress value={progress} className="h-3 glass-panel" />
        <div className="text-center text-sm font-medium">{progress}%</div>
      </div>
    </div>
  );
};
