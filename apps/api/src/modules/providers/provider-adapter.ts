import type { Insight, SafeError, Suggestion, Summary, TranscriptSegment } from "@persuando/contracts";

export interface ProviderTranscriptionInput {
  apiKey?: string;
  audio: Uint8Array;
  codec: "pcm16" | "webm-opus";
  language: string;
  model: string;
  prompt?: string;
  sessionId: string;
}

export interface ProviderGenerationInput {
  apiKey?: string;
  analysisModel: string;
  responseLanguage: string;
  sessionId: string;
  task?: "session_assistance" | "summary" | "insights" | "followups" | "code_practice";
  transcriptText: string;
  imageReferences?: string[];
}

export interface ProviderTranscriptionOutput {
  transcript: Pick<TranscriptSegment, "text" | "confidence" | "language" | "provisional">;
}

export interface ProviderGenerationOutput {
  summary: Pick<Summary, "content">;
  insights: Pick<Insight, "type" | "content" | "confidence">[];
  suggestions: Pick<Suggestion, "category" | "content" | "urgency">[];
}

export interface ProviderAdapter {
  readonly name: "mock" | "openai-compatible";
  generate(input: ProviderGenerationInput): Promise<ProviderGenerationOutput>;
  transcribe(input: ProviderTranscriptionInput): Promise<ProviderTranscriptionOutput>;
}

export class ProviderAdapterError extends Error {
  constructor(
    readonly code:
      | "PROVIDER_KEY_INVALID"
      | "PROVIDER_RATE_LIMITED"
      | "PROVIDER_QUOTA_EXCEEDED"
      | "PROVIDER_TIMEOUT"
      | "PROVIDER_UNAVAILABLE"
      | "AUDIO_FORMAT_UNSUPPORTED",
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export function toSafeProviderError(error: unknown): SafeError {
  if (error instanceof ProviderAdapterError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable
    };
  }

  return {
    code: "PROVIDER_UNAVAILABLE",
    message: "Provider request failed before a safe response was available.",
    retryable: true
  };
}
