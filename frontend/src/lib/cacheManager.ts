/**
 * High-speed caching system for AI Media Analysis using SHA-256 content hashing.
 * Supports LRU memory caching and LocalStorage persistence.
 * Prevents redundant re-scans of identical files/text and delivers sub-10ms response times.
 */

interface CacheEntry<T = unknown> {
  hash: string;
  data: T;
  timestamp: number;
  mode: string;
}

const MEMORY_CACHE_LIMIT = 50;
const memoryCache = new Map<string, CacheEntry>();
const LOCAL_STORAGE_KEY = "verifact_scan_cache_v2";

/**
 * Computes a fast SHA-256 hash string for string data, array buffer, or base64 data URL.
 */
export async function computeContentHash(input: string | ArrayBuffer): Promise<string> {
  try {
    let buffer: ArrayBuffer;
    if (typeof input === "string") {
      const enc = new TextEncoder();
      buffer = enc.encode(input).buffer;
    } else {
      buffer = input;
    }

    // WebCrypto SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fast string fallback hash (FNV-1a 32-bit)
    const str = typeof input === "string" ? input : new Uint8Array(input).toString();
    let hash = 2166136261;
    for (let i = 0; i < Math.min(str.length, 100000); i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
}

/**
 * Gets a cached scan result by content hash and mode.
 */
export function getCachedResult<T>(hash: string, mode: string): T | null {
  const key = `${mode}:${hash}`;

  // 1. Check memory cache
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key)!;
    // Move to end (most recently used)
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return entry.data as T;
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const store: Record<string, CacheEntry> = JSON.parse(raw);
      if (store[key]) {
        const entry = store[key];
        // Populate memory cache
        memoryCache.set(key, entry);
        return entry.data as T;
      }
    }
  } catch (err) {
    console.warn("Failed to read scan cache from localStorage:", err);
  }

  return null;
}

/**
 * Sets a cached scan result.
 */
export function setCachedResult<T>(hash: string, mode: string, data: T): void {
  const key = `${mode}:${hash}`;
  const entry: CacheEntry<T> = {
    hash,
    data,
    timestamp: Date.now(),
    mode,
  };

  // 1. Set in memory cache with LRU eviction
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, entry);

  // 2. Persist to localStorage (keep latest 30)
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const store: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
    store[key] = entry;

    const keys = Object.keys(store);
    if (keys.length > 30) {
      // sort by timestamp ascending and delete oldest
      keys.sort((a, b) => store[a].timestamp - store[b].timestamp);
      for (let i = 0; i < keys.length - 30; i++) {
        delete store[keys[i]];
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("Failed to write scan cache to localStorage:", err);
  }
}

/**
 * Clears the scan cache.
 */
export function clearScanCache(): void {
  memoryCache.clear();
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
