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
export const engineState = reactive<{
  engine: any | null;
  status: "idle" | "checking" | "loading" | "ready" | "error";
  modelId: string | null;
  progress: number;
  progressText: string;
  error: string;
  webgpuSupported: boolean | null;
  webllmLoaded: boolean;
}>({
  engine: null,
  status: "idle",
  modelId: null,
  progress: 0,
  progressText: "",
  error: "",
  webgpuSupported: null,
  webllmLoaded: false,
});

// ─── Chat State ────────────────────────────────────────────────────
export const messagesState = reactive<{
  messages: UserMessage[];
  status: "idle" | "loading" | "success" | "error";
  error: string;
}>({
  messages: [],
  status: "idle",
  error: "",
});

// ─── System Prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI coding assistant. You can write code, explain concepts, and help build tools. When you generate code, it will be rendered in a sandbox for the user to see. Keep responses concise and focused.`;

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

  try {
    // Lazy load WebLLM only when user selects a model
    const { CreateMLCEngine } = await loadWebLLM();

    engineState.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report: any) => {
        engineState.progressText = report.text;
        const match = report.text.match(/(\d+)%/);
        if (match) {
          engineState.progress = parseInt(match[1], 10);
        }
      },
    });
    engineState.status = "ready";
  } catch (err) {
    engineState.status = "error";
    engineState.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

// ─── Send Message (WebLLM) ─────────────────────────────────────────
export async function sendMessage(message: UserMessage): Promise<void> {
  if (!engineState.engine) {
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
    // Build conversation history (strip streaming flag, exclude sandbox sources)
    const conversation: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messagesState.messages.map((m) => {
        if (m.sandboxSource !== undefined) {
          return { role: "assistant", content: "AI built the tool." };
        }
        return {
          role: m.role,
          content: m.content ?? "",
        };
      }),
    ];

    // Stream the response
    const chunks = await (engineState.engine as any).chat.completions.create({
      messages: conversation as any,
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
    });

    let fullContent = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content || "";
      fullContent += content;

      // Update the streaming message in place
      if (messagesState.messages[assistantMsgIndex]) {
        messagesState.messages[assistantMsgIndex] = {
          ...messagesState.messages[assistantMsgIndex],
          content: fullContent,
        };
      }
    }

    // Finalize the message
    if (messagesState.messages[assistantMsgIndex]) {
      messagesState.messages[assistantMsgIndex] = {
        ...messagesState.messages[assistantMsgIndex],
        streaming: false,
      };
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
    messagesState.messages.pop();
    throw err;
  }
}
