import { reactive } from "@arrow-js/core";

export type UserMessage = {
  role: "user" | "assistant";
  content?: string;
  sandboxSource?: Object;
};

export const messagesState = reactive<{
  messages: UserMessage[];
}>({
  messages: [],
});

export async function sendMessage(message: UserMessage) {
  messagesState.messages.push(message);
  const response = await fetch("http://127.0.0.1:4000/ai/sendMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messagesState.messages.map((m) =>
        m.sandboxSource === undefined
          ? m
          : { ...m, content: "AI built the tool.", sandboxSource: undefined },
      ),
    }),
  });
  return response.json();
}
