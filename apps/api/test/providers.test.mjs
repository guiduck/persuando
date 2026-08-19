import assert from "node:assert/strict";
import test from "node:test";

import { MockProviderAdapter } from "../dist/src/modules/providers/mock-provider.adapter.js";
import { OpenAiCompatibleProviderAdapter } from "../dist/src/modules/providers/openai-compatible-provider.adapter.js";
import { ProviderAdapterError, toSafeProviderError } from "../dist/src/modules/providers/provider-adapter.js";
import { ProvidersService } from "../dist/src/modules/providers/providers.service.js";

const transcriptionInput = {
  apiKey: "sk-provider-secret",
  audio: new Uint8Array([1, 2, 3]),
  codec: "webm-opus",
  language: "pt-BR",
  model: "gpt-4o-mini-transcribe",
  sessionId: "session-1"
};

test("ProvidersService selects mock adapter by configuration", async () => {
  const service = new ProvidersService({
    env: {
      providerAdapter: "mock"
    }
  });

  const output = await service.transcribe(transcriptionInput);

  assert.equal(service.getAdapter().name, "mock");
  assert.equal(output.transcript.language, "pt-BR");
  assert.equal(output.transcript.provisional, false);
});

test("MockProviderAdapter generates deterministic summaries, insights, and suggestions", async () => {
  const adapter = new MockProviderAdapter();
  const output = await adapter.generate({
    analysisModel: "gpt-4o-mini",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "Precisamos decidir o prazo e o dono da proxima etapa."
  });

  assert.match(output.summary.content, /Precisamos decidir/);
  assert.equal(output.insights[0]?.type, "question");
  assert.equal(output.suggestions[0]?.category, "response");
});

test("OpenAiCompatibleProviderAdapter sends transcription request with bearer auth and safe output", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (url, init) => {
    requests.push({ url, init });
    return jsonResponse(200, { text: "ola mundo", language: "pt-BR" });
  });

  const output = await adapter.transcribe(transcriptionInput);

  assert.equal(requests[0].url, "https://provider.example/v1/audio/transcriptions");
  assert.equal(requests[0].init.headers.authorization, "Bearer sk-provider-secret");
  assert.equal(output.transcript.text, "ola mundo");
  assert.equal(JSON.stringify(output).includes("sk-provider-secret"), false);
});

test("OpenAiCompatibleProviderAdapter parses generation JSON", async () => {
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () =>
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: { content: "Resumo curto." },
              insights: [{ type: "question", content: "Qual e o prazo?", confidence: 0.8 }],
              suggestions: [{ category: "response", content: "Eu sugiro confirmar o prazo.", urgency: "medium" }]
            })
          }
        }
      ]
    })
  );

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "Falamos sobre prazo."
  });

  assert.equal(output.summary.content, "Resumo curto.");
  assert.equal(output.insights[0]?.content, "Qual e o prazo?");
  assert.equal(output.suggestions[0]?.content, "Eu sugiro confirmar o prazo.");
});

test("OpenAiCompatibleProviderAdapter maps provider failure status codes to safe errors", async () => {
  const cases = [
    [401, "PROVIDER_KEY_INVALID", false],
    [403, "PROVIDER_KEY_INVALID", false],
    [402, "PROVIDER_QUOTA_EXCEEDED", false],
    [408, "PROVIDER_TIMEOUT", true],
    [415, "AUDIO_FORMAT_UNSUPPORTED", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [500, "PROVIDER_UNAVAILABLE", true]
  ];

  for (const [status, code, retryable] of cases) {
    const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => jsonResponse(status, {}));

    await assert.rejects(
      () => adapter.transcribe(transcriptionInput),
      (error) =>
        error instanceof ProviderAdapterError &&
        error.code === code &&
        error.retryable === retryable &&
        !error.message.includes("sk-provider-secret")
    );
  }
});

test("OpenAiCompatibleProviderAdapter maps missing key, network failure, and unknown errors safely", async () => {
  const networkAdapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    throw new Error("network failed with sk-provider-secret");
  });

  await assert.rejects(
    () => networkAdapter.generate({ analysisModel: "gpt-4o-mini", responseLanguage: "pt-BR", sessionId: "session-1", transcriptText: "ola" }),
    (error) => error instanceof ProviderAdapterError && error.code === "PROVIDER_KEY_INVALID"
  );
  await assert.rejects(
    () => networkAdapter.transcribe(transcriptionInput),
    (error) =>
      error instanceof ProviderAdapterError &&
      error.code === "PROVIDER_UNAVAILABLE" &&
      error.retryable === true &&
      !error.message.includes("sk-provider-secret")
  );

  const safe = toSafeProviderError(new Error("unknown failure with sk-provider-secret"));
  assert.equal(safe.code, "PROVIDER_UNAVAILABLE");
  assert.equal(safe.retryable, true);
  assert.equal(JSON.stringify(safe).includes("sk-provider-secret"), false);
});

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
