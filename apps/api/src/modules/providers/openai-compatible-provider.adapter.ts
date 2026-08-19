import { ProviderAdapterError, type ProviderAdapter, type ProviderGenerationInput, type ProviderGenerationOutput, type ProviderTranscriptionInput, type ProviderTranscriptionOutput } from "./provider-adapter.js";

type FetchLike = typeof fetch;

export class OpenAiCompatibleProviderAdapter implements ProviderAdapter {
  readonly name = "openai-compatible" as const;

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

    const response = await this.fetchProvider("/chat/completions", input.apiKey, {
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: generationSystemPrompt(input.task)
          },
          {
            role: "user",
            content: generationUserContent(input)
          }
        ],
        model: input.analysisModel,
        response_format: { type: "json_object" }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return parseGenerationContent(payload.choices?.[0]?.message?.content ?? "", input.transcriptText);
  }

  private async fetchProvider(path: string, apiKey: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${apiKey}`,
          ...(init.headers ?? {})
        }
      });
    } catch {
      throw new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider network request failed.", true);
    }

    if (!response.ok) throw providerErrorForStatus(response.status);
    return response;
  }
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

function providerErrorForStatus(status: number): ProviderAdapterError {
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
    return new ProviderAdapterError("AUDIO_FORMAT_UNSUPPORTED", "Provider rejected the audio format.", false);
  }
  if (status === 429) {
    return new ProviderAdapterError("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", true);
  }
  if (status >= 500) {
    return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable.", true);
  }
  return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider request failed.", false);
}

function generationSystemPrompt(task: ProviderGenerationInput["task"]): string {
  if (task === "code_practice") {
    return [
      "You are Persuando Code Practice, a patient coding teacher for study, practice, preparation, and review.",
      "Use screenshots as primary context to identify the coding exercise, function signature, visible code, constraints, examples, errors, and the user's current attempt.",
      "Do not narrate the UI as the final answer. Produce useful coaching for the programming problem itself.",
      "Responsible-use boundary: if the image or transcript appears to show a proctored exam, hiring assessment, interview assessment, live contest, or platform challenge where direct answers may be disallowed, do not provide copy-paste final code. Give conceptual coaching, hints, pseudocode, complexity analysis, and debugging direction instead.",
      "If the context clearly appears to be self-study, preparation, local practice, review, or a user-owned sandbox, you may include complete final code while teaching the reasoning.",
      "Return STRICT JSON with summary.content, insights[], and suggestions[]. Put the main teaching answer in suggestions[0].content with category='response' and urgency='high'.",
      "The teaching answer must include: 1) problem restatement in simple words, 2) child-friendly intuition, 3) chosen technique, 4) step-by-step algorithm, 5) Big-O time complexity, 6) Big-O space complexity, 7) important edge cases, 8) pseudocode or final code when allowed, and 9) a tiny walkthrough/example.",
      "When code is allowed and visible, preserve the user's language and function signature when possible. Prefer TypeScript/JavaScript only if the language is unclear.",
      "Do not output generic advice like 'understand basic concepts'. Be concrete and didactic.",
      "Do not include secrets."
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

function generationUserContent(input: ProviderGenerationInput): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const text = input.task === "code_practice" ? codePracticeUserText(input) : `Task: ${input.task ?? "session_assistance"}
Language: ${input.responseLanguage}
Transcript and context:
${input.transcriptText}`;
  const imageReferences = input.imageReferences?.filter(Boolean) ?? [];
  if (imageReferences.length === 0) return text;
  return [
    { type: "text", text },
    ...imageReferences.slice(-4).map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];
}

function codePracticeUserText(input: ProviderGenerationInput): string {
  return `Task: code_practice
Language: ${input.responseLanguage}

Read the attached screenshots as the primary source. Look for a programming exercise, function signature, existing code, examples, constraints, and error messages.

Focus on teaching the programming problem. Do not describe the screenshot unless it is necessary to explain the reasoning. If the screenshot looks like an active assessment, platform challenge, proctored environment, or hiring/interview evaluation, give hints, pseudocode, reasoning, and complexity analysis instead of copy-paste final code.

Required output inside suggestions[0].content:
- Problem restatement in simple words.
- Intuition as if teaching a 5-year-old.
- Chosen technique.
- Step-by-step algorithm.
- Pseudocode, or complete final code only when clearly allowed for study/practice/review.
- Big-O time complexity and why.
- Big-O space complexity and why.
- Edge cases.
- Small walkthrough.

Recent transcript and session context:
${input.transcriptText}`;
}

function parseGenerationContent(content: string, fallbackTranscript: string): ProviderGenerationOutput {
  try {
    const parsed = JSON.parse(content) as Partial<ProviderGenerationOutput>;
    return {
      summary: parsed.summary?.content ? parsed.summary : { content: fallbackSummary(fallbackTranscript) },
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    };
  } catch {
    return {
      summary: { content: fallbackSummary(fallbackTranscript) },
      insights: [],
      suggestions: [
        {
          category: "response",
          content,
          urgency: "medium"
        }
      ]
    };
  }
}

function fallbackSummary(transcriptText: string): string {
  return `Current session summary: ${transcriptText.trim().slice(0, 120)}`;
}
