import { component, html, reactive } from "@arrow-js/core";
let sandboxImport: any;
let conversationId: string;

type LMStudioResponse = {
  id: string;
  object: "response";
  created_at: number;
  completed_at: number;
  status: "completed" | "pending";
  model: string;
  previous_response_id: null | string;
  instructions: null;
  output: LMOutput[];
};

type LMOutputType = "message" | "reasoning" | "function_call";
type LMRole = "user" | "assistant";

type LMOutput = {
  id: string;
  type: LMOutputType;
  role: LMRole;
  status: "completed" | "pending";
  content?: LMContent[];
  arguments?: LMArguments[];
};

type LMContent = {
  type: "reasoning_text" | "output_text";
  text: string;
};

type LMArguments = {
  source: string;
};

type ChatMessage = {
  id: string;
  type: LMOutputType;
  role: LMRole;
  text?: string;
  source?: string;
};

const responseState = reactive<{
  status: string;
  messages: ChatMessage[];
}>({
  status: "",
  messages: [],
});

const submitMessage = async (e: SubmitEvent) => {
  e.preventDefault();
  if (!sandboxImport) {
    sandboxImport = await import("@arrow-js/sandbox");
  }

  responseState.status = "loading";
  const chatMessage = (e.target as HTMLFormElement).chat_message;
  const message = chatMessage.value;
  responseState.messages = [
    ...responseState.messages,
    {
      id: new Date().toISOString(),
      type: "message",
      role: "user" as const,
      text: message,
    },
  ];
  chatMessage.value = "";
  const response = await fetch("http://localhost:1234/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-35b-a3b",
      input: message,
      previous_response_id: conversationId,
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          name: "create_arrow_sandbox",
          description: "Produce arguments for @arrow-js/sandbox.",
          parameters: {
            type: "object",
            properties: {
              source: {
                type: "object",
                description:
                  "Virtual files passed to sandbox({ source }). Must include main.ts or main.js. main.css is optional.",
                additionalProperties: false,
                properties: {
                  "main.ts": {
                    type: "string",
                    description: "Main Arrow TypeScript entry file.",
                  },
                  "main.js": {
                    type: "string",
                    description: "Main Arrow JavaScript entry file.",
                  },
                  "main.css": {
                    type: "string",
                    description: "Optional stylesheet for the sandbox root.",
                  },
                },
                anyOf: [{ required: ["main.ts"] }, { required: ["main.js"] }],
              },
              shadowDOM: {
                type: "boolean",
                description:
                  "Whether the sandbox should render inside shadow DOM.",
              },
              debug: {
                type: "boolean",
                description: "Whether sandbox debug logging should be enabled.",
              },
            },
            required: ["source"],
          },
        },
      ],
    }),
  });
  const data = (await response.json()) as LMStudioResponse;
  conversationId = data.id;
  responseState.messages = [
    ...responseState.messages,
    ...data.output.map((op: any) => ({
      id: op.id,
      type: op.type,
      role: "assistant" as const,
      text: op.content?.map((c: any) => c.text).join("\n"),
      source: op.arguments ? JSON.parse(op.arguments).source : undefined,
    })),
  ];
  responseState.status = response.ok ? "success" : "error";
};

const Messages = component((messages: ChatMessage[]) => {
  return html`<div class="messages">
    ${() =>
      messages.map((msg: ChatMessage) => {
        if (msg.type === "message") {
          return html`${TextMessage(msg)}`.key(msg.id);
        } else if (msg.type === "function_call") {
          return html`${FunctionCallMessage(msg)}`.key(msg.id);
        }
        return null;
      })}
  </div>`;
});

const TextMessage = component((msg: ChatMessage) => {
  return html`<div class="${msg.role === "assistant" ? "ai" : "user"}">
    ${msg.text}
  </div>`;
});

const FunctionCallMessage = component((msg: ChatMessage) => {
  return html`<div class="function-call">
    ${sandboxImport.sandbox({ source: msg.source })}
  </div>`;
});

export const App = component(() => {
  return html`<main>
    <h1>Arrow AI Chat</h1>
    <div class="chat-container">
      ${() =>
        responseState.status === "loading"
          ? html`<section class="loading">Loading...</section>`
          : null}
      ${() =>
        responseState.messages.length > 0
          ? Messages(responseState.messages)
          : null}
      ${() =>
        responseState.status === "error"
          ? html`<section class="error">Error</section>`
          : null}
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
