import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
      try {
        await fetch("http://localhost:5000/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data.id,
            email: data.email,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
          }),
        }).catch(() => {});
      } catch {}
    }
  };

  const logSessionAccess = async (userObj?: User | null, eventType: string = "access") => {
    try {
      await fetch("http://localhost:5000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj?.id || "guest",
          email: userObj?.email || null,
          event: eventType,
          network_origin: window.location.origin,
        }),
      }).catch(() => {});
    } catch {}
  };

  useEffect(() => {
    // 1. Subscribe FIRST (synchronous setters only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer DB call to avoid deadlock
        setTimeout(() => fetchProfile(newSession.user.id), 0);
        logSessionAccess(newSession.user, event);
      } else {
        setProfile(null);
        logSessionAccess(null, event);
      }
    });

    // 2. Then read existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchProfile(existing.user.id);
        logSessionAccess(existing.user, "session_restore");
      } else {
        logSessionAccess(null, "guest_visit");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
