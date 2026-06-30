const bits = document.getElementById("bits")!;
const scrollParent = bits.parentElement!;
const decoded = document.getElementById("decoded")!;
const decoder = new TextDecoder("utf-8");
const BYTE_COUNT = 1024;
const ROW_HEIGHT = 18;
const ROW_GAP = 4;
const ROW_PITCH = ROW_HEIGHT + ROW_GAP;
const BUFFER_ROWS = 12;
const bytes = new Uint8Array(BYTE_COUNT);
const pendingChanges = new Map<number, number>();
let socket: WebSocket | null = null;
let retryTimer: number | undefined;
let visibleStart = -1;
let visibleEnd = -1;

type Change = [number, number];
type SyncMessage = { type: "full"; bytes: number[] } | { type: "patch"; changes: Change[] };

bits.style.height = `${BYTE_COUNT * ROW_PITCH - ROW_GAP}px`;

function renderText(): void {
  decoded.textContent = decoder.decode(bytes);
}

function createRow(byteIndex: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "byte";
  row.dataset.byte = String(byteIndex);

  for (let bit = 0; bit < 8; bit++) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.dataset.bit = String(byteIndex * 8 + bit);
    label.append(box);
    row.append(label);
  }

  const hex = document.createElement("output");
  hex.className = "hex";
  row.append(hex);
  return row;
}

function renderRow(row: HTMLDivElement, byteIndex: number): void {
  const value = bytes[byteIndex];
  row.dataset.byte = String(byteIndex);
  row.style.transform = `translateY(${byteIndex * ROW_PITCH}px)`;

  row.querySelectorAll<HTMLInputElement>("input").forEach((box, bit) => {
    box.dataset.bit = String(byteIndex * 8 + bit);
    box.checked = Boolean(value & (1 << (7 - bit)));
  });

  row.querySelector("output")!.textContent = value.toString(16).padStart(2, "0").toUpperCase();
}

function renderVisibleRows(): void {
  const top = Math.max(0, scrollParent.scrollTop - bits.offsetTop);
  const height = scrollParent.clientHeight;
  const nextStart = Math.max(0, Math.floor(top / ROW_PITCH) - BUFFER_ROWS);
  const nextEnd = Math.min(BYTE_COUNT, Math.ceil((top + height) / ROW_PITCH) + BUFFER_ROWS);

  if (nextStart === visibleStart && nextEnd === visibleEnd) return;

  visibleStart = nextStart;
  visibleEnd = nextEnd;
  bits.replaceChildren();

  for (let byteIndex = visibleStart; byteIndex < visibleEnd; byteIndex++) {
    const row = createRow(byteIndex);
    renderRow(row, byteIndex);
    bits.append(row);
  }
}

function renderByte(byteIndex: number): void {
  const row = bits.querySelector<HTMLDivElement>(`.byte[data-byte="${byteIndex}"]`);
  if (row) renderRow(row, byteIndex);
}

function setByte(byteIndex: number, value: number): void {
  bytes[byteIndex] = value;
  renderByte(byteIndex);
}

function readByte(byteIndex: number): number {
  let value = 0;
  const row = bits.querySelector<HTMLDivElement>(`.byte[data-byte="${byteIndex}"]`);
  if (!row) return bytes[byteIndex];

  row.querySelectorAll<HTMLInputElement>("input").forEach((box) => {
    const bit = Number(box.dataset.bit) % 8;
    if (box.checked) value |= 1 << (7 - bit);
  });

  return value;
}

function sendChanges(changes: Change[]): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "patch", changes }));
    return;
  }

  changes.forEach(([byteIndex, value]) => pendingChanges.set(byteIndex, value));
}

function flushPendingChanges(): void {
  const changes = [...pendingChanges];
  pendingChanges.clear();
  if (changes.length) sendChanges(changes);
}

function applyFull(nextBytes: number[]): void {
  bytes.forEach((_, byteIndex) => {
    bytes[byteIndex] = nextBytes[byteIndex] & 255;
  });
  visibleStart = -1;
  renderVisibleRows();
  renderText();
}

function applyPatch(changes: Change[]): void {
  changes.forEach(([byteIndex, value]) => {
    if (byteIndex >= 0 && byteIndex < bytes.length) setByte(byteIndex, value & 255);
  });
  renderText();
}

function socketUrl(): string {
  const url = new URL("/api/utf8", location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

function readMessage(data: string): SyncMessage | undefined {
  try {
    const message = JSON.parse(data) as SyncMessage;
    if (message.type === "full" && Array.isArray(message.bytes)) return message;
    if (message.type === "patch" && Array.isArray(message.changes)) return message;
  } catch {
    return undefined;
  }
}

function connect(): void {
  window.clearTimeout(retryTimer);
  socket = new WebSocket(socketUrl());

  socket.addEventListener("open", flushPendingChanges);
  socket.addEventListener("message", ({ data }) => {
    const message = readMessage(data);
    if (!message) return;

    if (message.type === "full") applyFull(message.bytes);
    if (message.type === "patch") applyPatch(message.changes);
  });
  socket.addEventListener("close", () => {
    retryTimer = window.setTimeout(connect, 1000);
  });
}

bits.addEventListener("change", (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement)) return;

  const byteIndex = Math.floor(Number(box.dataset.bit) / 8);
  const value = readByte(byteIndex);
  setByte(byteIndex, value);
  renderText();
  sendChanges([[byteIndex, value]]);
});

scrollParent.addEventListener("scroll", renderVisibleRows);
window.addEventListener("resize", renderVisibleRows);
renderVisibleRows();
renderText();
connect();
