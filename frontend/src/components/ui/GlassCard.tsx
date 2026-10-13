import React, { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  enableSpotlight?: boolean;
}

/**
 * Premium cursor-responsive glass card.
 * Uses high-performance CSS variable updates on pointermove without triggering React re-renders.
 * Automatically disabled on touch screens and under prefers-reduced-motion.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      glowColor = "rgba(99, 102, 241, 0.14)",
      enableSpotlight = true,
      onPointerEnter,
      onPointerLeave,
      onPointerMove,
      ...props
    },
    forwardedRef
  ) => {
    const localRef = useRef<HTMLDivElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!enableSpotlight || e.pointerType === "touch") return;

        // Respect prefers-reduced-motion
        if (
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }

        const el = localRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        el.style.setProperty("--mouse-x", `${x}px`);
        el.style.setProperty("--mouse-y", `${y}px`);

        if (onPointerMove) onPointerMove(e);
      },
      [enableSpotlight, onPointerMove]
    );

    const handlePointerEnter = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!enableSpotlight || e.pointerType === "touch") return;
        const el = localRef.current;
        if (el) {
          el.style.setProperty("--mouse-opacity", "1");
        }
        if (onPointerEnter) onPointerEnter(e);
      },
      [enableSpotlight, onPointerEnter]
    );

    const handlePointerLeave = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!enableSpotlight || e.pointerType === "touch") return;
        const el = localRef.current;
        if (el) {
          el.style.setProperty("--mouse-opacity", "0");
        }
        if (onPointerLeave) onPointerLeave(e);
      },
      [enableSpotlight, onPointerLeave]
    );

    return (
      <div
        ref={setRefs}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/[0.08]",
          "bg-card/75 dark:bg-card/60 backdrop-blur-xl",
          "shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.37)]",
          "transition-all duration-300 ease-out",
          "hover:border-primary/40 hover:shadow-[0_12px_40px_-8px_rgba(99,102,241,0.22)]",
          "hover:-translate-y-0.5",
          className
        )}
        style={
          {
            "--mouse-x": "50%",
            "--mouse-y": "50%",
            "--mouse-opacity": "0",
          } as React.CSSProperties
        }
        {...props}
      >
        {/* Soft radial cursor highlight layer */}
        {enableSpotlight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ease-out"
            style={{
              opacity: "var(--mouse-opacity, 0)",
              background: `radial-gradient(380px circle at var(--mouse-x) var(--mouse-y), ${glowColor}, transparent 72%)`,
            }}
          />
        )}

        {/* Specular edge reflection layer */}
        {enableSpotlight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl transition-opacity duration-300 ease-out"
            style={{
              opacity: "var(--mouse-opacity, 0)",
              background: `radial-gradient(280px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.08), transparent 80%)`,
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 w-full h-full">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
