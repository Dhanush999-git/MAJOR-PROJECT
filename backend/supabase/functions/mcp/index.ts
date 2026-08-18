import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (_req: Request) => {
  return new Response(JSON.stringify({ message: "MCP function deprecated" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});
