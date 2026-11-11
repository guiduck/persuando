import assert from "node:assert/strict";
import test from "node:test";

import { GenerationPromptRecovery } from "../dist/src/modules/providers/generation-prompt-recovery.js";
import { ProviderAdapterError } from "../dist/src/modules/providers/provider-adapter.js";

const invalid = () => new ProviderAdapterError("PROVIDER_RESPONSE_INVALID", "Missing required output artifacts.", true);
const fix = JSON.stringify({ promptRelated: true, diagnosis: "The response omits matching tests.", promptCorrection: "Include a matching check for every code step." });
const messages = [{ role: "system", content: "Return strict JSON." }, { role: "user", content: "Teach the selected exercise in Portuguese." }];

test("Prompt recovery diagnoses the actual failed prompt and response and applies a bounded correction", async () => {
  const reports = [];
  let diagnosis;
  let attempts = 0;
  const recovery = new GenerationPromptRecovery(async (input) => { diagnosis = input; return fix; }, (...args) => reports.push(args), "sk-test-secret");
  const output = await recovery.run("answer", async (context, correction) => {
    attempts += 1;
    if (correction) return correction;
    context.messages = messages;
    context.responseContent = "Last incomplete response";
    context.finishReason = "length";
    throw invalid();
  });
  assert.equal(output, "Include a matching check for every code step.");
  assert.equal(attempts, 2);
  const evidence = JSON.parse(diagnosis[1].content);
  assert.deepEqual(evidence.lastPrompt, messages);
  assert.equal(evidence.responseExcerpt, "Last incomplete response");
  assert.equal(evidence.finishReason, "length");
  assert.equal(evidence.error.code, "PROVIDER_RESPONSE_INVALID");
  assert.deepEqual(reports, [["answer", "diagnosing"], ["answer", "retrying_corrected_prompt"]]);
});

test("Diagnostic evidence omits images and credentials, including echoed provider errors", async () => {
  let diagnostic;
  const recovery = new GenerationPromptRecovery(async (input) => { diagnostic = JSON.stringify(input); return "{}"; }, () => {}, "custom-provider-key");
  const error = new ProviderAdapterError("PROVIDER_RESPONSE_INVALID", "Rejected", false, "custom-provider-key sk-echoed-secret Bearer another-secret");
  await assert.rejects(() => recovery.run("visual_analysis", async (context) => {
    context.messages = [{ role: "user", content: [{ type: "text", text: "Exercise custom-provider-key" }, { type: "image_url", image_url: { url: "https://private.example/signed-image?token=secret" } }] }];
    context.responseContent = "data:image/png;base64,aGVsbG8= sk-echoed-secret";
    throw error;
  }), (actual) => actual === error);
  assert.doesNotMatch(diagnostic, /custom-provider-key|sk-echoed-secret|another-secret|private\.example|aGVsbG8=/);
  assert.match(diagnostic, /image omitted/);
});

test("Negative, malformed or failed diagnosis preserves the original failure without another generation", async () => {
  for (const diagnostic of ["not-json", "[]", "null", "{}", JSON.stringify({ promptRelated: false, diagnosis: "Outage", promptCorrection: "Try again" }), JSON.stringify({ promptRelated: true, diagnosis: "", promptCorrection: "Fix" }), JSON.stringify({ promptRelated: true, diagnosis: "Too long", promptCorrection: "x".repeat(1801) }), new Error("diagnostic call failed")]) {
    let attempts = 0;
    const original = invalid();
    const recovery = new GenerationPromptRecovery(async () => { if (diagnostic instanceof Error) throw diagnostic; return diagnostic; }, () => {}, "secret");
    await assert.rejects(() => recovery.run("answer", async (context) => { attempts += 1; context.messages = messages; throw original; }), (actual) => actual === original);
    assert.equal(attempts, 1);
  }
});

test("A corrected request failing validation never recursively diagnoses or retries", async () => {
  let diagnoses = 0;
  let attempts = 0;
  const original = invalid();
  const final = invalid();
  const recovery = new GenerationPromptRecovery(async () => { diagnoses += 1; return fix; }, () => {}, "secret");
  await assert.rejects(() => recovery.run("answer", async (context, correction) => {
    attempts += 1; context.messages = messages; throw correction ? final : original;
  }), (actual) => actual === final);
  assert.equal(diagnoses, 1);
  assert.equal(attempts, 2);
});

test("Visual analysis and final answer share one diagnostic budget", async () => {
  let diagnoses = 0;
  const recovery = new GenerationPromptRecovery(async () => { diagnoses += 1; return fix; }, () => {}, "secret");
  assert.equal(await recovery.run("visual_analysis", async (context, correction) => { context.messages = messages; if (!correction) throw invalid(); return "analysis"; }), "analysis");
  const error = invalid();
  await assert.rejects(() => recovery.run("answer", async (context) => { context.messages = messages; throw error; }), (actual) => actual === error);
  assert.equal(diagnoses, 1);
});

test("Authentication, quota, rate-limit, timeout, network and missing-input failures do not rewrite prompts", async () => {
  let diagnoses = 0;
  const recovery = new GenerationPromptRecovery(async () => { diagnoses += 1; return fix; }, () => {}, "secret");
  for (const code of ["PROVIDER_KEY_INVALID", "PROVIDER_QUOTA_EXCEEDED", "PROVIDER_RATE_LIMITED", "PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE"]) {
    const error = new ProviderAdapterError(code, "Safe failure", false);
    await assert.rejects(() => recovery.run("answer", async (context) => { context.messages = messages; throw error; }), (actual) => actual === error);
  }
  const missingInput = invalid();
  await assert.rejects(() => recovery.run("visual_analysis", async () => { throw missingInput; }), (actual) => actual === missingInput);
  assert.equal(diagnoses, 0);
});
