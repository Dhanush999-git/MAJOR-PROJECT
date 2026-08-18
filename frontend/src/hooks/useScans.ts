import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Scan {
  id: string;
  user_id: string;
  scan_type: "image" | "text" | "video" | "url" | "audio" | "document" | "qr";
  input_label: string | null;
  file_path: string | null;
  verdict: string | null;
  confidence: number | null;
  source_type: string | null;
  details: Record<string, any>;
  effects: any[];
  created_at: string;
}

export function useScans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scansQuery = useQuery({
    queryKey: ["scans", user?.id],
    queryFn: async () => {
      // 1. Query MongoDB Compass local server
      try {
        const res = await fetch("http://localhost:5000/api/scans");
        if (res.ok) {
          const mongoData = await res.json();
          if (Array.isArray(mongoData) && mongoData.length > 0) {
            return mongoData as Scan[];
          }
        }
      } catch {
        // Fall back to Supabase
      }
      if (!user) return [];
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data) return [];
      return data as Scan[];
    },
  });

  const saveScan = useMutation({
    mutationFn: async (scan: Omit<Scan, "id" | "created_at" | "user_id">) => {
      const payload = {
        user_id: user?.id || "local-user",
        ...scan,
        created_at: new Date().toISOString(),
      };
      // 1. Save directly into MongoDB Compass collection 'scans'
      try {
        await fetch("http://localhost:5000/api/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("MongoDB Compass save error:", e);
      }
      // 2. Also save to Supabase if authenticated
      if (user) {
        try {
          await supabase.from("scans").insert({ ...scan, user_id: user.id });
        } catch {}
      }
      return payload as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", user?.id] });
    },
  });

  return { scans: scansQuery.data ?? [], isLoading: scansQuery.isLoading, saveScan };
}