import { createMockProviderOutput } from "@persuando/config";

import type {
  ProviderAdapter,
  ProviderGenerationInput,
  ProviderGenerationOutput,
  ProviderTranscriptionInput,
  ProviderTranscriptionOutput
} from "./provider-adapter.js";

export class MockProviderAdapter implements ProviderAdapter {
  readonly name = "mock" as const;

  async transcribe(input: ProviderTranscriptionInput): Promise<ProviderTranscriptionOutput> {
    const output = createMockProviderOutput({
      sessionId: input.sessionId,
      transcriptText: "Mock transcript segment from authorized microphone audio.",
      responseLanguage: input.language
    });
    return { transcript: output.transcript };
  }

  async generate(input: ProviderGenerationInput): Promise<ProviderGenerationOutput> {
    const output = createMockProviderOutput({
      sessionId: input.sessionId,
      transcriptText: input.transcriptText,
      responseLanguage: input.responseLanguage
    });
    return {
      summary: output.summary,
      insights: output.insights,
      suggestions: output.suggestions
    };
  }
}
