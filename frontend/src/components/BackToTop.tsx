import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const threshold = typeof window !== "undefined" ? window.innerHeight * 0.25 : 400;
      setVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "fixed z-30 right-6 bottom-24 sm:bottom-28",
            "pointer-events-none"
          )}
        >
          <Button
            onClick={scrollToTop}
            size="icon"
            aria-label="Back to top"
            className={cn(
              "pointer-events-auto h-11 w-11 rounded-full",
              "glass-panel bg-card/80 hover:bg-card",
              "border border-border/50 shadow-lg",
              "text-foreground hover:text-primary",
              "transition-colors duration-200"
            )}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
