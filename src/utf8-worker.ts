/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";

const BYTE_COUNT = 1024;
const STATE_KEY = "utf8-bytes";
const GLOBAL_OBJECT_NAME = "global";
const PATCH_INTERVAL_MS = 250;
const FULL_STATE_INTERVAL_MS = 10_000;

type Change = [number, number, number];
type ClientMessage = { type: "patch"; changes: Change[] };

interface Env {
  ASSETS: Fetcher;
  UTF8_STATE: DurableObjectNamespace<Utf8State>;
}

export class Utf8State extends DurableObject<Env> {
  private bytes = new Uint8Array(BYTE_COUNT);
  private pendingChanges = new Map<number, Change>();
  private patchTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<number[]>(STATE_KEY);
      if (stored) this.bytes.set(stored.slice(0, BYTE_COUNT));
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket request", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    this.sendFullState(server);
    this.scheduleFullState();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const changes = this.readChanges(message);
    if (!changes.length) return;

    changes.forEach(([byteIndex, value, originatedAt]) => {
      this.bytes[byteIndex] = value;
      this.pendingChanges.set(byteIndex, [byteIndex, value, originatedAt]);
    });

    this.dirty = true;
    this.schedulePatch();
  }

  webSocketClose(): void {
    if (!this.ctx.getWebSockets().length) this.ctx.waitUntil(this.ctx.storage.deleteAlarm());
  }

  async alarm(): Promise<void> {
    this.broadcastFullState();
    this.scheduleFullState();
  }

  private readChanges(text: string): Change[] {
    let message: unknown;

    try {
      message = JSON.parse(text);
    } catch {
      return [];
    }

    if (!message || typeof message !== "object" || (message as ClientMessage).type !== "patch") return [];

    const { changes } = message as ClientMessage;
    if (!Array.isArray(changes)) return [];

    return changes.filter(
      (change): change is Change =>
        Array.isArray(change) &&
        Number.isInteger(change[0]) &&
        Number.isInteger(change[1]) &&
        Number.isInteger(change[2]) &&
        change[0] >= 0 &&
        change[0] < BYTE_COUNT &&
        change[1] >= 0 &&
        change[1] <= 255 &&
        change[2] >= 0,
    );
  }

  private schedulePatch(): void {
    if (!this.patchTimer) this.patchTimer = setTimeout(() => this.flushPatch(), PATCH_INTERVAL_MS);
  }

  private flushPatch(): void {
    this.patchTimer = undefined;

    if (this.pendingChanges.size) {
      this.broadcast({ type: "patch", changes: [...this.pendingChanges.values()] });
      this.pendingChanges.clear();
    }

    if (this.dirty) {
      this.dirty = false;
      this.ctx.waitUntil(this.ctx.storage.put(STATE_KEY, [...this.bytes]));
    }
  }

  private scheduleFullState(): void {
    if (this.ctx.getWebSockets().length) {
      this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now() + FULL_STATE_INTERVAL_MS));
    }
  }

  private sendFullState(socket: WebSocket): void {
    socket.send(this.bytes.slice().buffer);
  }

  private broadcastFullState(): void {
    this.ctx.getWebSockets().forEach((socket) => this.sendFullState(socket));
  }

  private broadcast(message: unknown): void {
    const text = JSON.stringify(message);
    this.ctx.getWebSockets().forEach((socket) => socket.send(text));
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/utf8") {
      const id = env.UTF8_STATE.idFromName(GLOBAL_OBJECT_NAME);
      return env.UTF8_STATE.get(id).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
