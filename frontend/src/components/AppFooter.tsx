import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, BookOpen, LayoutDashboard, User } from "lucide-react";

export const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/40 bg-card/40 dark:bg-card/25 backdrop-blur-xl text-foreground mt-16 transition-colors">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3.5">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="bg-gradient-to-br from-primary to-indigo-600 p-2 rounded-xl text-primary-foreground shadow-sm shadow-primary/20 group-hover:scale-105 transition-transform duration-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  VeriFact
                </span>
                <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Forensic Guardian
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed">
              Multi-layer forensic AI platform detecting deepfakes, synthetic media, manipulated documents, and misinformation with verifiable model provenance.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border border-border/50 text-[11px] font-mono text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Forensic Models Operational</span>
            </div>
          </div>

          {/* Platform Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-foreground/80">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Analyze Workbench</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Scan Dashboard</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/guides/how-to-detect-deepfakes"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Deepfake Guide</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/profile"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>User Profile</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Active Forensic Modalities */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-foreground/80">
              Active Modalities
            </h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>Image & Diffusion AI</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                <span>Text Fake-News NLP</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>Video Temporal Audit</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Audio Spectral Forensics</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>URL Domain Threat Intel</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>Document Forgery Audit</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>┬⌐ {currentYear} VeriFact. All forensic rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>End-to-End Encrypted Verification</span>
            <span>ΓÇó</span>
            <span>Multi-Layer Forensic Signals</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
