import type { Insight, Suggestion, Summary, TranscriptSegment } from "@persuando/contracts";

export interface MockProviderInput {
  sessionId: string;
  transcriptText: string;
  responseLanguage: string;
}

export interface MockProviderOutput {
  transcript: Pick<TranscriptSegment, "text" | "confidence" | "language" | "provisional">;
  summary: Pick<Summary, "content">;
  insights: Pick<Insight, "type" | "content" | "confidence">[];
  suggestions: Pick<Suggestion, "category" | "content" | "urgency">[];
}

export function createMockProviderOutput(input: MockProviderInput): MockProviderOutput {
  const text = input.transcriptText.trim() || "Mock transcript segment from authorized microphone audio.";
  return {
    transcript: {
      text,
      confidence: 0.98,
      language: input.responseLanguage,
      provisional: false
    },
    summary: {
      content: `Current session summary: ${text.slice(0, 120)}`
    },
    insights: [
      {
        type: "question",
        content: "Ask a clarifying question about the next concrete decision.",
        confidence: 0.86
      }
    ],
    suggestions: [
      {
        category: "response",
        content: "Acknowledge the point, confirm the decision owner, and propose the next step.",
        urgency: "medium"
      }
    ]
  };
}
