/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";

const STATE_KEY = "chat-messages";
const GLOBAL_OBJECT_NAME = "global";
const CHAT_PATHS = new Set(["/chat", "/chat.html"]);
const CHAT_SOCKET_PATH = "/api/chat";
const CHAT_HISTORY_PATH = "/api/chat/history";
const MAX_MESSAGES = 1000;
const MAX_MESSAGE_LENGTH = 50;

type ClientMessage = { type: "send"; text: string; createdAt: number };
type HistoryResponse = { messages: ChatMessage[] };

interface ChatMessage {
  id: string;
  text: string;
  createdAt: number;
  receivedAt: number;
}

type ParsedClientMessage = { ok: true; text: string; createdAt: number } | { ok: false; error: string };

export interface ChatEnv {
  ASSETS: Fetcher;
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
}

export class ChatRoom extends DurableObject<ChatEnv> {
  private messages: ChatMessage[] = [];

  constructor(ctx: DurableObjectState, env: ChatEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.messages = normalizeMessages(await ctx.storage.get<unknown>(STATE_KEY));
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CHAT_HISTORY_PATH) {
      return jsonResponse({ messages: this.messages });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket request", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    this.send(server, { type: "history", messages: this.messages });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const now = Date.now();
    const parsed = readClientMessage(message, now);

    if (!parsed.ok) {
      this.send(socket, { type: "error", message: parsed.error });
      return;
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: parsed.text,
      createdAt: parsed.createdAt,
      receivedAt: now,
    };

    this.messages = [...this.messages, chatMessage].sort(compareMessages).slice(-MAX_MESSAGES);
    this.ctx.waitUntil(this.ctx.storage.put(STATE_KEY, this.messages));
    this.broadcast({ type: "message", message: chatMessage });
  }

  private send(socket: WebSocket, message: unknown): void {
    socket.send(JSON.stringify(message));
  }

  private broadcast(message: unknown): void {
    const text = JSON.stringify(message);
    this.ctx.getWebSockets().forEach((socket) => socket.send(text));
  }
}

export async function handleChatRequest(request: Request, env: ChatEnv): Promise<Response | undefined> {
  const url = new URL(request.url);

  if (url.pathname === CHAT_SOCKET_PATH || url.pathname === CHAT_HISTORY_PATH) {
    return chatRoom(env).fetch(request);
  }

  if (request.method === "GET" && CHAT_PATHS.has(url.pathname)) {
    return fetchChatPage(request, env);
  }

  return undefined;
}

function chatRoom(env: ChatEnv): DurableObjectStub<ChatRoom> {
  const id = env.CHAT_ROOM.idFromName(GLOBAL_OBJECT_NAME);
  return env.CHAT_ROOM.get(id);
}

function readClientMessage(raw: string | ArrayBuffer, now: number): ParsedClientMessage {
  if (typeof raw !== "string") return { ok: false, error: "Expected a text message." };

  let message: unknown;

  try {
    message = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid message." };
  }

  if (!message || typeof message !== "object" || (message as ClientMessage).type !== "send") {
    return { ok: false, error: "Invalid message." };
  }

  const { text, createdAt } = message as ClientMessage;
  if (typeof text !== "string") return { ok: false, error: "Message text is required." };

  const trimmedText = text.trim();
  if (!trimmedText) return { ok: false, error: "Message text is required." };
  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  if (!Number.isInteger(createdAt) || createdAt < 0) {
    return { ok: false, error: "Message timestamp is invalid." };
  }

  if (createdAt > now) {
    return { ok: false, error: "Message timestamp is ahead of the server clock." };
  }

  return { ok: true, text: trimmedText, createdAt };
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isChatMessage)
    .sort(compareMessages)
    .slice(-MAX_MESSAGES);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.text === "string" &&
    message.text.length > 0 &&
    message.text.length <= MAX_MESSAGE_LENGTH &&
    typeof message.createdAt === "number" &&
    Number.isInteger(message.createdAt) &&
    message.createdAt >= 0 &&
    typeof message.receivedAt === "number" &&
    Number.isInteger(message.receivedAt) &&
    message.receivedAt >= 0
  );
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt - b.createdAt || a.receivedAt - b.receivedAt || a.id.localeCompare(b.id);
}

function jsonResponse(body: HistoryResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function fetchChatPage(request: Request, env: ChatEnv): Promise<Response> {
  const [page, history] = await Promise.all([
    env.ASSETS.fetch(request),
    chatRoom(env).fetch(new Request(new URL(CHAT_HISTORY_PATH, request.url))),
  ]);

  if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) return page;
  if (!history.ok) return page;

  const { messages } = (await history.json()) as HistoryResponse;
  const script = `<script>window.__CHAT_INITIAL_HISTORY__=${scriptJson(messages)}</script>`;
  const html = (await page.text()).replace("</head>", `${script}</head>`);
  const headers = new Headers(page.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(html, {
    status: page.status,
    statusText: page.statusText,
    headers,
  });
}
