import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, LogOut, User as UserIcon, Sparkles } from "lucide-react";
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

export const AppHeader = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const initial = (profile?.display_name || profile?.email || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-panel border-b border-border/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
              <div className="relative bg-gradient-primary p-2 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-lg tracking-tight">Verifact</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><Sparkles className="h-4 w-4 mr-2" />Analyze</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-panel w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{profile?.display_name || "User"}</span>
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        {profile?.email || user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="h-4 w-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => navigate("/auth")} size="sm" className="bg-gradient-primary">
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
