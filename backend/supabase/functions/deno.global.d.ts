/* Global ambient type declarations for Deno runtime in Supabase Edge Functions */

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
