import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

interface Profile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

export type AuthProviderType = "local" | "google" | null;

interface AuthContextValue {
  user: User | null;
  token: string | null;
  profile: Profile | null;
  loading: boolean;
  authProvider: AuthProviderType;
  setSession: (nextUser: User, nextToken: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage failure */
  }
}

function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore storage failure */
  }
}

function getLocalTokenUserId(token: string): string | null {
  if (typeof token !== "string" || !token.trim()) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;

    const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(
      base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(paddedPayload)) as { id?: unknown };
    // Local Express backend tokens strictly issue and require { id: string } (MongoDB user ID).
    // We intentionally reject 'sub' so Supabase access tokens are never mistakenly validated as local JWTs.
    if (typeof payload?.id === "string" && payload.id.trim()) {
      return payload.id.trim();
    }
    return null;
  } catch {
    return null;
  }
}

function mapSupabaseUser(sbUser: SupabaseUser): User {
  const meta = sbUser.user_metadata || {};
  const rawName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.user_name === "string" && meta.user_name.trim()) ||
    "";
  const displayName = rawName || (sbUser.email ? sbUser.email.split("@")[0] : "") || "User";

  const rawAvatar =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    "";

  return {
    id: sbUser.id,
    email: sbUser.email || "",
    display_name: displayName,
    avatar_url: rawAvatar || undefined,
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderType>(null);
  const [loading, setLoading] = useState(true);

  const profile = user
    ? {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      }
    : null;

  const setSession = (nextUser: User, nextToken: string) => {
    const tokenUserId = getLocalTokenUserId(nextToken);
    if (!nextUser?.id || !tokenUserId || tokenUserId !== nextUser.id) {
      throw new Error("Authentication response user and token do not match");
    }

    safeSetStorage("verifact_auth_provider", "local");
    safeSetStorage("verifact_token", nextToken);
    safeSetStorage("verifact_user", JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(nextToken);
    setAuthProvider("local");
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Initial synchronous hydration from localStorage
    const storedUser = safeGetStorage("verifact_user");
    const storedToken = safeGetStorage("verifact_token");
    const storedProvider = safeGetStorage("verifact_auth_provider") as AuthProviderType;

    let hasValidLocalSession = false;

    // Apply strict local-token validation only to local sessions
    if (storedProvider === "local" || (!storedProvider && storedToken && storedUser)) {
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          const tokenUserId = getLocalTokenUserId(storedToken);
          if (parsedUser?.id && tokenUserId && tokenUserId === parsedUser.id) {
            if (isMounted) {
              setUser(parsedUser);
              setToken(storedToken);
              setAuthProvider("local");
            }
            hasValidLocalSession = true;
          } else {
            // Invalid local session: clear local storage
            if (storedProvider === "local") {
              safeRemoveStorage("verifact_user");
              safeRemoveStorage("verifact_token");
              safeRemoveStorage("verifact_auth_provider");
            }
          }
        } catch {
          if (storedProvider === "local") {
            safeRemoveStorage("verifact_user");
            safeRemoveStorage("verifact_token");
            safeRemoveStorage("verifact_auth_provider");
          }
        }
      }
    }

    // 2. Safe Supabase session hydration
    const initSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          const mappedUser = mapSupabaseUser(session.user);
          safeSetStorage("verifact_auth_provider", "google");
          safeSetStorage("verifact_token", session.access_token);
          safeSetStorage("verifact_user", JSON.stringify(mappedUser));
          setUser(mappedUser);
          setToken(session.access_token);
          setAuthProvider("google");
        } else if (!hasValidLocalSession && storedProvider === "google") {
          // Stored Google session has expired and no local session exists
          safeRemoveStorage("verifact_user");
          safeRemoveStorage("verifact_token");
          safeRemoveStorage("verifact_auth_provider");
          setUser(null);
          setToken(null);
          setAuthProvider(null);
        }
      } catch (err) {
        console.warn("[AuthContext] Supabase session hydration warning:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initSupabaseSession();

    // 3. Listen for Supabase auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) {
        const mappedUser = mapSupabaseUser(session.user);
        safeSetStorage("verifact_auth_provider", "google");
        safeSetStorage("verifact_token", session.access_token);
        safeSetStorage("verifact_user", JSON.stringify(mappedUser));
        setUser(mappedUser);
        setToken(session.access_token);
        setAuthProvider("google");
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        const currentProvider = safeGetStorage("verifact_auth_provider");
        if (currentProvider === "google") {
          safeRemoveStorage("verifact_user");
          safeRemoveStorage("verifact_token");
          safeRemoveStorage("verifact_auth_provider");
          setUser(null);
          setToken(null);
          setAuthProvider(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const storedUser = safeGetStorage("verifact_user");
    const currentProvider = safeGetStorage("verifact_auth_provider") || authProvider;

    // If local email/password session, inform backend session logger
    if (currentProvider === "local" && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        await apiFetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: parsedUser.id,
            email: parsedUser.email,
            event: "logout",
          }),
        });
      } catch {
        // Backend logging failure must not prevent client logout
      }
    }

    // Terminate Supabase session safely without blocking local state reset
    try {
      await supabase.auth.signOut().catch(() => {});
    } catch {
      // Supabase logout failure must not prevent local state from being cleared
    }

    safeRemoveStorage("verifact_token");
    safeRemoveStorage("verifact_user");
    safeRemoveStorage("verifact_auth_provider");
    setUser(null);
    setToken(null);
    setAuthProvider(null);
  };

  const refreshProfile = async () => {
    const currentProvider = safeGetStorage("verifact_auth_provider") || authProvider;

    if (currentProvider === "google") {
      try {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (sbUser) {
          const mappedUser = mapSupabaseUser(sbUser);
          safeSetStorage("verifact_user", JSON.stringify(mappedUser));
          setUser(mappedUser);
        }
      } catch {
        // Retain existing state if refresh network call fails
      }
      return;
    }

    const storedUser = safeGetStorage("verifact_user");
    const storedToken = safeGetStorage("verifact_token");

    if (!storedToken || !storedUser) {
      safeRemoveStorage("verifact_user");
      safeRemoveStorage("verifact_token");
      safeRemoveStorage("verifact_auth_provider");
      setUser(null);
      setToken(null);
      setAuthProvider(null);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      const tokenUserId = getLocalTokenUserId(storedToken);
      if (!parsedUser?.id || !tokenUserId || tokenUserId !== parsedUser.id) {
        throw new Error("Stored user and token do not match");
      }
      setUser(parsedUser);
      setToken(storedToken);
      setAuthProvider("local");
    } catch {
      safeRemoveStorage("verifact_user");
      safeRemoveStorage("verifact_token");
      safeRemoveStorage("verifact_auth_provider");
      setUser(null);
      setToken(null);
      setAuthProvider(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        loading,
        authProvider,
        setSession,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
};
