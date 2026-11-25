import { afterEach, expect, it, vi } from "vitest";
import { createResponsesCall } from "./responses.server";

afterEach(() => vi.unstubAllGlobals());

it("waits for the safe denial callback before releasing headers and never retries a 403", async () => {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: { message: "Provider access denied", type: "permission_error" } }), { status: 403, headers: { "Content-Type": "application/json", "X-Lovable-AIG-Run-ID": "gateway-test-run" } }));
  vi.stubGlobal("fetch", fetch);
  let finishDenial: () => void = () => {};
  const saved = new Promise<void>((resolve) => { finishDenial = resolve; });
  let callbackFinished = false;
  const call = createResponsesCall(new Request("http://localhost/api/management-report"), {
    apiKey: "synthetic-test-key", baseURL: "https://ai.gateway.lovable.dev/v1", model: "openai/gpt-6-astra",
    onFailure: async () => { await saved; callbackFinished = true; },
  }, [{ role: "user", content: "Synthetic test" }], "Synthetic instructions");
  const consuming = (async () => { for await (const part of call.result.fullStream) { if (part.type === "error") break; } })();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(callbackFinished).toBe(false);
  finishDenial();
  await call.upstreamReady;
  expect(callbackFinished).toBe(true);
  await consuming;
  expect(fetch).toHaveBeenCalledTimes(1);
  const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined;
  const wire = JSON.parse(String(init?.body)) as Record<string, any>;
  expect(wire["model"]).toBe("openai/gpt-6-astra");
  expect(wire["stream"]).toBe(true);
  expect(wire["store"]).toBe(false);
  expect(wire["reasoning"]?.effort).toBe("low");
  expect(wire["text"]?.format?.type).toBe("json_schema");
  expect(wire["text"]?.format?.schema?.additionalProperties).toBe(false);
  expect(wire["temperature"]).toBeUndefined();
});