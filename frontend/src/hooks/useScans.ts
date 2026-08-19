import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DynamicRecord } from "@/lib/analysisTypes";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scansQuery = useQuery({
  queryKey: ["scans", user?.id],
  queryFn: async () => {
    if (!user?.id) return [];

    try {
      const res = await fetch(
        `http://localhost:5000/api/scans?user_id=${encodeURIComponent(user.id)}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch scans");
      }

      const mongoData = await res.json();

      if (Array.isArray(mongoData)) {
        return mongoData as Scan[];
      }

      return [];
    } catch (error) {
      console.error("MongoDB scan history fetch failed:", error);
      return [];
    }
  },
});

  const saveScan = useMutation({
  mutationFn: async (
  scan: Omit<Scan, "id" | "created_at" | "user_id">
) => {
  const payload = {
    user_id: user?.id || "local-user",
    ...scan,
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch("http://localhost:5000/api/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

  return { scans: scansQuery.data ?? [], isLoading: scansQuery.isLoading, saveScan };
}
