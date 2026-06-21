import { component, html, watch } from "@arrow-js/core";
import {
  engineState,
  messagesState,
  sendMessage,
  loadModel,
  resetEngineState,
  MODEL_OPTIONS,
  checkWebGPUSupport,
  type ModelOption,
  type UserMessage,
} from "./send-message";

// ─── Auto-scroll on new messages ───────────────────────────────────
watch(() => {
  if (messagesState.messages.length > 0) {
    setTimeout(() => {
      const messagesContainer = document.querySelector(".messages");
      if (messagesContainer) {
        messagesContainer.scrollTo({
          behavior: "smooth",
          top: messagesContainer.scrollHeight,
        });
      }
    }, 0);
  }
});

// ─── Imperative UI updates via watch ───────────────────────────────
// Arrow.js doesn't re-run component() on reactive changes.
// We use watch() to track engineState and update the DOM imperatively.
watch(() => {
  // Read reactive values to register dependencies
  const status = engineState.status;
  const progress = engineState.progress;
  const progressText = engineState.progressText;
  const error = engineState.error;
  void { status, progress, progressText, error };

  const selector = document.querySelector(".model-selector") as HTMLElement | null;
  const download = document.querySelector(".model-download-progress") as HTMLElement | null;
  const errorSection = document.querySelector(".model-download-error") as HTMLElement | null;
  const readyBanner = document.querySelector(".model-ready-banner") as HTMLElement | null;
  const progressFill = document.querySelector(".progress-fill") as HTMLElement | null;
  const progressTextEl = document.querySelector(".progress-text") as HTMLElement | null;
  const errorTextEl = document.querySelector(".model-error-text") as HTMLElement | null;
  const select = document.getElementById("model-select") as HTMLSelectElement | null;
  const textarea = document.querySelector("textarea[name='chat_message']") as HTMLTextAreaElement | null;
  const sendBtn = document.querySelector(".send-btn") as HTMLButtonElement | null;

  // Toggle section visibility
  const isDownloading = status === "loading" || status === "error";
  if (selector) selector.style.display = isDownloading ? "none" : "flex";
  if (download) download.style.display = status === "loading" ? "flex" : "none";
  if (errorSection) errorSection.style.display = status === "error" ? "flex" : "none";
  if (readyBanner) readyBanner.style.display = status === "ready" ? "block" : "none";

  // Update progress bar
  if (progressFill && status === "loading") {
    progressFill.style.width = `${progress}%`;
  }
  if (progressTextEl && status === "loading") {
    progressTextEl.textContent = progressText;
  }
  if (errorTextEl && status === "error") {
    errorTextEl.textContent = error;
  }

  // Update form controls
  if (select) select.disabled = status === "loading";
  if (textarea) {
    textarea.disabled = status !== "ready";
    textarea.placeholder = status === "ready"
      ? "Write a message..."
      : "Select and load a model to start...";
  }
  if (sendBtn) {
    sendBtn.disabled = status !== "ready";
  }
});

// ─── Watch for new messages and render them imperatively ────────────
let lastMessageCount = 0;
let lastVersion = 0;
watch(() => {
  const msgs = messagesState.messages;
  const version = messagesState.version;
  const count = msgs.length;
  const container = document.querySelector(".messages");
  if (!container) return;

  // Re-render when message count changes OR streaming content updates
  const needsRender = count !== lastMessageCount || version !== lastVersion;
  if (!needsRender) return;

  lastMessageCount = count;
  lastVersion = version;

  // Clear and rebuild messages
  container.innerHTML = "";
  for (const msg of msgs) {
    const div = document.createElement("div");
    if (msg.sandboxSource) {
      div.className = "message tool";
      div.textContent = "[Tool output]";
    } else {
      div.className = `message ${msg.role}`;
      div.textContent = msg.content || "";
      if (msg.streaming) {
        const cursor = document.createElement("span");
        cursor.className = "streaming-cursor";
        div.appendChild(cursor);
      }
    }
    container.appendChild(div);
  }
  // Auto-scroll
  container.scrollTop = container.scrollHeight;
});

// ─── Submit Handler ────────────────────────────────────────────────
const submitMessage = async (e: Event) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const chatMessageTextArea = form.chat_message as HTMLTextAreaElement;
  const message = chatMessageTextArea.value.trim();
  if (!message) return;
  chatMessageTextArea.value = "";
  try {
    await sendMessage({ role: "user", content: message });
  } catch (err) {
    console.error("[App] sendMessage failed:", err);
    // Error is already shown in the chat by sendMessage
  }
};

// ─── Model Selection Handler ───────────────────────────────────────
const handleModelSelect = async (e: Event) => {
  const select = e.target as HTMLSelectElement;
  const modelId = select.value;
  if (!modelId) return;
  await loadModel(modelId);
};

// ─── Back Button Handler ───────────────────────────────────────────
const handleBack = () => {
  resetEngineState();
};

// ─── Message Component ─────────────────────────────────────────────
let sandboxModule: any = null;

async function getSandbox() {
  if (!sandboxModule) {
    sandboxModule = await import("@arrow-js/sandbox");
  }
  return sandboxModule;
}

const Message = component(async (message: UserMessage) => {
  if (message.sandboxSource) {
    const mod = await getSandbox();
    return html`<div class="message tool">
      ${mod.sandbox({ source: message.sandboxSource })}
    </div>`;
  }
  return html`<div class="message ${message.role}">
    ${message.content}
    ${message.streaming ? "▊" : ""}
  </div>`;
});

// ─── Main App Component ────────────────────────────────────────────
export const App = component(() => {
  // Build options outside template
  const options = MODEL_OPTIONS.map((m) => {
    return html`<option value="${m.id}">
      ${m.name} (${m.size})
    </option>`;
  });

  // Build messages array
  const messages = messagesState.messages.map((msg: UserMessage) =>
    Message(msg)
  );

  // Build status content
  let statusNode: any = null;
  if (messagesState.status === "loading") {
    statusNode = html`<div class="loader"></div>`;
  } else if (messagesState.status === "error") {
    statusNode = html`<div class="error">Error: ${messagesState.error}</div>`;
  }

  // Build cached models message
  let cachedNode: any = null;
  if (engineState.cachedModels.length > 0) {
    const cachedNames = engineState.cachedModels
      .map((id) => MODEL_OPTIONS.find((m) => m.id === id)?.name ?? id)
      .join(", ");
    cachedNode = html`<div class="model-cached">
      💾 Cached: ${cachedNames} (ready to use)
    </div>`;
  }

  // Build ready banner (prominent, above selector)
  let readyBannerNode: any = null;
  if (engineState.status === "ready") {
    const model = MODEL_OPTIONS.find(
      (m) => m.id === engineState.modelId
    );
    readyBannerNode = html`<div class="model-ready-banner">
      🚀 Model is ready! (${model?.name ?? engineState.modelId})
    </div>`;
  }

  // Build runtime info (informational — wllama runs on CPU/WASM, no WebGPU needed)
  let webgpuNode: any = null;
  if (engineState.webgpuSupported === false) {
    webgpuNode = html`<div class="model-info">
      ℹ Running on wllama (CPU/WASM) — no WebGPU required.
    </div>`;
  } else if (engineState.webgpuSupported === true) {
    webgpuNode = html`<div class="model-info">
      ℹ Running on wllama (CPU/WASM).
    </div>`;
  }

  // Flat template — all sections always present, visibility controlled by watch()
  return html`<main>
    <header>
      <h1>AI Tool Builder</h1>
      <p class="subtitle">On-device AI — no servers, no API keys</p>
    </header>

    ${readyBannerNode}

    <section class="model-selector">
      <label for="model-select">Model:</label>
      <select
        id="model-select"
        @change="${handleModelSelect}"
      >
        <option value="">— Select a model —</option>
        ${options}
      </select>

      ${cachedNode}
      ${webgpuNode}
    </section>

    <section class="model-download model-download-progress">
      <div class="model-download-title">Downloading model...</div>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <span class="progress-text"></span>
    </section>

    <section class="model-download model-download-error">
      <div class="model-error">
        Model failed to load: <span class="model-error-text"></span>
      </div>
      <button class="back-btn" @click="${handleBack}">← Back to model selector</button>
    </section>

    <div class="chat-container">
      <section class="messages">
        ${statusNode}
      </section>
      <section class="chat-input">
        <form @submit="${submitMessage}">
          <textarea
            name="chat_message"
            cols="60"
            rows="3"
          ></textarea>
          <button type="submit" class="send-btn">Send</button>
        </form>
      </section>
    </div>
  </main>`;
});
