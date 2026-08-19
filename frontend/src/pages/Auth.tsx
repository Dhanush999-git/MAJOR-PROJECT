import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Seo } from "@/components/Seo";
import { API_BASE_URL } from "@/lib/api";

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72);
const nameSchema = z.string().trim().min(1, { message: "Name is required" }).max(80);

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

type Mode = "signin" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, setSession } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const nextParam = new URLSearchParams(location.search).get("next");
  const safeNext = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : null;
  const from =
    safeNext ||
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ||
    "/";

  // Preserve the intended destination across full-page OAuth redirects.
  useEffect(() => {
    if (safeNext) sessionStorage.setItem("verifact_post_auth_next", safeNext);
  }, [safeNext]);

  useEffect(() => {
    if (!loading && user) {
      const stored = sessionStorage.getItem("verifact_post_auth_next");
      const target = safeNext || (stored && /^\/(?!\/)/.test(stored) ? stored : null) || from;
      sessionStorage.removeItem("verifact_post_auth_next");
      navigate(target, { replace: true });
    }
  }, [user, loading, from, safeNext, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const e1 = emailSchema.parse(email);
      if (mode !== "forgot") passwordSchema.parse(password);
      if (mode === "signup") nameSchema.parse(displayName);

      setBusy(true);
      if (mode === "signin") {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: e1,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  setSession(data.user, data.token);

toast.success("Welcome back");
navigate(from, { replace: true });
} else if (mode === "signup") {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: e1,
      password,
      display_name: displayName,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Registration failed");
  }

  setSession(data.user, data.token);

toast.success("Account created successfully");
navigate(from, { replace: true });
} else {
        const { error } = await supabase.auth.resetPasswordForEmail(e1, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-hero">
      <Seo
        title="Sign in | VeriFact"
        description="Sign in or create a VeriFact account to run forensic AI verification on text, images, video, audio and URLs."
        path="/auth"
      />
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-accent/20 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      <div className="absolute top-6 right-6 z-50"><ThemeToggle /></div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center justify-center gap-2 mb-6 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-lg opacity-60" />
              <div className="relative bg-gradient-primary p-3 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-xl tracking-tight">Verifact</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Forensic AI · Real or Fake
              </div>
            </div>
          </Link>

          <Card className="glass-panel p-6 animate-glass-fade">
            {mode === "forgot" ? (
              <>
                <h2 className="text-2xl font-bold mb-1">Reset password</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your email — we'll send you a link to reset it.
                </p>
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 glass-panel" placeholder="you@example.com" />
                    </div>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                  </Button>
                  <button type="button" onClick={() => setMode("signin")}
                    className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                    ← Back to sign in
                  </button>
                </form>
              </>
            ) : (
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid grid-cols-2 mb-4 glass-panel">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-0">
                  <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign in to access your forensic dashboard.
                  </p>
                </TabsContent>
                <TabsContent value="signup" className="mt-0">
                  <h2 className="text-2xl font-bold mb-1">Create your account</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Join the truth-keepers — free to get started.
                  </p>
                </TabsContent>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full glass-panel py-6 hover:bg-muted/40 border-primary/30 hover:border-primary/60 transition-all shadow-md group relative overflow-hidden mb-4"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <div className="flex items-center justify-center gap-3 w-full">
                      <GoogleIcon />
                      <span className="font-semibold text-sm">Continue with Google</span>
                    </div>
                  )}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background/60 px-2 text-muted-foreground">or with email</span>
                  </div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Display name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                          className="pl-9 glass-panel" placeholder="Jane Doe" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email2" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 glass-panel" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw">Password</Label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => setMode("forgot")}
                          className="text-xs text-primary hover:underline">
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="pw" type="password" required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 glass-panel" placeholder="••••••••" />
                    </div>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>{mode === "signup" ? "Create account" : "Sign in"}<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              </Tabs>
            )}
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing you agree to use this platform responsibly. <br />
            Verifact detection is assistive — always verify with multiple sources.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
