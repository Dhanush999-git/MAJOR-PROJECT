import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import DetectDeepfakesGuide from "./pages/DetectDeepfakesGuide";
import NotFound from "./pages/NotFound";
import { TruthAssistant } from "@/components/TruthAssistant";

const queryClient = new QueryClient();

import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
    try {
      (window as unknown as { __LAST_ERROR__?: unknown }).__LAST_ERROR__ = { error, errorInfo };
    } catch {
      /* ignore storage failure */
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const err = this.state.error;
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message)
          : String(err || "Component runtime exception");

      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-lg w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-indigo-400">VeriFact Application Notice</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              A runtime component exception occurred. Click below to continue.
            </p>
            {errorMessage && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/20 text-xs font-mono text-rose-400 text-left overflow-auto max-h-36 whitespace-pre-wrap">
                {errorMessage}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all border border-slate-700"
              >
                Dismiss & Try Again
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("verifact_truth_assistant_hidden");
                  } catch {
                    /* ignore storage failure */
                  }
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
              >
                Reload Platform Interface
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AuthProvider>
              <AnalysisProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/guides/how-to-detect-deepfakes" element={<DetectDeepfakesGuide />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <ErrorBoundary fallback={null}>
                  <TruthAssistant />
                </ErrorBoundary>
              </AnalysisProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
