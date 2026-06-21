import { reactive } from "@arrow-js/core";
import { Wllama, CacheManager, type StorageBackend } from '@wllama/wllama';
import { getCachedModelBlob, downloadAndCacheModel, MODEL_URL } from "./model-cache";

/**
 * No-op in-memory storage backend.
 *
 * wllama's default CacheManager requires OPFS (navigator.storage.getDirectory),
 * which is unavailable on Chrome Android when COEP/COOP headers are active
 * (needed for SharedArrayBuffer / multi-thread WASM).  Since we handle model
 * caching ourselves via the Cache API (model-cache.ts), we supply this dummy
 * backend so the Wllama constructor does not throw "No supported storage
 * backend found".
 */
class NoOpStorageBackend implements StorageBackend {
  isSupported(): boolean {
    return true;
  }
  async read(_key: string): Promise<Blob | null> {
    return null;
  }
  async write(_key: string, _stream: ReadableStream): Promise<void> {}
  async getSize(_key: string): Promise<number> {
    return -1;
  }
  async list(): Promise<Array<{ key: string; size: number }>> {
    return [];
  }
  async delete(_key: string): Promise<void> {}
}

// ─── Model Selection ───────────────────────────────────────────────
export const MODEL_OPTIONS = [
  {
    id: "qwen2.5-1.5b-instruct",
    name: "Qwen2.5 1.5B Instruct",
    desc: "Q4 quantized GGUF model via wllama (WASM/CPU)",
    size: "~0.7 GB",
  },
] as const;

export type ModelOption = (typeof MODEL_OPTIONS)[number];

// ─── Message Types ─────────────────────────────────────────────────
export type UserMessage = {
  role: "user" | "assistant";
  content?: string;
  sandboxSource?: object;
  streaming?: boolean;
};

// ─── Engine State ──────────────────────────────────────────────────
let wllamaInstance: Wllama | null = null;

export const engineState = reactive<{
  status: "idle" | "checking" | "loading" | "ready" | "error";
  modelId: string | null;
  progress: number;
  progressText: string;
  error: string;
  webgpuSupported: boolean | null;
  webllmLoaded: boolean;
  cachedModels: string[];
}>({
  status: "idle",
  modelId: null,
  progress: 0,
  progressText: "",
  error: "",
  webgpuSupported: null,
  webllmLoaded: false,
  cachedModels: [],
});

// ─── Chat State ────────────────────────────────────────────────────
export const messagesState = reactive<{
  messages: UserMessage[];
  status: "idle" | "loading" | "success" | "error";
  error: string;
  version: number;
}>({
  messages: [],
  status: "idle",
  error: "",
  version: 0,
});

// ─── System Prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI assistant.`;

// ─── WebGPU Check (informational only — wllama runs on CPU/WASM) ──
export async function checkWebGPUSupport(): Promise<boolean> {
  if (!("gpu" in navigator)) {
    engineState.webgpuSupported = false;
    return false;
  }
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) {
      engineState.webgpuSupported = false;
      return false;
    }
    const adapter = await gpu.requestAdapter();
    engineState.webgpuSupported = !!adapter;
    return !!adapter;
  } catch {
    engineState.webgpuSupported = false;
    return false;
  }
}

// ─── Check Cached Models ───────────────────────────────────────────
export async function checkCachedModels(): Promise<string[]> {
  try {
    const cachedBlob = await getCachedModelBlob();
    const cached: string[] = [];
    if (cachedBlob) {
      for (const model of MODEL_OPTIONS) {
        cached.push(model.id);
      }
    }
    engineState.cachedModels = cached;
    return cached;
  } catch (err) {
    console.warn("Failed to check cached models:", err);
    return [];
  }
}

// ─── Reset Engine State ────────────────────────────────────────────
export function resetEngineState(): void {
  if (wllamaInstance) {
    try { wllamaInstance.exit(); } catch (_) {}
    wllamaInstance = null;
  }
  engineState.status = "idle";
  engineState.error = "";
  engineState.progress = 0;
  engineState.progressText = "";
}

// ─── Load Model ────────────────────────────────────────────────────
export async function loadModel(modelId: string): Promise<void> {
  engineState.status = "loading";
  engineState.modelId = modelId;
  engineState.error = "";
  engineState.progress = 0;
  engineState.progressText = "Loading WASM runtime...";

  try {
    engineState.progress = 10;
    engineState.progressText = "Initializing WASM...";

    const deviceMemory = (navigator as any).deviceMemory || 4;
    const nThreads = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4)));
    const nCtx = deviceMemory <= 4 ? 1024 : 2048;

    if (deviceMemory <= 4) {
      engineState.progressText = `Low-RAM device detected (${deviceMemory}GB). Using reduced context (1024 tokens).`;
    }

    // wllama v3.1+ uses a single unified WASM build with 'default' key
    const WLLAMA_CONFIG_PATHS = {
      default: `https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/wasm/wllama.wasm`,
    };

    wllamaInstance = new Wllama(WLLAMA_CONFIG_PATHS, {
      cacheManager: new CacheManager([new NoOpStorageBackend()]),
    });

    const cacheAvailable = "caches" in globalThis;
    if (!cacheAvailable) {
      console.warn("Cache API not available, downloading model fresh");
    }

    const cachedBlob = await getCachedModelBlob();

    if (cachedBlob && cacheAvailable) {
      engineState.progressText = "Loading model from cache...";
      engineState.progress = 30;

      await wllamaInstance.loadModel([cachedBlob], {
        n_threads: nThreads,
        n_ctx: nCtx,
      });
    } else {
      engineState.progressText = "Downloading model (~700MB)...";
      engineState.progress = 20;

      const blob = await downloadAndCacheModel(
        MODEL_URL,
        (pct, text) => {
          engineState.progress = pct;
          engineState.progressText = text;
        }
      );

      engineState.progress = 60;
      engineState.progressText = "Loading model...";

      await wllamaInstance.loadModel([blob], {
        n_threads: nThreads,
        n_ctx: nCtx,
      });
    }

    engineState.progress = 100;
    engineState.progressText = "Model loaded";
    engineState.status = "ready";
    engineState.webllmLoaded = true;

    if (!engineState.cachedModels.includes(modelId)) {
      engineState.cachedModels.push(modelId);
    }
    console.log("[llm-engine] model ready:", modelId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (wllamaInstance) {
      try { wllamaInstance.exit(); } catch (_) {}
      wllamaInstance = null;
    }

    if (errMsg.includes("wasm") || errMsg.includes("WASM") || errMsg.includes("SharedArrayBuffer")) {
      engineState.error = "Failed to load WASM runtime. Make sure COEP/COOP headers are set. Try a different browser or secure context.";
    } else {
      engineState.error = `Failed to load model: ${errMsg}`;
    }
    engineState.status = "error";
    throw err;
  }
}

// ─── Send Message ──────────────────────────────────────────────────
export async function sendMessage(message: UserMessage): Promise<void> {
  if (!wllamaInstance) {
    throw new Error("Model not loaded. Please select and load a model first.");
  }

  messagesState.status = "loading";

  const userMsg: UserMessage = { role: "user", content: message.content };
  messagesState.messages.push(userMsg);

  const assistantMsgIndex = messagesState.messages.length;
  messagesState.messages.push({
    role: "assistant",
    content: "",
    streaming: true,
  });

  try {
    const recent = messagesState.messages.slice(0, -1).slice(-8);
    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    for (const msg of recent) {
      if (msg.role === "user") {
        apiMessages.push({ role: "user", content: msg.content ?? "" });
      } else if (msg.role === "assistant") {
        const content = msg.sandboxSource ? "AI built the tool." : (msg.content ?? "");
        apiMessages.push({ role: "assistant", content });
      }
    }

    console.log("[llm-engine] generating response...");

    let fullContent = "";
    const stream = await wllamaInstance.createChatCompletion({
      messages: apiMessages,
      max_tokens: 512,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.9,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
      }

      if (messagesState.messages[assistantMsgIndex]) {
        messagesState.messages[assistantMsgIndex] = {
          ...messagesState.messages[assistantMsgIndex],
          content: fullContent,
          streaming: true,
        };
        messagesState.version++;
      }
    }

    if (messagesState.messages[assistantMsgIndex]) {
      messagesState.messages[assistantMsgIndex] = {
        ...messagesState.messages[assistantMsgIndex],
        content: fullContent,
        streaming: false,
      };
      messagesState.version++;
    }

    if (!fullContent || fullContent.trim().length === 0) {
      console.error("[llm-engine] Empty response from model");
      throw new Error("Model returned an empty response. Try again or reload the page.");
    }

    const toolMatch = fullContent.match(
      /```(?:sandbox|javascript|js|typescript|ts)?\n([\s\S]*?)```/
    );
    if (toolMatch?.[1]) {
      messagesState.messages.push({
        role: "assistant",
        sandboxSource: { source: toolMatch[1] },
      });
    }

    messagesState.status = "success";
  } catch (err) {
    messagesState.status = "error";
    messagesState.error = err instanceof Error ? err.message : String(err);
    console.error("[llm-engine] error:", err);

    messagesState.messages.pop();
    messagesState.messages.push({
      role: "assistant",
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
    messagesState.version++;
    throw err;
  }
}
