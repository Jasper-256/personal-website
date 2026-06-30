const MAX_MESSAGES = 1000;
const VISIBLE_MESSAGES = 16;

export {};

type ChatMessage = {
  id: string;
  text: string;
  createdAt: number;
  receivedAt: number;
};

type ServerMessage =
  | { type: "history"; messages: ChatMessage[] }
  | { type: "message"; message: ChatMessage };

type WindowWithInitialHistory = Window & { __CHAT_INITIAL_HISTORY__?: unknown };

const history = document.getElementById("history")!;
const form = document.getElementById("frm") as HTMLFormElement;
const input = form.elements.namedItem("Message") as HTMLInputElement;
const sendButton = document.getElementById("submit-form") as HTMLButtonElement;
const messages = new Map<string, ChatMessage>();

let socket: WebSocket | null = null;
let retryTimer: number | undefined;

function socketUrl(): string {
  const url = new URL("/api/chat", location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt - b.createdAt || a.receivedAt - b.receivedAt || a.id.localeCompare(b.id);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.text === "string" &&
    typeof message.createdAt === "number" &&
    Number.isInteger(message.createdAt) &&
    typeof message.receivedAt === "number" &&
    Number.isInteger(message.receivedAt)
  );
}

function trimMessages(): void {
  const ordered = [...messages.values()].sort(compareMessages);
  const extraCount = ordered.length - MAX_MESSAGES;
  if (extraCount <= 0) return;

  ordered.slice(0, extraCount).forEach((message) => messages.delete(message.id));
}

function renderMessages(): void {
  const fragment = document.createDocumentFragment();

  [...messages.values()]
    .sort(compareMessages)
    .slice(-VISIBLE_MESSAGES)
    .forEach((message, index) => {
      if (index > 0) fragment.append(document.createElement("br"));
      fragment.append(document.createTextNode(message.text));
    });

  history.replaceChildren(fragment);
  form.hidden = false;
}

function upsertMessage(message: unknown): void {
  if (!isChatMessage(message)) return;

  messages.set(message.id, message);
  trimMessages();
}

function applyHistory(history: unknown): void {
  if (!Array.isArray(history)) return;

  history.forEach(upsertMessage);
  renderMessages();
}

function readServerMessage(data: unknown): ServerMessage | undefined {
  if (typeof data !== "string") return undefined;

  try {
    const message = JSON.parse(data) as ServerMessage;
    if (message.type === "history" && Array.isArray(message.messages)) return message;
    if (message.type === "message" && isChatMessage(message.message)) return message;
  } catch {
    return undefined;
  }

  return undefined;
}

function setConnected(connected: boolean): void {
  input.disabled = !connected;
  sendButton.disabled = !connected;
}

function connect(): void {
  window.clearTimeout(retryTimer);
  socket = new WebSocket(socketUrl());

  socket.addEventListener("open", () => {
    setConnected(true);
  });

  socket.addEventListener("message", ({ data }) => {
    const message = readServerMessage(data);
    if (!message) return;

    if (message.type === "history") applyHistory(message.messages);
    if (message.type === "message") {
      upsertMessage(message.message);
      renderMessages();
    }
  });

  socket.addEventListener("close", () => {
    setConnected(false);
    retryTimer = window.setTimeout(connect, 1000);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  if (socket?.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ type: "send", text, createdAt: Date.now() }));
  input.value = "";
});

setConnected(false);
applyHistory((window as WindowWithInitialHistory).__CHAT_INITIAL_HISTORY__);
connect();
