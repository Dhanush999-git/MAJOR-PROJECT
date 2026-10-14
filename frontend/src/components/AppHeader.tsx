import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Sparkles,
  Menu,
  X,
  BookOpen,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const AppHeader = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const isInteractingWithHeader = useRef(false);

  const initial = (profile?.display_name || profile?.email || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setIsScrolled(currentY > 20);

          // If user is actively hovering/interacting with header or has mobile menu open, stay visible
          if (isInteractingWithHeader.current || mobileMenuOpen) {
            setIsVisible(true);
            lastScrollY.current = currentY;
            ticking = false;
            return;
          }

          // Scroll up or near top -> reveal
          if (currentY <= 60 || currentY < lastScrollY.current - 8) {
            setIsVisible(true);
          } else if (currentY > 120 && currentY > lastScrollY.current + 8) {
            // Scrolling down significantly -> compact/hide
            setIsVisible(false);
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Reveal when cursor hovers near top edge (top 60px)
      if (e.clientY <= 60) {
        setIsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [mobileMenuOpen]);

  const isAnalyzeActive = location.pathname === "/";
  const isDashboardActive = location.pathname === "/dashboard";

  return (
    <header
      onPointerEnter={() => {
        isInteractingWithHeader.current = true;
        setIsVisible(true);
      }}
      onPointerLeave={() => {
        isInteractingWithHeader.current = false;
      }}
      className={cn(
        "sticky top-0 z-40 w-full transition-transform duration-300 ease-out focus-within:translate-y-0",
        isVisible ? "translate-y-0" : "-translate-y-full md:-translate-y-full"
      )}
    >
      <div
        className={cn(
          "w-full transition-all duration-300",
          "bg-background/80 dark:bg-background/70 backdrop-blur-2xl",
          "border-b border-white/10 dark:border-white/[0.08]",
          isScrolled ? "shadow-md shadow-black/5 dark:shadow-black/20" : "shadow-sm"
        )}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-xl blur-md opacity-40 group-hover:opacity-90 transition-opacity duration-300" />
              <div className="relative bg-gradient-to-br from-primary via-indigo-600 to-primary p-2 rounded-xl text-primary-foreground shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform duration-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
                VeriFact
              </div>
              <div className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <span>Forensic Guardian</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </Link>

          {/* Desktop Gliding Bubble Navigation */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-1 p-1 rounded-2xl glass-panel bg-card/60 dark:bg-card/40 border border-white/10 dark:border-white/[0.08] shadow-inner"
          >
            <Link
              to="/"
              className={cn(
                "relative px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-200 flex items-center gap-1.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isAnalyzeActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isAnalyzeActive && (
                <motion.div
                  layoutId="headerNavIndicator"
                  className="absolute inset-0 rounded-xl bg-primary/20 border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Sparkles className={cn("w-3.5 h-3.5 relative z-10 transition-colors", isAnalyzeActive ? "text-primary" : "text-muted-foreground")} />
              <span className="relative z-10">Analyze</span>
            </Link>

            <Link
              to="/dashboard"
              className={cn(
                "relative px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-200 flex items-center gap-1.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isDashboardActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isDashboardActive && (
                <motion.div
                  layoutId="headerNavIndicator"
                  className="absolute inset-0 rounded-xl bg-primary/20 border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <LayoutDashboard className={cn("w-3.5 h-3.5 relative z-10 transition-colors", isDashboardActive ? "text-primary" : "text-muted-foreground")} />
              <span className="relative z-10">Dashboard</span>
            </Link>
          </nav>

          {/* Right Controls: Truth Assistant, Theme Toggle & User Auth */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("toggle-truth-assistant", { detail: { visible: true, open: true } }));
              }}
              title="Toggle Truth Assistant"
              aria-label="Toggle Truth Assistant"
              className="glass-panel relative rounded-full w-9 h-9 border border-white/15 dark:border-white/[0.08] hover:border-primary/40 hover:bg-primary/10 transition-colors shadow-sm"
            >
              <Bot className="h-4 w-4 text-primary" />
            </Button>
            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full ring-2 ring-primary/25 hover:ring-primary/50 transition-all p-0 h-9 w-9"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-bold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="glass-panel w-56 rounded-2xl p-1.5 bg-card/95 backdrop-blur-2xl border border-white/10 dark:border-white/[0.08] shadow-2xl animate-glass-fade"
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{profile?.display_name || "User"}</span>
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        {profile?.email || user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="rounded-xl cursor-pointer hover:bg-muted/60"
                  >
                    <UserIcon className="h-4 w-4 mr-2 text-primary" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/dashboard")}
                    className="rounded-xl cursor-pointer hover:bg-muted/60"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2 text-primary" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/guides/how-to-detect-deepfakes")}
                    className="rounded-xl cursor-pointer hover:bg-muted/60"
                  >
                    <BookOpen className="h-4 w-4 mr-2 text-primary" /> Forensic Guide
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="rounded-xl cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate("/auth")}
                size="sm"
                className="btn-tactile bg-primary text-primary-foreground font-semibold rounded-xl text-xs px-3.5 h-8.5"
              >
                Sign in
              </Button>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border/50 px-4 py-3 space-y-2 bg-card/95 backdrop-blur-2xl"
            >
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  isAnalyzeActive ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Forensic Analyze</span>
              </Link>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  isDashboardActive ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutDashboard className="w-4 h-4 text-primary" />
                <span>Forensic Dashboard</span>
              </Link>
              <Link
                to="/guides/how-to-detect-deepfakes"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Forensic Detection Guide</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};
