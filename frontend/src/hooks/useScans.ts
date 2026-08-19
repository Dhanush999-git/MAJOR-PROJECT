import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { DynamicRecord } from "@/lib/analysisTypes";
import { API_BASE_URL } from "@/lib/api";

export interface Scan {
  id: string;
  user_id: string;
  scan_type: "image" | "text" | "video" | "url" | "audio" | "document" | "qr";
  input_label: string | null;
  file_path: string | null;
  verdict: string | null;
  confidence: number | null;
  source_type: string | null;
  details: DynamicRecord;
  effects: unknown[];
  created_at: string;
}

export function useScans() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const scansQuery = useQuery({
    queryKey: ["scans", user?.id],
    enabled: Boolean(user?.id && token),
    queryFn: async () => {
    if (!user?.id || !token) {
      throw new Error("Authentication is not ready");
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/scans?user_id=${encodeURIComponent(user.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(responseBody?.error || "Failed to fetch scans");
      }

      if (!Array.isArray(responseBody)) {
        throw new Error("Scan history response was not an array");
      }

      return responseBody as Scan[];
    } catch (error) {
      console.error("MongoDB scan history fetch failed:", error);
      throw error instanceof Error ? error : new Error("Failed to fetch scans");
    }
  },
});

  const saveScan = useMutation({
  mutationFn: async (
  scan: Omit<Scan, "id" | "created_at" | "user_id">
) => {
  const payload = {
    user_id: user?.id || "guest-user",
    ...scan,
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/scans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("Failed to save scan to MongoDB");
    }

    const savedScan = await res.json();

    return {
      ...payload,
      id: savedScan.id,
    } as Scan;

  } catch (e) {
    console.error("MongoDB Compass save error:", e);
    throw e;
  }
},

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["scans", user?.id],
    });
  },
});

  return {
    scans: scansQuery.data ?? [],
    isLoading: scansQuery.isLoading,
    error: scansQuery.error,
    saveScan,
  };
}
