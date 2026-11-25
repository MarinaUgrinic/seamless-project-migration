import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import { managementDeckSchema } from "../management-report";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server.ts";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string; onFailure: (response: Response) => Promise<void> },
  messages: ModelMessage[],
  instructions?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  let markUpstreamReady: () => void = () => {};
  const upstreamReady = new Promise<void>((resolve) => { markUpstreamReady = resolve; });
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      try {
        const response = await runIdFetch.fetch(input, init);
        if (!response.ok) await config.onFailure(response.clone());
        return response;
      } finally { markUpstreamReady(); }
    },
  });
  const reasoning = config.model !== "openai/chat-latest";
  const result = streamText({
    model: provider.responses(config.model),
    output: Output.object({ schema: managementDeckSchema }),
    maxRetries: 0,
    // The route owns safe error messages; never log the SDK's raw request body.
    onError: () => {},
    // AI SDK 6 lacks `instructions`: rename this key to `system` there.
    ...(instructions ? { instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  return {
    result,
    gateway: runIdFetch,
    upstreamReady,
    response: () =>
      withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch),
  };
}
