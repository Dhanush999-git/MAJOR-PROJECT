import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api";

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

interface AuthContextValue {
  user: User | null;
  token: string | null;
  profile: Profile | null;
  loading: boolean;
  setSession: (nextUser: User, nextToken: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function getTokenUserId(token: string): string | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;

    const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(
      base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(paddedPayload)) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
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
    if (!nextUser.id || getTokenUserId(nextToken) !== nextUser.id) {
      throw new Error("Authentication response user and token do not match");
    }

    localStorage.setItem("verifact_token", nextToken);
    localStorage.setItem("verifact_user", JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(nextToken);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("verifact_user");
    const storedToken = localStorage.getItem("verifact_token");

    if (!storedToken || !storedUser) {
      localStorage.removeItem("verifact_user");
      localStorage.removeItem("verifact_token");
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      if (!parsedUser.id || getTokenUserId(storedToken) !== parsedUser.id) {
        throw new Error("Stored user and token do not match");
      }
      setUser(parsedUser);
      setToken(storedToken);
    } catch {
      localStorage.removeItem("verifact_user");
      localStorage.removeItem("verifact_token");
      setUser(null);
      setToken(null);
    }

    setLoading(false);
  }, []);

  const signOut = async () => {
    const storedUser = localStorage.getItem("verifact_user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        await fetch(`${API_BASE_URL}/api/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: parsedUser.id,
            email: parsedUser.email,
            event: "logout",
          }),
        });
      } catch {
        // Authentication state must still be cleared if session logging is unavailable.
      }
    }

    localStorage.removeItem("verifact_token");
    localStorage.removeItem("verifact_user");
    setUser(null);
    setToken(null);
  };

  const refreshProfile = async () => {
    const storedUser = localStorage.getItem("verifact_user");
    const storedToken = localStorage.getItem("verifact_token");

    if (!storedToken || !storedUser) {
      localStorage.removeItem("verifact_user");
      localStorage.removeItem("verifact_token");
      setUser(null);
      setToken(null);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      if (!parsedUser.id || getTokenUserId(storedToken) !== parsedUser.id) {
        throw new Error("Stored user and token do not match");
      }
      setUser(parsedUser);
      setToken(storedToken);
    } catch {
      localStorage.removeItem("verifact_user");
      localStorage.removeItem("verifact_token");
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        loading,
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
