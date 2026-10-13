/**
 * Unified API Client for VeriFact Frontend
 * Automatically handles CORS proxies, IPv4/IPv6 localhost resolution,
 * and seamless fallback across environments.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";

// Candidate URLs to try when communicating with the backend API
const CANDIDATE_URLS: string[] = [
  RAW_BASE,
  "", // relative path using Vite proxy /api
  "http://127.0.0.1:5000",
  "http://localhost:5000",
].filter((url, idx, arr): url is string => typeof url === "string" && arr.indexOf(url) === idx);

let cachedWorkingBase: string | null = null;

export const API_BASE_URL = RAW_BASE || "http://localhost:5000";

/**
 * Resilient fetch wrapper for all backend API endpoints.
 * Automatically tries candidates in priority order and caches the responding base.
 */
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // If a base was already proven to respond, attempt it first
  if (cachedWorkingBase !== null) {
    try {
      const url = `${cachedWorkingBase}${normalizedEndpoint}`;
      const res = await fetch(url, options);
      return res;
    } catch {
      // Invalidate on network error and fall through to scan all candidates
      cachedWorkingBase = null;
    }
  }

  let lastError: Error | null = null;

  for (const base of CANDIDATE_URLS) {
    try {
      const url = `${base}${normalizedEndpoint}`;
      const res = await fetch(url, options);
      cachedWorkingBase = base;
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("Failed to connect to backend server");
}
