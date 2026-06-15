import { component, html, watch } from "@arrow-js/core";
import {
  engineState,
  messagesState,
  sendMessage,
  loadModel,
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

// ─── Submit Handler ────────────────────────────────────────────────
const submitMessage = async (e: Event) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const chatMessageTextArea = form.chat_message as HTMLTextAreaElement;
  const message = chatMessageTextArea.value.trim();
  if (!message) return;
  chatMessageTextArea.value = "";
  await sendMessage({ role: "user", content: message });
};

// ─── Model Selection Handler ───────────────────────────────────────
const handleModelSelect = async (e: Event) => {
  const select = e.target as HTMLSelectElement;
  const modelId = select.value;
  if (!modelId) return;
  await loadModel(modelId);
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
  // Simple template with no nested html templates
  return html`<div class="message ${message.role}">
    ${message.content}
    ${message.streaming ? "▊" : ""}
  </div>`;
});

// ─── Main App Component ────────────────────────────────────────────
export const App = component(() => {
  // Build all content outside the template to avoid nested html templates
  const options = MODEL_OPTIONS.map((m) => {
    return html`<option value="${m.id}" selected="${engineState.modelId === m.id}">
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

  // Build loading/progress content
  let loadingNode: any = null;
  if (engineState.status === "loading") {
    loadingNode = html`<div class="model-loading">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${engineState.progress + '%'}"></div>
      </div>
      <span class="progress-text">${engineState.progressText}</span>
    </div>`;
  } else if (engineState.status === "ready") {
    const model = MODEL_OPTIONS.find(
      (m) => m.id === engineState.modelId
    );
    loadingNode = html`<div class="model-ready">
      ✓ Loaded: ${model?.name ?? engineState.modelId}
    </div>`;
  } else if (engineState.status === "error") {
    loadingNode = html`<div class="model-error">
      Error: ${engineState.error}
    </div>`;
  } else if (engineState.webgpuSupported === false) {
    loadingNode = html`<div class="model-error">
      ⚠ WebGPU not supported on this device. On-device AI requires a modern browser with WebGPU support (Chrome 113+, Edge 113+, Firefox 121+, Safari 17.4+).
    </div>`;
  }

  // Simple template with NO nested html templates
  // All complex content is built as separate templates above
  return html`<main>
    <header>
      <h1>AI Tool Builder</h1>
      <p class="subtitle">On-device AI — no servers, no API keys</p>
    </header>

    <section class="model-selector">
      <label for="model-select">Model:</label>
      <select
        id="model-select"
        @change="${handleModelSelect}"
        disabled="${engineState.status === 'loading'}"
      >
        <option value="">— Select a model —</option>
        ${options}
      </select>

      ${loadingNode}
    </section>

    <div class="chat-container">
      <section class="messages">
        ${messages}
        ${statusNode}
      </section>
      <section class="chat-input">
        <form @submit="${submitMessage}">
          <textarea
            name="chat_message"
            placeholder="${engineState.status === 'ready' ? 'Write a message...' : 'Select and load a model to start...'}"
            cols="60"
            rows="5"
            disabled="${engineState.status !== 'ready'}"
          ></textarea>
        </form>
      </section>
    </div>
  </main>`;
});
