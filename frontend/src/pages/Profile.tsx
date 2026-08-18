import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { BackToTop } from "@/components/BackToTop";
import { Seo } from "@/components/Seo";


const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || "");
    setAvatarUrl(profile?.avatar_url || "");
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, avatar_url: avatarUrl.trim() || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile updated");
  };

  const initial = (profile?.display_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Seo
        title="Profile | VeriFact"
        description="Manage your VeriFact account details, display name and avatar."
        path="/profile"
      />
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Your profile</h1>
        <Card className="glass-panel p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-lg">{profile?.display_name || "Unnamed"}</div>
              <div className="text-sm text-muted-foreground">{profile?.email || user?.email}</div>
            </div>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="glass-panel" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="glass-panel" placeholder="https://…" />
            </div>
            <Button type="submit" disabled={busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </form>
        </Card>
      </main>
      <BackToTop />
    </div>
  );
};

export default Profile;

