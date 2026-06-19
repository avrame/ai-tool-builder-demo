import { reactive } from "@arrow-js/core";

// ─── Model Selection ───────────────────────────────────────────────
// Models curated for mobile browser inference (q4f16_1 quantized).
// Smaller models = faster on phones, larger = better quality.
export const MODEL_OPTIONS = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B",
    desc: "Good balance of speed & quality",
    size: "~0.9 GB",
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B",
    desc: "Lightweight, fast on mid-range phones",
    size: "~1.1 GB",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B",
    desc: "Meta's smallest, fastest inference",
    size: "~0.7 GB",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini",
    desc: "Microsoft's model, best quality (slower)",
    size: "~2.4 GB",
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
// NOTE: Store MLCEngine outside reactive() — the Proxy wrapper breaks
// WebLLM's internal state tracking (causes "Model not loaded" errors)
let engineRef: any = null;

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
  version: number; // forces watch() to re-run on streaming updates
}>({
  messages: [],
  status: "idle",
  error: "",
  version: 0,
});

// ─── System Prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI coding assistant. You can write code, explain concepts, and help build tools. When you generate code, it will be rendered in a sandbox for the user to see. Keep responses concise and focused.`;

// ─── GPU Device Lost Handler ───────────────────────────────────────
// WebLLM dispatches a 'gpu-device-lost' event on window when the GPU
// context is lost (e.g., OOM on mobile). Catch it early so the user
// can reload the model instead of seeing a cryptic inference error.
window.addEventListener("gpu-device-lost", (e: Event) => {
  const detail = (e as CustomEvent).detail;
  // Only handle if this event came from WebLLM (has a 'source' field)
  if (detail?.source) {
    console.error("[gpu-device-lost] WebLLM GPU context lost:", detail);
    try { engineRef?.dispose(); } catch (_) {}
    engineRef = null;
    engineState.status = "error";
    engineState.error = "GPU context was lost (device ran out of GPU memory). Please select the model again to reload it.";
  }
});

// ─── GPU Memory Check ──────────────────────────────────────────────
// Probe the GPU adapter limits before loading a model.
// NOTE: getMaxStorageBufferBindingSize() returns a WebGPU API limit, NOT
// physical VRAM. On mobile Adreno it often returns 2^27 (128 MB) even
// though the GPU has 4-6 GB of real memory. So we only use this as a
// very soft heuristic — if the value is suspiciously low we warn, but
// we do NOT block the load. The real test is whether the model loads.
export async function checkGPUMemory(): Promise<{
  maxBufferBytes: number;
  maxBufferGB: number;
  vendor: string;
  limitedDevice: boolean; // soft hint, not a hard block
}> {
  const result = {
    maxBufferBytes: 0,
    maxBufferGB: 0,
    vendor: "",
    limitedDevice: false,
  };

  if (!("gpu" in navigator)) {
    return result;
  }

  try {
    const webllm = await import("@mlc-ai/web-llm");
    const probeEngine = new webllm.MLCEngine();

    result.maxBufferBytes = await probeEngine.getMaxStorageBufferBindingSize();
    result.maxBufferGB = result.maxBufferBytes / (1024 ** 3);
    result.vendor = await probeEngine.getGPUVendor();

    // WebGPU maxStorageBufferBindingSize on mobile is often 2^27 (128 MB)
    // regardless of actual VRAM. Values >= 2^30 (1 GB) are more likely
    // to reflect a genuinely capable device. We flag < 1 GB as "possibly
    // limited" but do NOT block — many phones that report 128 MB can still
    // run small models fine.
    const ONE_GB = 1024 ** 3;
    result.limitedDevice = result.maxBufferBytes < ONE_GB;

    console.log(
      `[GPU check] vendor=${result.vendor}, maxBuffer=${result.maxBufferGB.toFixed(2)}GB, ` +
      `limited=${result.limitedDevice}`
    );
  } catch (err) {
    console.warn("[GPU check] failed to probe:", err);
  }

  return result;
}

// ─── WebGPU Check ──────────────────────────────────────────────────
export async function checkWebGPUSupport(): Promise<boolean> {
  if (!("gpu" in navigator)) {
    engineState.webgpuSupported = false;
    return false;
  }
  try {
    const nav = navigator as unknown as {
      gpu?: { requestAdapter: () => Promise<{ info: { getName: () => string } } | null> };
    };
    const adapter = await nav.gpu!.requestAdapter();
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
    // indexedDB.databases() is available in modern browsers
    const nav = navigator as unknown as {
      indexedDB?: {
        databases?: () => Promise<
          Array<{ name?: string; version?: number }>
        >;
      };
    };
    if (!nav.indexedDB?.databases) {
      return [];
    }
    const databases = await nav.indexedDB.databases();
    // WebLLM stores models in databases named like "mlc-ai---<modelId>"
    const cached: string[] = [];
    for (const db of databases) {
      if (!db.name) continue;
      for (const model of MODEL_OPTIONS) {
        if (db.name.includes(model.id)) {
          cached.push(model.id);
        }
      }
    }
    engineState.cachedModels = cached;
    return cached;
  } catch (err) {
    console.warn("Failed to check cached models:", err);
    return [];
  }
}

// ─── Reset Engine State (after GPU crash or user choice) ───────────
export function resetEngineState(): void {
  // Dispose the engine if it still exists (GPU may be in bad state)
  if (engineRef) {
    try { engineRef.dispose(); } catch (_) {}
    engineRef = null;
  }
  engineState.status = "idle";
  engineState.error = "";
  engineState.progress = 0;
  engineState.progressText = "";
}

// ─── Load WebLLM (lazy) ───────────────────────────────────────────
async function loadWebLLM(): Promise<typeof import("@mlc-ai/web-llm")> {
  if (engineState.webllmLoaded) {
    return await import("@mlc-ai/web-llm");
  }
  const mod = await import("@mlc-ai/web-llm");
  engineState.webllmLoaded = true;
  return mod;
}

// ─── Load Model ────────────────────────────────────────────────────
export async function loadModel(modelId: string): Promise<void> {
  engineState.status = "loading";
  engineState.modelId = modelId;
  engineState.error = "";
  engineState.progress = 0;
  engineState.progressText = "Loading AI engine...";

  // Pre-flight: probe GPU adapter limits (logged, not blocking).
  // getMaxStorageBufferBindingSize() returns a WebGPU API limit (often
  // 128 MB on mobile) that does not reflect actual VRAM. We log it for
  // diagnostics but do not prevent the load.
  const gpuInfo = await checkGPUMemory();
  if (gpuInfo.limitedDevice) {
    console.warn(
      "[loadModel] GPU reports low buffer limit (" +
      gpuInfo.maxBufferGB.toFixed(2) + " GB). WebGPU API limit, not real VRAM — " +
      "the model may still load fine. If it crashes, try a smaller model."
    );
  }

  engineState.progressText = "Loading AI engine...";

  try {
    // Lazy load WebLLM only when user selects a model
    const { CreateMLCEngine, prebuiltAppConfig } = await loadWebLLM();

    // Aggressively reduce context window to limit GPU memory pressure.
    // Default is 4096 tokens — on mobile Adreno GPUs the KV cache at that
    // size exceeds available VRAM and crashes the GPU process.
    // 256 tokens is enough for single-turn Q&A. Users on constrained devices
    // can increase this in the source if needed.
    const chatOpts = { context_window_size: 256 };

    engineRef = await CreateMLCEngine(modelId, {
      appConfig: { ...prebuiltAppConfig, cacheBackend: "indexeddb" },
      initProgressCallback: (report: any) => {
        engineState.progressText = report.text;
        const match = report.text.match(/(\d+)%/);
        if (match) {
          engineState.progress = parseInt(match[1], 10);
        }
      },
    }, chatOpts);

    engineState.status = "ready";
    console.log("[loadModel] model ready:", modelId);
    // Ensure loaded model is tracked as cached
    if (!engineState.cachedModels.includes(modelId)) {
      engineState.cachedModels.push(modelId);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Check if this is a WebGPU device loss error
    if (errMsg.includes("mapAsync") || errMsg.includes("GPUBuffer") || errMsg.includes("external Instance")) {
      console.error("[loadModel] WebGPU device lost during init!");
      engineState.error =
        "GPU context was lost during model initialization. " +
        "This device may not have enough GPU memory for this model. " +
        "Try the smallest model (Llama 3.2 1B) or reload the page.";
    } else if (errMsg.includes("device lost") || errMsg.includes("context lost") || errMsg.includes("GPU process")) {
      console.error("[loadModel] GPU context/process lost!");
      engineState.error =
        "GPU crashed during model loading. " +
        "The GPU ran out of memory. Try a smaller model or reload the page.";
    } else {
      engineState.error = errMsg;
    }

    engineState.status = "error";
    throw err;
  }
}

// ─── Send Message (WebLLM) ─────────────────────────────────────────
export async function sendMessage(message: UserMessage): Promise<void> {
  if (!engineRef) {
    throw new Error("Model not loaded. Please select and load a model first.");
  }

  messagesState.status = "loading";

  // Add user message to history
  const userMsg: UserMessage = { role: "user", content: message.content };
  messagesState.messages.push(userMsg);

  // Create a placeholder for the assistant response
  const assistantMsgIndex = messagesState.messages.length;
  messagesState.messages.push({
    role: "assistant",
    content: "",
    streaming: true,
  });

  try {
    // Build conversation history — exclude the streaming assistant placeholder
    // (it has empty content and would confuse the model)
    const conversation: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messagesState.messages
        .filter((m, i) => i !== assistantMsgIndex)
        .map((m) => {
          if (m.sandboxSource !== undefined) {
            return { role: "assistant", content: "AI built the tool." };
          }
          return { role: m.role, content: m.content ?? "" };
        }),
    ];

    console.log("[send-message] sending conversation:", JSON.stringify(conversation));

    // Use non-streaming mode to avoid Map.prototype.keys bug on mobile Chrome
    // Streaming triggers cross-worker Map iteration which fails on Android Chrome
    let fullContent = "";

    try {
      console.log("[send-message] running non-streaming inference...");
      await (engineRef as any).chat.completions.create({
        messages: conversation as any,
        stream: false,
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
      });
      fullContent = await (engineRef as any).getMessage();
      console.log(`[send-message] response: ${fullContent.length} chars`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[send-message] inference failed:", err);

      // Check if this is a WebGPU device loss error
      if (errMsg.includes("mapAsync") || errMsg.includes("GPUBuffer") || errMsg.includes("external Instance")) {
        console.error("[send-message] WebGPU device lost! Resetting engine...");
        try { await (engineRef as any).dispose(); } catch (_) {}
        engineRef = null;
        throw new Error("GPU context was lost during inference. The device ran out of GPU memory. Please reload the page and try the smallest model.");
      }

      // Check for GPU process crash
      if (errMsg.includes("device lost") || errMsg.includes("context lost") || errMsg.includes("GPU process")) {
        console.error("[send-message] GPU crashed during inference!");
        try { await (engineRef as any).dispose(); } catch (_) {}
        engineRef = null;
        throw new Error("GPU crashed during inference. The model may be too large for this device. Try reloading with a smaller model.");
      }

      // Check for Map.prototype.keys bug
      if (errMsg.includes("Map.prototype") || errMsg.includes("incompatible receiver")) {
        console.error("[send-message] Map.prototype bug detected.");
        try { await (engineRef as any).dispose(); } catch (_) {}
        engineRef = null;
        throw new Error("Model runtime error. Please reload the page and try again.");
      }

      throw err;
    }

    // Set the assistant response content
    if (messagesState.messages[assistantMsgIndex]) {
      messagesState.messages[assistantMsgIndex] = {
        ...messagesState.messages[assistantMsgIndex],
        content: fullContent,
        streaming: false,
      };
      messagesState.version++;
    }

    // Check if the AI generated a tool use (code block)
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
    console.error("[send-message] error:", err);
    // Replace the streaming placeholder with the error message
    messagesState.messages.pop();
    messagesState.messages.push({
      role: "assistant",
      content: `⚠️ Error: ${err instanceof Error ? err.message : String(err)}`,
    });
    messagesState.version++;
    throw err;
  }
}
