import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image as ImageIcon, Video as VideoIcon, Mic, Link2, Menu, FileCheck2, QrCode } from "lucide-react";
import { TextVerification } from "./TextVerification";
import { ImageVerification } from "./ImageVerification";
import { VideoVerification } from "./VideoVerification";
import { UrlVerification } from "./UrlVerification";
import { AudioVerification } from "./AudioVerification";
import { DocumentVerification } from "./DocumentVerification";
import { QrVerification } from "./QrVerification";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnalysis, type AnalysisMode } from "@/contexts/AnalysisContext";

const NAV: { id: AnalysisMode; label: string; icon: any; title: string; subtitle: string }[] = [
  { id: "text",  label: "Text",  icon: FileText, title: "Text Fake-News Detection", subtitle: "Analyze text content for misinformation and AI-generated content" },
  { id: "image", label: "Image", icon: ImageIcon, title: "Image Deepfake Detection", subtitle: "Detect manipulated or AI-generated images" },
  { id: "video", label: "Video", icon: VideoIcon, title: "Video Deepfake Analysis", subtitle: "Identify deepfake videos and manipulation patterns" },
  { id: "audio", label: "Audio", icon: Mic,       title: "Audio Forensic Analysis",  subtitle: "Detect AI-generated voice, voice cloning, splicing and tampering" },
  { id: "url",   label: "URL",   icon: Link2,    title: "URL Fact-Checking",        subtitle: "Verify website credibility and content authenticity" },
  { id: "document", label: "Document", icon: FileCheck2, title: "Document Verification", subtitle: "Verify PDFs, DOCX and scanned documents for forgery, tampering & AI generation" },
  { id: "qr", label: "QR Code", icon: QrCode, title: "QR Code Analysis & Scam Protection", subtitle: "Detect phishing QR codes, fake UPI payment traps, physical sticker overlays & malicious redirects" },
];

interface VerificationSectionProps {
  initialMode?: AnalysisMode;
}

export const VerificationSection = ({ initialMode }: VerificationSectionProps) => {
  const { activeModule, setActiveModule } = useAnalysis();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync initialMode if provided on first render
  useState(() => {
    if (initialMode && NAV.some((n) => n.id === initialMode)) {
      setActiveModule(initialMode as AnalysisMode);
    }
  });

  const active = activeModule;
  const current = NAV.find((n) => n.id === active) || NAV[0];

  return (
    <section id="verify" className="py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center justify-between glass-panel p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <current.icon className="w-5 h-5 text-primary" />
              <span className="font-semibold">{current.label} Analysis</span>
            </div>
            <Button variant="ghost" size="icon" aria-label="Toggle analysis modules menu" onClick={() => setMobileOpen((v) => !v)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          {/* Sidebar */}
          <aside
            className={cn(
              "lg:w-64 lg:shrink-0",
              mobileOpen ? "block" : "hidden lg:block"
            )}
          >
            <div className="glass-panel rounded-2xl p-3 sticky top-20">
              <div className="px-3 pt-2 pb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Verifact</div>
                <div className="font-semibold">Analysis modules</div>
              </div>
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveModule(item.id); setMobileOpen(false); }}
                      aria-label={`Open ${item.title}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                        isActive
                          ? "bg-gradient-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-primary")} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h2 className="text-3xl font-bold">{current.title}</h2>
              <p className="text-muted-foreground mt-1">{current.subtitle}</p>
            </div>

            <div className="relative">
              <div className={active === "text" ? "block" : "hidden"}>
                <TextVerification />
              </div>
              <div className={active === "image" ? "block" : "hidden"}>
                <ImageVerification />
              </div>
              <div className={active === "video" ? "block" : "hidden"}>
                <VideoVerification />
              </div>
              <div className={active === "audio" ? "block" : "hidden"}>
                <AudioVerification />
              </div>
              <div className={active === "url" ? "block" : "hidden"}>
                <UrlVerification />
              </div>
              <div className={active === "document" ? "block" : "hidden"}>
                <DocumentVerification />
              </div>
              <div className={active === "qr" ? "block" : "hidden"}>
                <QrVerification />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
