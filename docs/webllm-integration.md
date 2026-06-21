# On-Device LLM Integration — wllama (WASM/CPU)

> **Status:** Implemented and tested on Samsung Galaxy S21 FE (Chrome Android)
> **Last updated:** 2026-06-20
> **Runtime:** wllama v3.5.1 — WebAssembly inference on CPU (no WebGPU required)

## Overview

This project runs LLMs entirely in the browser using **wllama** — a port of llama.cpp to WebAssembly. Unlike WebLLM (which requires WebGPU), wllama runs on **CPU/WASM** and works on any device with a modern browser. No server, no API keys, fully offline after initial model download.

## Architecture

```
Browser (Chrome/Samsung Internet)
  └── WebAssembly (wllama.wasm)
        └── GGUF Model (Qwen2.5-1.5B-Instruct Q4_K_M)
              └── Streaming chat completion (CPU inference)
```

### Key Differences from WebLLM/MLC

| Aspect | WebLLM (MLC) | wllama (WASM) |
|--------|-------------|---------------|
| Runtime | WebGPU (GPU-accelerated) | WASM (CPU) |
| Model Format | MLC-compiled | GGUF (standard) |
| GPU Required | Yes | No |
| Browser Support | WebGPU-capable only | Any modern browser |
| Model Size | ~0.7-2.4GB (q4f16_1) | ~0.7GB (Q4_K_M) |
| Speed | 15-30 tok/s (GPU) | 2-8 tok/s (CPU) |
| Memory | VRAM + system RAM | System RAM only |
| Model Download | MLC model registry | HuggingFace (any GGUF) |

## Implementation Details

### Model Loading Flow

1. **Check Cache API** — `getCachedModelBlob()` checks if model is already cached
2. **Download if needed** — `downloadAndCacheModel()` fetches from HuggingFace with progress tracking
3. **Initialize WASM** — wllama runtime loaded from CDN: `@wllama/wllama@3.5.1/esm/wasm/wllama.wasm`
4. **Load Model** — `wllamaInstance.loadModel([blob], { n_threads, n_ctx })`
5. **Ready** — Status changes to "ready", chat becomes available

### Code Structure

```
src/
├── llm-engine.ts      # Core engine: loadModel(), sendMessage(), state management
├── model-cache.ts     # Cache API wrapper: download, cache, retrieve model blobs
├── send-message.ts    # Re-exports from llm-engine and model-cache
└── App.ts             # UI: Arrow.js components, reactive state, message rendering
```

### Key Files

#### `llm-engine.ts` — Core Engine

```typescript
// Model loading with progress tracking
export async function loadModel(modelId: string): Promise<void> {
  engineState.status = "loading";
  engineState.progress = 0;
  engineState.progressText = "Loading WASM runtime...";

  // Device-aware configuration
  const deviceMemory = (navigator as any).deviceMemory || 4;
  const nThreads = Math.max(2, Math.min(4, navigator.hardwareConcurrency || 4));
  const nCtx = deviceMemory <= 4 ? 1024 : 2048; // Reduced context for low-RAM

  // Initialize wllama with CDN WASM
  wllamaInstance = new Wllama(WLLAMA_CONFIG_PATHS, {
    cacheManager: new CacheManager([new NoOpStorageBackend()]),
  });

  // Load from cache or download fresh
  const cachedBlob = await getCachedModelBlob();
  if (cachedBlob && "caches" in globalThis) {
    await wllamaInstance.loadModel([cachedBlob], { n_threads: nThreads, n_ctx: nCtx });
  } else {
    const blob = await downloadAndCacheModel(MODEL_URL, onProgress);
    await wllamaInstance.loadModel([blob], { n_threads: nThreads, n_ctx: nCtx });
  }

  engineState.status = "ready";
}
```

#### `model-cache.ts` — Cache API Wrapper

```typescript
// Cache model blobs using the Cache API
// Works in secure contexts (HTTPS or localhost)
// Falls back gracefully in non-secure contexts

export async function downloadAndCacheModel(
  url: string,
  onProgress: (progress: number, text: string) => void
): Promise<Blob> {
  const response = await fetch(url);
  const reader = response.body.getReader();
  // Stream chunks with progress updates
  // Combine into single blob
  // Store in Cache API for reuse
}
```

### NoOpStorageBackend Workaround

wllama's default `CacheManager` requires OPFS (`navigator.storage.getDirectory`), which is unavailable on Chrome Android when COEP/COOP headers are active (needed for SharedArrayBuffer / multi-thread WASM). Since we handle model caching ourselves via the Cache API, we supply a dummy backend:

```typescript
class NoOpStorageBackend implements StorageBackend {
  isSupported(): boolean { return true; }
  async read(_key: string): Promise<Blob | null> { return null; }
  async write(_key: string, _stream: ReadableStream): Promise<void> {}
  async getSize(_key: string): Promise<number> { return -1; }
  async list(): Promise<Array<{ key: string; size: number }>> { return []; }
  async delete(_key: string): Promise<void> {}
}
```

## API Usage

### Chat Completion (Streaming)

```typescript
const stream = await wllamaInstance.createChatCompletion({
  messages: [
    { role: "system", content: "You are a helpful AI assistant." },
    { role: "user", content: "Hello!" },
  ],
  max_tokens: 512,
  temperature: 0.7,
  top_k: 40,
  top_p: 0.9,
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices?.[0]?.delta?.content;
  if (content) {
    fullContent += content;
    // Update UI with streaming text
  }
}
```

### Model Selection

```typescript
export const MODEL_OPTIONS = [
  {
    id: "qwen2.5-1.5b-instruct",
    name: "Qwen2.5 1.5B Instruct",
    desc: "Q4 quantized GGUF model via wllama (CPU/WASM)",
    size: "~0.7 GB",
  },
] as const;
```

### Model URL

```typescript
// HuggingFace: bartowski/Qwen2.5-1.5B-Instruct-GGUF
// File: Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
export const MODEL_URL = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf";
```

## State Management

### Engine State (reactive)

```typescript
export const engineState = reactive({
  status: "idle" | "checking" | "loading" | "ready" | "error",
  modelId: string | null,
  progress: number,           // 0-100
  progressText: string,       // "Loading WASM runtime..."
  error: string,
  webgpuSupported: boolean | null,
  webllmLoaded: boolean,      // Renamed — actually wllama loaded
  cachedModels: string[],
});
```

### Messages State (reactive)

```typescript
export const messagesState = reactive({
  messages: UserMessage[],
  status: "idle" | "loading" | "success" | "error",
  error: string,
  version: number,            // Incremented on each change for Arrow.js watch
});
```

## Performance Characteristics

### Real-World Results (Samsung Galaxy S21 FE, Chrome Android)

| Metric | Value |
|--------|-------|
| Model | Qwen2.5-1.5B-Instruct Q4_K_M |
| Model Size | ~0.7 GB |
| Download Time (WiFi) | ~30-60 seconds |
| Model Load Time | ~15-30 seconds |
| Inference Speed | 2-8 tokens/sec (CPU) |
| Response Time (50 tokens) | ~10-25 seconds |
| Memory Usage | ~1.5-2.5 GB RAM |
| Context Window | 1024 tokens (low-RAM device) |

### Optimization for Mobile

1. **Reduced context window** — 1024 tokens on devices with ≤4GB RAM
2. **Thread count** — `Math.max(2, Math.min(4, hardwareConcurrency))`
3. **Single model** — Only one model cached at a time to conserve storage
4. **Cache API** — Model persisted across sessions (no re-download)
5. **Progress feedback** — Real-time progress updates during download/load

## Error Handling

### WASM Loading Failure

```typescript
if (errMsg.includes("wasm") || errMsg.includes("WASM") || errMsg.includes("SharedArrayBuffer")) {
  engineState.error = "Failed to load WASM runtime. Make sure COEP/COOP headers are set. Try a different browser or secure context.";
}
```

### Empty Response

```typescript
if (!fullContent || fullContent.trim().length === 0) {
  throw new Error("Model returned an empty response. Try again or reload the page.");
}
```

### Model Cleanup on Error

```typescript
if (wllamaInstance) {
  try { wllamaInstance.exit(); } catch (_) {}
  wllamaInstance = null;
}
```

## Security & Privacy

- **All inference runs locally** — no data leaves the device
- **No network calls for inference** — only model downloads from HuggingFace
- **Sandwiched in browser context** — no server-side processing
- **Can run fully offline** after model download
- **No API keys needed** — completely self-contained

## Browser Requirements

### Minimum Requirements

- **Modern browser** with WebAssembly support (all browsers 2020+)
- **HTTPS or localhost** — required for Cache API
- **~2GB free RAM** — model + WASM runtime overhead
- **~1GB free storage** — model cache (~0.7GB)

### Tested Browsers

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome (Android) | 113+ | **Works** | Primary test platform |
| Samsung Internet | 27+ | **Works** | Tested on Galaxy S21 FE |
| Firefox (Android) | 121+ | Untested | Should work (WASM support) |
| Safari (iOS) | 17+ | Untested | WASM supported, not tested |
| Chrome (Desktop) | 113+ | Untested | Should work |

### COEP/COOP Headers

Required for SharedArrayBuffer (multi-thread WASM), but we use single-thread WASM so these headers are **not strictly required** for wllama. However, they're set in `vite.config.ts` for future compatibility:

```typescript
headers: {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
},
```

## Future Improvements

1. **WebGPU acceleration** — Add WebLLM as fallback for devices with WebGPU support (10-30x faster)
2. **Multiple model support** — Add larger models (3B-7B) for devices with more RAM
3. **OPFS caching** — Use Origin Private File System for faster model loading (requires OPFS support)
4. **Model quantization options** — Support Q3, Q5, Q6 quantizations for quality/speed tradeoffs
5. **Streaming UI improvements** — Better cursor animation, token-by-token rendering
6. **Offline detection** — Show offline status when network is unavailable

## References

- **wllama GitHub:** https://github.com/alexhanna/wllama
- **wllama npm:** `@wllama/wllama`
- **llama.cpp:** https://github.com/ggerganov/llama.cpp
- **GGUF format:** https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
- **Cache API:** https://developer.mozilla.org/en-US/docs/Web/API/Cache_API
- **Qwen2.5-1.5B on HuggingFace:** https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF
