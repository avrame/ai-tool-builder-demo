const CACHE_NAME = "wllama-models-v1";
const MODEL_FILENAME = "qwen2.5-1.5b-instruct-q4_k_m.gguf";
const MODEL_URL = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf";

// Guard: Cache API only works in secure contexts (HTTPS or localhost)
const isCacheAvailable = () => {
  try {
    return typeof caches !== "undefined" && typeof caches.open === "function";
  } catch {
    return false;
  }
};

// Check if model is cached
export async function getCachedModelBlob(): Promise<Blob | null> {
  if (!isCacheAvailable()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(MODEL_FILENAME);
    if (!response) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

// Store a blob in the cache
export async function cacheModelBlob(blob: Blob): Promise<void> {
  if (!isCacheAvailable()) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(MODEL_FILENAME, new Response(blob));
  } catch {
    // Silently fail — cache not available in non-secure context
  }
}

// Download from URL, cache, and return as Blob
// onProgress: (percentage: number, text: string) => void
export async function downloadAndCacheModel(
  url: string,
  onProgress: (progress: number, text: string) => void
): Promise<Blob> {
  const response = await fetch(url);
  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let received = 0;

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    if (total > 0) {
      const pct = Math.round((received / total) * 100);
      onProgress(pct, `Downloading model... ${pct}%`);
    }
  }

  // Combine chunks into a single blob
  const blob = new Blob(chunks);

  // Store in cache
  await cacheModelBlob(blob);

  return blob;
}

export { CACHE_NAME, MODEL_FILENAME, MODEL_URL };
