import { Logger } from "@nestjs/common";

import { ProviderAdapterError, type ProviderAdapter, type ProviderGenerationInput, type ProviderGenerationOutput, type ProviderTranscriptionInput, type ProviderTranscriptionOutput } from "./provider-adapter.js";

type FetchLike = typeof fetch;
interface ChatCompletionPayload {
  choices?: { finish_reason?: string; message?: { content?: string } }[];
}

const CODE_PRACTICE_MAX_TOKENS = 5200;
const CODE_PRACTICE_VISUAL_MAX_TOKENS = 4800;
const DEFAULT_GENERATION_MAX_TOKENS = 900;
const MAX_CODE_PRACTICE_IMAGES = 30;

export class OpenAiCompatibleProviderAdapter implements ProviderAdapter {
  readonly name = "openai-compatible" as const;
  private readonly logger = new Logger(OpenAiCompatibleProviderAdapter.name);

  constructor(
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchFn: FetchLike = fetch
  ) {}

  async transcribe(input: ProviderTranscriptionInput): Promise<ProviderTranscriptionOutput> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);

    const form = new FormData();
    form.set("model", input.model);
    form.set("language", normalizeTranscriptionLanguage(input.language));
    form.set("temperature", "0");
    if (input.prompt) form.set("prompt", input.prompt);
    form.set(
      "file",
      new Blob([toArrayBuffer(input.audio)], { type: contentTypeForCodec(input.codec) }),
      fileNameForCodec(input.codec)
    );

    const response = await this.fetchProvider("/audio/transcriptions", input.apiKey, {
      body: form,
      method: "POST"
    });
    const payload = (await response.json()) as { text?: string; language?: string };
    return {
      transcript: {
        text: payload.text ?? "",
        confidence: 1,
        language: payload.language ?? input.language,
        provisional: false
      }
    };
  }

  async generate(input: ProviderGenerationInput): Promise<ProviderGenerationOutput> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);

    const generationId = input.generationId ?? `${input.sessionId}-${Date.now()}`;
    const imageCount = input.imageReferences?.filter(Boolean).length ?? 0;
    const visualAnalysis = input.task === "code_practice" || input.task === "exam_study"
      ? await this.analyzeCodePracticeVisuals(input, generationId)
      : undefined;
    return this.generateAnswer(input, generationId, imageCount, visualAnalysis);
  }

  private async generateAnswer(
    input: ProviderGenerationInput,
    generationId: string,
    imageCount: number,
    visualAnalysis: string | undefined,
    attempt = 1
  ): Promise<ProviderGenerationOutput> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);
    const startedAt = Date.now();
    this.logger.log(
      `Generation provider request: generationId=${generationId} sessionId=${input.sessionId} task=${input.task ?? "session_assistance"} phase=answer attempt=${attempt} model=${input.analysisModel} programmingLanguage=${input.programmingLanguage ?? "unspecified"} imageCount=${imageCount} previousGuidance=${input.previousCodePracticeGuidance?.length ?? 0} transcriptLength=${input.transcriptText.length}`
    );
    const response = await this.fetchProvider("/chat/completions", input.apiKey, {
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: generationSystemPrompt(input.task)
          },
          {
            role: "user",
            content: generationUserContent(input, visualAnalysis) + codePracticeRepairInstruction(input, attempt)
          }
        ],
        model: input.analysisModel,
        ...generationControls(input.analysisModel, generationMaxTokens(input.task), generationTemperature(input.task)),
        response_format: { type: "json_object" }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await this.readChatCompletionResponse(response, generationId, "answer");
    const responseContent = typeof payload.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content
      : "";
    const finishReason = payload.choices?.[0]?.finish_reason ?? "missing";
    this.logger.log(
      `Generation provider response: generationId=${generationId} sessionId=${input.sessionId} task=${input.task ?? "session_assistance"} phase=answer attempt=${attempt} model=${input.analysisModel} programmingLanguage=${input.programmingLanguage ?? "unspecified"} imageCount=${imageCount} httpStatus=${response.status} finishReason=${finishReason} contentLength=${responseContent.length} durationMs=${Date.now() - startedAt}`
    );
    const output = parseGenerationContent(responseContent, input.transcriptText, input.task);
    if (input.task === "code_practice" && input.programmingLanguage && !hasRequiredCodeSolution(output, input.programmingLanguage)) {
      this.logger.warn(
        `Generation provider answer missing required code solution: generationId=${generationId} sessionId=${input.sessionId} phase=answer attempt=${attempt} programmingLanguage=${input.programmingLanguage}.`
      );
      if (attempt === 1) return this.generateAnswer(input, generationId, imageCount, visualAnalysis, 2);
      throw new ProviderAdapterError(
        "PROVIDER_RESPONSE_INVALID",
        `Provider did not return the required ${input.programmingLanguage} solution after repair.`,
        true
      );
    }
    return output;
  }

  private async analyzeCodePracticeVisuals(
    input: ProviderGenerationInput,
    generationId: string,
    attempt = 1
  ): Promise<string> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);
    const imageReferences = input.imageReferences?.filter(Boolean).slice(-MAX_CODE_PRACTICE_IMAGES) ?? [];
    if (imageReferences.length === 0) {
      throw new ProviderAdapterError("PROVIDER_RESPONSE_INVALID", "Code Practice visual analysis requires screenshot context.", false);
    }

    const startedAt = Date.now();
    this.logger.log(
      `Generation provider request: generationId=${generationId} sessionId=${input.sessionId} task=code_practice phase=visual_analysis attempt=${attempt} model=${input.analysisModel} programmingLanguage=${input.programmingLanguage ?? "unspecified"} imageCount=${imageReferences.length} previousGuidance=${input.previousCodePracticeGuidance?.length ?? 0}`
    );
    const response = await this.fetchProvider("/chat/completions", input.apiKey, {
      body: JSON.stringify({
        messages: [
          { role: "system", content: codePracticeVisualAnalysisSystemPrompt() },
          { role: "user", content: codePracticeVisualAnalysisContent(input, imageReferences) }
        ],
        model: input.analysisModel,
        ...generationControls(input.analysisModel, CODE_PRACTICE_VISUAL_MAX_TOKENS, 0),
        response_format: { type: "json_object" }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await this.readChatCompletionResponse(response, generationId, "visual_analysis");
    const responseContent = typeof payload.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content
      : "";
    const finishReason = payload.choices?.[0]?.finish_reason ?? "missing";
    this.logger.log(
      `Generation provider response: generationId=${generationId} sessionId=${input.sessionId} task=code_practice phase=visual_analysis attempt=${attempt} model=${input.analysisModel} programmingLanguage=${input.programmingLanguage ?? "unspecified"} imageCount=${imageReferences.length} httpStatus=${response.status} finishReason=${finishReason} contentLength=${responseContent.length} durationMs=${Date.now() - startedAt}`
    );

    const parsed = parseJsonObject(responseContent);
    if (parsed) {
      if (input.programmingLanguage) {
        parsed.language = input.programmingLanguage;
        parsed.selectedProgrammingLanguage = input.programmingLanguage;
        parsed.selectedProgrammingLanguageIsAuthoritative = true;
      }
      return JSON.stringify(parsed);
    }

    this.logger.warn(
      `Generation provider invalid JSON: generationId=${generationId} sessionId=${input.sessionId} phase=visual_analysis attempt=${attempt} model=${input.analysisModel} httpStatus=${response.status} finishReason=${finishReason} contentLength=${responseContent.length} startsWithBrace=${responseContent.trimStart().startsWith("{")}`
    );
    if (attempt === 1) {
      this.logger.warn(
        `Generation provider retrying visual analysis: generationId=${generationId} sessionId=${input.sessionId} nextAttempt=2.`
      );
      return this.analyzeCodePracticeVisuals(input, generationId, 2);
    }
    throw new ProviderAdapterError(
      "PROVIDER_RESPONSE_INVALID",
      finishReason === "length"
        ? "Provider response was truncated while reading Code Practice screenshots."
        : "Provider returned invalid JSON while reading Code Practice screenshots.",
      true
    );
  }

  private async readChatCompletionResponse(
    response: Response,
    generationId: string,
    phase: "visual_analysis" | "answer"
  ): Promise<ChatCompletionPayload> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      this.logger.warn(
        `Generation provider non-JSON HTTP response: generationId=${generationId} phase=${phase} httpStatus=${response.status}.`
      );
      throw new ProviderAdapterError(
        "PROVIDER_RESPONSE_INVALID",
        `Provider returned a non-JSON HTTP response during ${phase}.`,
        true
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      this.logger.warn(
        `Generation provider invalid response shape: generationId=${generationId} phase=${phase} httpStatus=${response.status}.`
      );
      throw new ProviderAdapterError(
        "PROVIDER_RESPONSE_INVALID",
        `Provider returned an invalid response shape during ${phase}.`,
        true
      );
    }
    return payload as ChatCompletionPayload;
  }
  private async fetchProvider(path: string, apiKey: string, init: RequestInit): Promise<Response> {
    const maxAttempts = path.includes("chat/completions") ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${apiKey}`,
            ...(init.headers ?? {})
          }
        });
      } catch (error) {
        const retrying = attempt < maxAttempts;
        this.logger.warn(
          `Provider network request failed: path=${path} attempt=${attempt}/${maxAttempts} retrying=${retrying} errorType=${error instanceof Error ? error.name : "unknown"} causeCode=${providerNetworkCauseCode(error)}.`
        );
        if (retrying) {
          await delay(500);
          continue;
        }
        throw new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider network request failed after retry.", true);
      }

      if (response.ok) return response;
      const providerError = providerErrorForStatus(response.status, path);
      const retrying = attempt < maxAttempts && providerError.retryable;
      this.logger.warn(
        `Provider HTTP request rejected: path=${path} attempt=${attempt}/${maxAttempts} retrying=${retrying} httpStatus=${response.status}.`
      );
      if (retrying) {
        await delay(500);
        continue;
      }
      throw providerError;
    }
    throw new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider request failed after retry.", true);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function providerNetworkCauseCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("cause" in error)) return "none";
  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return "none";
  return typeof cause.code === "string" ? cause.code : "unknown";
}

function contentTypeForCodec(codec: ProviderTranscriptionInput["codec"]): string {
  if (codec === "webm-opus") return "audio/webm";
  if (codec === "pcm16") return "audio/wav";
  throw new ProviderAdapterError("AUDIO_FORMAT_UNSUPPORTED", "Audio codec is unsupported.", false);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fileNameForCodec(codec: ProviderTranscriptionInput["codec"]): string {
  return codec === "webm-opus" ? "chunk.webm" : "chunk.wav";
}

function normalizeTranscriptionLanguage(language: string): string {
  return language.split("-")[0]?.toLowerCase() || language;
}

function providerErrorForStatus(status: number, path: string): ProviderAdapterError {
  if (status === 401 || status === 403) {
    return new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider credential could not be authorized.", false);
  }
  if (status === 408 || status === 504) {
    return new ProviderAdapterError("PROVIDER_TIMEOUT", "Provider request timed out.", true);
  }
  if (status === 402) {
    return new ProviderAdapterError("PROVIDER_QUOTA_EXCEEDED", "Provider quota is exhausted.", false);
  }
  if (status === 400 || status === 415) {
    if (path.includes("audio/transcriptions")) {
      return new ProviderAdapterError("AUDIO_FORMAT_UNSUPPORTED", "Provider rejected the audio format.", false);
    }
    return new ProviderAdapterError("PROVIDER_RESPONSE_INVALID", "Provider rejected the generation request.", false);
  }
  if (status === 429) {
    return new ProviderAdapterError("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", true);
  }
  if (status >= 500) {
    return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable.", true);
  }
  return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider request failed.", false);
}

function generationControls(model: string, maxTokens: number, temperature: number): Record<string, number> {
  if (/^gpt-5(?:\.|$)/i.test(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens, temperature };
}

function generationMaxTokens(task: ProviderGenerationInput["task"]): number {
  return task === "code_practice" || task === "exam_study" ? CODE_PRACTICE_MAX_TOKENS : DEFAULT_GENERATION_MAX_TOKENS;
}

function generationTemperature(task: ProviderGenerationInput["task"]): number {
  return task === "code_practice" || task === "exam_study" ? 0.15 : 0.2;
}

function generationSystemPrompt(task: ProviderGenerationInput["task"]): string {
  if (task === "code_practice") {
    return [
      "You are Persuando Code Practice, a meticulous coding tutor for self-study, preparation, and review.",
      "The visual-analysis JSON is the factual source for the current problem, platform contract, student code, and test results. Screenshots were analyzed oldest to newest; recent evidence overrides stale evidence.",
      "Screenshots may contain multiple exercises from the same session. Use only screenshots assigned to the active problem identified by the newest recognizable title, URL, function signature, or editor state. Never carry code, contracts, or test results from a different exercise into the active answer.",
      "The explicitly selected programming language is authoritative and overrides a missing, unknown, or conflicting language inferred from screenshots.",
      "Before suggesting code, compare the current attempt with the exact contract: requested function name/signature, provided node fields/types, whether to print or return, separators/newlines, and whether the platform wants method-only code.",
      "Treat previous guidance as fallible history. Check it against the newest evidence, explicitly correct any prior mistake, and do not restart from zero when the student is iterating on code.",
      "If test results are visible, diagnose the current failure first. Quote the relevant expected/actual behavior without inventing hidden test details, then give the smallest correction and an updated solution.",
      "Never invent scaffolding, classes, field names, input parsing, or output behavior that the platform already supplies. Preserve visible identifiers such as root, data, left, right, and the exact required function signature.",
      "For output-format problems, verify spaces, line breaks, trailing separators, and print-versus-return semantics explicitly.",
      "Responsible-use boundary: for a clearly proctored exam, hiring assessment, live interview, or active contest, provide conceptual debugging and pseudocode rather than copy-paste final code. For a public self-study or practice page without visible proctoring signals, always provide a complete taught solution in the selected language.",
      "If the public exercise title, URL, and behavior are clear but the editor signature is not visible, state the signature assumption briefly and still provide the standard platform function solution. Do not withhold the solution merely to request another screenshot.",
      "Explain Big-O for the actual proposed solution: define the problem variables, connect each traversal, loop, recursion, queue, heap, or sort to its cost, and explain why the final bound follows. Do not give a generic definition of Big-O.",
      "Return STRICT JSON with summary.content, insights[], and suggestions[]. Put the main answer in suggestions[0].content with category='response' and urgency='high'.",
      "Write explanations in the requested response language, but write every code block in the explicitly selected programming language. Never substitute pseudocode or another language when a programming language is provided.",
      "A Code Practice response is invalid unless Solução atualizada contains a non-empty fenced code block labeled with the selected programming language, followed by a step-by-step explanation. Use concise Markdown headings, Big-O, and a final contract checklist. Prefer 500 to 1200 useful words over repetitive boilerplate.",
      "Do not include secrets."
    ].join(" ");
  }

  if (task === "exam_study") {
    return [
      "You are Persuando Exam Study, a patient tutor for Brazilian public-exam practice questions.",
      "Use the visual-analysis JSON as factual evidence. Read screenshots oldest to newest and treat the newest identifiable question as active; older screenshots matter only when they belong to that same question.",
      "Identify the subject, discipline, topic, command, alternatives, and newest attempt or marked answer. Never mix a previous question into the current answer.",
      "Solve the active question when its complete statement exists across screenshots from the same question.",
      "Explain the key concept briefly, then teach the reasoning step by step in extremely simple language, as if speaking to a five-year-old, without becoming inaccurate or patronizing.",
      "For multiple choice, state the correct alternative and explain why it is correct and why each visible alternative is wrong. For open questions, provide the expected answer and reasoning.",
      "Do not invent unreadable statement text, laws, dates, alternatives, answer keys, or current facts. Clearly label any necessary assumption.",
      "Return STRICT JSON with summary.content, insights[], and suggestions[]. Put the complete Markdown lesson in suggestions[0].content with category='response' and urgency='high'.",
      "Use headings: Questão identificada, Matéria cobrada, Conceito em poucas palavras, Resolução passo a passo, Resposta correta, Por que as outras estão erradas, and O que memorizar.",
      "Write in the requested response language and do not include secrets."
    ].join(" ");
  }

  if (task === "insights") {
    return "Generate focused meeting or study insights. Return JSON with summary.content, insights[], and suggestions[]. Prioritize key concepts, questions being asked, terms to explain, and risks. Do not include secrets.";
  }


  if (task === "followups") {
    return "Generate practical follow-up suggestions and things the user can say next. Return JSON with summary.content, insights[], and suggestions[]. Keep suggestions actionable. Do not include secrets.";
  }

  if (task === "summary") {
    return "Generate an accurate concise summary of the current session. Return JSON with summary.content, insights[], and suggestions[]. Do not include secrets.";
  }

  return "You generate concise meeting assistance. Return JSON with summary.content, insights[], and suggestions[]. Include direct answers, useful explanations, and follow-ups. Do not include secrets.";
}

function codePracticeVisualAnalysisSystemPrompt(): string {
  return [
    "You are a visual evidence analyst for a coding tutor. Do not solve the exercise and do not teach yet.",
    "Read every attached screenshot in chronological order from oldest to newest. Extract exact visible facts and distinguish old attempts from the newest state.",
    "First group screenshots by exercise using visible title, URL, function name/signature, statement text, and editor content. The active problem is the newest identifiable exercise. A partial newest screenshot may use immediately older screenshots only when they belong to that same exercise.",
    "Exclude screenshots from other exercises from the active contract, attempt, test results, and progress. Record them only as staleOrConflictingEvidence.",
    "If an exact public practice challenge is identifiable by title or URL, you may fill missing contract details from the established standard challenge, but mark those fields in inferredFromKnownPublicProblem and keep visible facts separate.",
    "Return STRICT JSON with: activeProblemTitle, activeProblemEvidence, screenshotGroups, problemTitle, platform, language, functionSignature, requiredBehavior, outputContract, providedScaffolding, providedFieldNames, currentAttempt, observedTestResults, chronologicalProgress, inferredFromKnownPublicProblem, staleOrConflictingEvidence, uncertainties.",
    "Transcribe identifiers and output requirements exactly. For test results, capture pass/fail counts, runtime/compiler messages, expected output, actual output, and the newest visible status when available.",
    "Never override a visible function contract with generic knowledge. When the active public challenge is not identifiable, use null or an empty array for facts that are not visible. Do not include image data or secrets."
  ].join(" ");
}

function codePracticeVisualAnalysisContent(
  input: ProviderGenerationInput,
  imageReferences: string[]
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  return [
    {
      type: "text",
      text: `Analyze all ${imageReferences.length} screenshots oldest-to-newest. The latest screenshots are authoritative.\nSelected programming language: ${input.programmingLanguage ?? "unknown"}. Treat this selection as authoritative for the requested solution even when the editor language is not visible. Keep the JSON compact enough to complete.\n\nSession notes:\n${input.transcriptText}`
    },
    ...imageReferences.map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];
}

function generationUserContent(input: ProviderGenerationInput, visualAnalysis?: string): string {
  if (input.task === "code_practice") return codePracticeUserText(input, visualAnalysis ?? "{}");
  if (input.task === "exam_study") return examStudyUserText(input, visualAnalysis ?? "{}");
  return `Task: ${input.task ?? "session_assistance"}\nLanguage: ${input.responseLanguage}\nTranscript and context:\n${input.transcriptText}`;
}

function codePracticeUserText(input: ProviderGenerationInput, visualAnalysis: string): string {
  const previousGuidance = input.previousCodePracticeGuidance?.length
    ? input.previousCodePracticeGuidance
        .map((guidance, index) => `Previous guidance ${index + 1} (oldest to newest):\n${guidance}`)
        .join("\n\n")
    : "No previous Code Practice guidance exists for this session.";

  return `Task: code_practice
Response language: ${input.responseLanguage}
Selected programming language: ${input.programmingLanguage ?? "unknown"}

Structured visual analysis of all current screenshots:
${visualAnalysis}

Previous Code Practice guidance, which may contain mistakes:
${previousGuidance}

Recent transcript and screen timeline notes:
${input.transcriptText}

Produce the next tutoring turn, not a fresh generic solution. Follow this order:
1. "Diagnóstico da tentativa atual": identify the student's latest code/result and the concrete reason it fails. If no attempt is visible, say that clearly.
2. "Contrato exato da plataforma": state the exact function signature, provided fields/types, print-versus-return behavior, and output formatting. Do not add scaffolding the editor already provides.
3. "Correção do histórico": identify any incorrect or stale prior guidance and correct it explicitly. If prior guidance was sound, say what remains applicable.
4. "Correção mínima": show the smallest change that addresses the newest visible failure.
5. "Solução atualizada": for a public self-study or practice page, provide the complete method/function in the selected programming language and exact platform format. Match identifiers and output format exactly.
6. "Por que funciona": walk through the visible sample or newest test evidence.
7. "Complexidade Big-O" and "Checklist antes de enviar".

Hard requirements:
- Use the latest screenshot state as authoritative while using older screenshots to understand progress.
- Treat the newest identifiable exercise as the active problem. Use older screenshots only when they belong to that same exercise; ignore previous guidance for a different title, URL, signature, or behavior.
- When an exact public practice challenge is identifiable but its latest screenshot is partial, use the standard challenge contract and clearly label the assumption instead of withholding code.
- Use the selected programming language for every code block. If it is provided, do not output language-neutral pseudocode even when the editor language is not visible.
- Never use generic node fields such as value when the provided type uses data.
- Never print one item per line when the output contract requires one space-separated line.
- Never recreate Node, Tree, main, stdin parsing, or sample construction in a method-only submission.
- Do not claim the solution passes when the newest screenshot shows a failure; explain what still needs verification.
- Make Big-O specific to the proposed implementation: name the input variables and tie each cost to the traversals, loops, recursion depth, and data structures actually used.
- Return strict JSON with the complete Markdown answer in suggestions[0].content.`;
}
function examStudyUserText(input: ProviderGenerationInput, visualAnalysis: string): string {
  const previousGuidance = input.previousCodePracticeGuidance?.length
    ? input.previousCodePracticeGuidance
        .map((guidance, index) => `Previous study guidance ${index + 1} (oldest to newest):\n${guidance}`)
        .join("\n\n")
    : "No previous Exam Study guidance exists for this session.";
  return `Task: exam_study
Response language: ${input.responseLanguage}

Structured visual analysis of all current screenshots:
${visualAnalysis}

Previous guidance, which may contain mistakes:
${previousGuidance}

Recent screen timeline notes:
${input.transcriptText}

Solve the newest active public-exam question. Identify the subject and exact topic, explain the concept briefly, then solve it step by step in very simple language. Use older screenshots only to complete the same question. If alternatives are visible, give the correct option and analyze every visible alternative. Correct stale prior guidance explicitly. Return strict JSON with the complete Markdown lesson in suggestions[0].content.`;
}

function codePracticeRepairInstruction(input: ProviderGenerationInput, attempt: number): string {
  if (input.task !== "code_practice" || attempt === 1 || !input.programmingLanguage) return "";
  return `\n\nREPAIR REQUIRED: The previous answer was rejected because it did not contain a complete, non-empty fenced ${input.programmingLanguage} code block. Return the full strict JSON again. In suggestions[0].content, include the complete platform solution under "Solução atualizada" in a fenced code block labeled ${input.programmingLanguage}, then explain it step by step. Do not replace it with pseudocode and do not merely ask for another screenshot.`;
}

function hasRequiredCodeSolution(output: ProviderGenerationOutput, programmingLanguage: string): boolean {
  const content = output.suggestions[0]?.content ?? output.summary.content;
  const normalizedLanguage = programmingLanguage.trim().toLowerCase();
  const codeBlocks = [...content.matchAll(/```([^\r\n]*)[\r\n]+([\s\S]*?)```/g)];
  return codeBlocks.some((match) => match[1]?.trim().toLowerCase() === normalizedLanguage && Boolean(match[2]?.trim()));
}
function parseJsonObject(content: string): Record<string, unknown> | undefined {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i)?.[1];
  if (fenced) candidates.push(fenced);
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // Try the next safe extraction candidate.
    }
  }
  return undefined;
}
function parseGenerationContent(content: string, fallbackTranscript: string, task: ProviderGenerationInput["task"]): ProviderGenerationOutput {
  try {
    const parsed = parseJsonObject(content) as Partial<ProviderGenerationOutput> | undefined;
    if (!parsed) throw new Error("invalid generation JSON");
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const summaryContent = parsed.summary?.content?.trim() ?? "";
    const primaryContent = suggestions[0]?.content?.trim() ?? summaryContent;

    if (task === "code_practice" && !primaryContent) {
      throw new ProviderAdapterError(
        "PROVIDER_RESPONSE_INVALID",
        "Provider returned an empty Code Practice response.",
        true
      );
    }

    return {
      summary: { content: summaryContent || primaryContent || fallbackSummary(fallbackTranscript) },
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      suggestions
    };
  } catch (error) {
    if (error instanceof ProviderAdapterError) throw error;
    if (task === "code_practice") {
      throw new ProviderAdapterError(
        "PROVIDER_RESPONSE_INVALID",
        "Provider returned invalid JSON for Code Practice generation.",
        true
      );
    }

    return {
      summary: { content: fallbackSummary(fallbackTranscript) },
      insights: [],
      suggestions: content
        ? [{ category: "response", content, urgency: "medium" }]
        : []
    };
  }
}
function fallbackSummary(transcriptText: string): string {
  return `Current session summary: ${transcriptText.trim().slice(0, 120)}`;
}
