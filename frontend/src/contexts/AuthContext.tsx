import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const profile = user
    ? {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      }
    : null;

  useEffect(() => {
    const storedUser = localStorage.getItem("verifact_user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("verifact_user");
        localStorage.removeItem("verifact_token");
      }
    }

    setLoading(false);
  }, []);

  const signOut = async () => {
    localStorage.removeItem("verifact_token");
    localStorage.removeItem("verifact_user");
    setUser(null);
  };

  const refreshProfile = async () => {
    const storedUser = localStorage.getItem("verifact_user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
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
