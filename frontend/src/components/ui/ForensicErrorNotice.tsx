import React from "react";
import { AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ForensicErrorNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ForensicErrorNotice: React.FC<ForensicErrorNoticeProps> = ({
  title = "Analysis Service Notice",
  message,
  onRetry,
  onDismiss,
  className,
}) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative rounded-2xl border border-rose-500/30 bg-rose-950/20 dark:bg-rose-950/30 p-5 sm:p-6 backdrop-blur-xl shadow-lg shadow-rose-950/20 text-foreground transition-all duration-200",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm sm:text-base font-bold tracking-tight text-rose-300">
              {title}
            </h4>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">
              Forensic Status: Halted
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
            {message}
          </p>
          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2.5 pt-2 flex-wrap">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="rounded-xl border-rose-500/30 text-rose-300 hover:bg-rose-500/15 hover:text-white text-xs gap-1.5 h-8 px-3"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Verification</span>
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="rounded-xl text-muted-foreground hover:text-foreground text-xs gap-1.5 h-8 px-3"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
