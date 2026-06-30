/// <reference types="@cloudflare/workers-types" />

import { handleChatRequest, type ChatEnv } from "./workers/chat";
import { handleUtf8Request, type Utf8Env } from "./workers/utf8";

export { ChatRoom } from "./workers/chat";
export { Utf8State } from "./workers/utf8";

interface Env extends ChatEnv, Utf8Env {}

export default {
  async fetch(request, env) {
    return (
      (await handleUtf8Request(request, env)) ??
      (await handleChatRequest(request, env)) ??
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;
