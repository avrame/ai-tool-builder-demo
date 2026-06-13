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
import { sandbox } from "@arrow-js/sandbox";

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
const Message = component((message: UserMessage) => {
  if (message.sandboxSource) {
    return html`<div class="message tool">
      ${sandbox({ source: message.sandboxSource })}
    </div>`;
  }
  return html`<div class="${`message ${message.role}`}">
    ${message.content}
    ${() => message.streaming ? html`<span class="streaming-cursor">▊</span>` : null}
  </div>`;
});

// ─── Render Messages ───────────────────────────────────────────────
const renderMessages = () => {
  return messagesState.messages.map((msg: UserMessage) => Message(msg));
};

// ─── Main App Component ────────────────────────────────────────────
export const App = component(() => {
  return html`<main>
    <header>
      <h1>AI Tool Builder</h1>
      <p class="subtitle">On-device AI — no servers, no API keys</p>
    </header>

    <!-- Model Selection Panel -->
    <section class="model-selector">
      <label for="model-select">Model:</label>
      <select
        id="model-select"
        @change="${handleModelSelect}"
        disabled="${() => engineState.status === 'loading'}"
      >
        <option value="">— Select a model —</option>
        ${() =>
          MODEL_OPTIONS.map((m) =>
            html`<option
              value="${m.id}"
              selected="${() => engineState.modelId === m.id}"
            >
              ${m.name} (${m.size})
            </option>`
          )}
      </select>

      <!-- Loading/Progress -->
      ${() => {
        if (engineState.status === "loading") {
          return html`<div class="model-loading">
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: ${() => `${engineState.progress}%`}"
              ></div>
            </div>
            <span class="progress-text">${() => engineState.progressText}</span>
          </div>`;
        }
        if (engineState.status === "ready") {
          const model = MODEL_OPTIONS.find(
            (m) => m.id === engineState.modelId
          );
          return html`<div class="model-ready">
            ✓ Loaded: ${() => model?.name ?? engineState.modelId}
          </div>`;
        }
        if (engineState.status === "error") {
          return html`<div class="model-error">
            Error: ${() => engineState.error}
          </div>`;
        }
        if (engineState.webgpuSupported === false) {
          return html`<div class="model-error">
            ⚠ WebGPU not supported on this device. On-device AI requires a modern browser with WebGPU support (Chrome 113+, Edge 113+, Firefox 121+, Safari 17.4+).
          </div>`;
        }
        return null;
      }}
    </section>

    <!-- Chat Container -->
    <div class="chat-container">
      <section class="messages">
        ${() =>
          messagesState.messages.map((message: UserMessage) => {
            return Message(message);
          })}
        ${() => {
          if (messagesState.status === "loading") {
            return html`<div class="loader"></div>`;
          }
          if (messagesState.status === "error") {
            return html`<div class="error">Error: ${messagesState.error}</div>`;
          }
          return null;
        }}
      </section>
      <section class="chat-input">
        <form @submit="${submitMessage}">
          <textarea
            name="chat_message"
            placeholder="${() =>
              engineState.status === "ready"
                ? "Write a message..."
                : "Select and load a model to start..."}"
            cols="60"
            rows="5"
            disabled="${() => engineState.status !== 'ready'}"
            @keydown="${(e: Event) => {
              const ke = e as KeyboardEvent;
              if (ke.key === "Enter" && !ke.shiftKey) {
                ke.preventDefault();
                (ke.target as HTMLTextAreaElement).form?.requestSubmit();
              }
            }}"
          ></textarea>
        </form>
      </section>
    </div>
  </main>`;
});
