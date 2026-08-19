import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import { BackToTop } from "@/components/BackToTop";
import { useAuth } from "@/contexts/AuthContext";
import { useScans, type Scan } from "@/hooks/useScans";
import { ShieldCheck, Sparkles, History, Image, FileText, Video, Globe, AlertTriangle, Loader2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { generateForensicReport } from "@/lib/forensicReport";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import type { DynamicRecord } from "@/lib/analysisTypes";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";


/* ── Circular Progress Ring ──────────────────── */
function CircularProgress({ value, size = 110, strokeWidth = 9, label, color }: {
  value: number; size?: number; strokeWidth?: number; label: string; color: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted)/0.3)"
            strokeWidth={strokeWidth}
          />
          {value > 0 && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
              strokeDasharray={circ}
            />
          )}
        </svg>
        <span className="text-2xl font-extrabold tabular-nums absolute inset-0 flex items-center justify-center" style={{ color: value > 0 ? color : "hsl(var(--muted-foreground))" }}>
          {Math.round(value)}%
        </span>
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Scan type icon helper ───────────────────── */
const TYPE_ICON: Record<string, React.ReactNode> = {
  image: <Image className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  url: <Globe className="h-4 w-4" />,
};

const VERDICT_CLS: Record<string, string> = {
  authentic: "text-success",
  suspicious: "text-warning",
  manipulated: "text-destructive",
};

const Dashboard = () => {
  const { profile } = useAuth();
  const { scans, isLoading, error } = useScans();
  const name = profile?.display_name || profile?.email?.split("@")[0] || "there";

  const stats = useMemo(() => {
    const total = scans.length;
    const suspicious = scans.filter(s => {
      const d = s.details;
      const cat = String(d?.category || "").toLowerCase();
      const verd = String(s.verdict || d?.verdict || "").toLowerCase();
      return cat === "suspicious" || cat === "manipulated" || cat === "fake" || verd.includes("fake") || verd.includes("suspicious") || verd.includes("manipulated");
    }).length;
    const lastScan = scans[0]?.created_at
      ? new Date(scans[0].created_at).toLocaleDateString()
      : "—";

    const byType = { image: 0, text: 0, video: 0, url: 0 };
    scans.forEach(s => {
      const type = s.scan_type as keyof typeof byType;
      if (type in byType) byType[type]++;
    });

    const avgConfidence = total
      ? Math.round(scans.reduce((a, s) => a + (s.confidence ?? 95), 0) / total)
      : 96;

    const authenticity = total === 0
      ? 98
      : Math.round(
          scans.reduce((sum, s) => {
            const d = s.details;
            const cat = String(d?.category || "").toLowerCase();
            const verd = String(s.verdict || d?.verdict || d?.verdictTag || "").toLowerCase();
            const isAuthentic = (
              cat === "authentic" ||
              cat === "credible" ||
              verd.includes("real") ||
              verd.includes("authentic") ||
              verd.includes("original") ||
              verd.includes("verified") ||
              verd.includes("credible")
            );
            const isMisleading = cat === "suspicious" || verd.includes("misleading") || verd.includes("partially");
            const conf = s.confidence ?? 90;
            const score = isAuthentic ? Math.max(conf, 92) : isMisleading ? 60 : Math.max(10, 100 - conf);
            return sum + score;
          }, 0) / total
        );

    return { total, suspicious, lastScan, byType, avgConfidence, authenticity };
  }, [scans]);

  const radarData = [
    { subject: "Images", value: stats.byType.image },
    { subject: "Text", value: stats.byType.text },
    { subject: "Video", value: stats.byType.video },
    { subject: "URLs", value: stats.byType.url },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Seo
        title="Dashboard | VeriFact"
        description="Your forensic command center — track scans, trust scores and analysis history across text, image, video, audio and URL checks."
        path="/dashboard"
      />
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Hero heading */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold">Welcome back, {name}</h1>
          <p className="text-muted-foreground">Your forensic command center.</p>
        </motion.div>

        {/* ── Stat cards ──────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <ShieldCheck className="h-5 w-5 text-success" />, bg: "bg-success/15", label: "Total scans", value: stats.total },
            { icon: <AlertTriangle className="h-5 w-5 text-warning" />, bg: "bg-warning/15", label: "Suspicious found", value: stats.suspicious },
            { icon: <History className="h-5 w-5 text-primary" />, bg: "bg-primary/15", label: "Last scan", value: stats.lastScan },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass-panel p-6 animate-lift">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`${c.bg} p-2 rounded-lg`}>{c.icon}</div>
                  <span className="text-sm text-muted-foreground">{c.label}</span>
                </div>
                <div className="text-3xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : c.value}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Analytics row ──────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Circular progress cards */}
          <Card className="glass-panel p-6 animate-glass-fade">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Trust Overview</h3>
            <div className="flex justify-around items-center">
              <CircularProgress value={stats.avgConfidence} label="Avg Confidence" color="#3b82f6" />
              <CircularProgress value={stats.authenticity} label="Authenticity Rate" color="#10b981" />
            </div>
          </Card>

          {/* Radar chart */}
          <Card className="glass-panel p-6 animate-glass-fade">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Scan Distribution</h3>
            {stats.total === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Radar dataKey="value" stroke="hsl(220,90%,56%)" fill="hsl(220,90%,56%)" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* ── Scan history ───────────────── */}
        <Card className="glass-panel p-6 animate-glass-fade">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Scans</h3>
            <Button asChild variant="outline" size="sm" className="glass-panel">
              <Link to="/">+ New Scan</Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-bold mb-2">Unable to load scan history</h2>
              <p className="text-muted-foreground">Please sign in again before viewing your scans.</p>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">No scans yet</h2>
              <p className="text-muted-foreground mb-6">Run your first analysis to start building your trust dashboard.</p>
              <Button asChild className="bg-gradient-primary">
                <Link to="/">Start an analysis</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {scans.map((scan, i) => (
                <motion.div key={scan.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center gap-4 p-4 rounded-lg glass-panel hover:glass-glow transition-all">
                    <div className="bg-primary/10 p-2 rounded-lg">{TYPE_ICON[scan.scan_type] || <Sparkles className="h-4 w-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{scan.input_label || scan.scan_type + " scan"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold capitalize ${VERDICT_CLS[typeof (scan.details as DynamicRecord).category === "string" ? scan.details.category : ""] || ""}`}>
                        {scan.verdict || "—"}
                      </p>
                      {scan.confidence != null && (
                        <p className="text-xs text-muted-foreground">{scan.confidence}%</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        try {
                          generateForensicReport(scan);
                          toast.success("Forensic report downloaded");
                        } catch (e) {
                          console.error(e);
                          toast.error("Failed to generate report");
                        }
                      }}
                      aria-label="Download forensic PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </main>
      <BackToTop />
    </div>
  );
};

export default Dashboard;
