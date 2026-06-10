import { component, html, watch } from "@arrow-js/core";

import { sendMessage, messagesState, UserMessage } from "./send-message";

let sandboxImport: any;

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

const submitMessage = async (e: SubmitEvent) => {
  e.preventDefault();

  const chatMessageTextArea = (e.target as HTMLFormElement).chat_message;
  const message = chatMessageTextArea.value;
  chatMessageTextArea.value = "";

  const response = await sendMessage({
    role: "user",
    content: message,
  });

  if (response.content) {
    messagesState.messages.push({
      role: "assistant",
      content: response.content,
    });
  }

  if (response.toolUse?.input?.source) {
    if (!sandboxImport) {
      sandboxImport = await import("@arrow-js/sandbox");
    }
    messagesState.messages.push({
      role: "assistant",
      sandboxSource: response.toolUse.input.source,
    });
  }
};

const Message = component((message: UserMessage) => {
  if (message.sandboxSource) {
    return html`<div class="tool">
      ${sandboxImport.sandbox({ source: message.sandboxSource })}
    </div>`;
  }
  return html`<div class="${message.role}">${message.content}</div>`;
});

export const App = component(() => {
  return html`<main>
    <h1>AI Tool Builder Demo</h1>
    <div class="chat-container">
      <section class="messages">
        ${() =>
          messagesState.messages.map((message) => {
            return Message(message);
          })}
      </section>
      <section class="chat-input">
        <form
          @submit="${(e: SubmitEvent) => {
            submitMessage(e);
          }}"
        >
          <textarea
            name="chat_message"
            placeholder="Write a message..."
            cols="60"
            rows="5"
            @keydown="${(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).form?.requestSubmit();
              }
            }}"
          ></textarea>
        </form>
      </section>
    </div>
  </main>`;
});
