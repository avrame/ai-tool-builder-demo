import { reactive } from "@arrow-js/core";

export type UserMessage = {
  role: "user" | "assistant";
  content?: string;
  sandboxSource?: Object;
};

export const messagesState = reactive<{
  messages: UserMessage[];
  status?: "loading" | "success" | "error";
  error?: string;
}>({
  messages: [],
  status: undefined,
  error: undefined,
});

export async function sendMessage(message: UserMessage) {
  messagesState.status = "loading";
  messagesState.messages.push(message);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_AI_CHAT_HOST}/ai/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesState.messages.map((m) =>
            m.sandboxSource === undefined
              ? m
              : {
                  ...m,
                  content: "AI built the tool.",
                  sandboxSource: undefined,
                },
          ),
        }),
      },
    );
    messagesState.status = "success";
    return response.json();
  } catch (error) {
    messagesState.status = "error";
    messagesState.error =
      error instanceof Error ? error.message : String(error);
    messagesState.messages.pop();
    throw error;
  }
}
