"use client";

import type {
  Insight,
  PersuandoWebSocketEvent,
  ProviderErrorEvent,
  RetentionDeletedEvent,
  SessionHistoryResponse,
  SessionId,
  SessionStatus,
  SessionStatusEvent,
  Suggestion,
  Summary,
  TranscriptSegment,
  CopilotExplanationEvent
} from "@persuando/contracts";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "deleted";
type GenerateMode = "summary" | "insights" | "followups" | "code_practice";
type PanelMode = "automatic" | "on_demand";
type PanelKey = "summary" | "answers" | "insights" | "followups" | "code";

const MAX_SCREEN_CONTEXTS = 30;

interface SessionRealtimeClientProps {
  history: SessionHistoryResponse;
}

interface RealtimeWireMessage {
  type: "realtime.connected" | "realtime.result" | "realtime.event" | "realtime.error";
  payload?: {
    replayedEvents?: PersuandoWebSocketEvent[];
  };
  event?: PersuandoWebSocketEvent;
  safeMessage?: string;
}

export function SessionRealtimeClient({ history }: Readonly<SessionRealtimeClientProps>) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(history.session.status);
  const [segments, setSegments] = useState<TranscriptSegment[]>(history.transcriptSegments);
  const [summaries, setSummaries] = useState<Summary[]>(history.summaries);
  const [insights, setInsights] = useState<Insight[]>(history.insights);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(history.suggestions);
  const [copilotExplanations, setCopilotExplanations] = useState<CopilotExplanation[]>([]);
  const [screenContexts, setScreenContexts] = useState<ScreenContext[]>([]);
  const [newInsightIds, setNewInsightIds] = useState<Set<string>>(new Set());
  const [newSuggestionIds, setNewSuggestionIds] = useState<Set<string>>(new Set());
  const [providerError, setProviderError] = useState<string | undefined>();
  const [lastEventAt, setLastEventAt] = useState<string | undefined>();
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "deleting" | "deleted" | "failed">("idle");
  const lastSequenceRef = useRef(maxInitialSequence(history));
  const joinedAtRef = useRef(new Date().toISOString());
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const [panelModes, setPanelModes] = useState<Record<PanelKey, PanelMode>>({
    answers: "automatic",
    code: "on_demand",
    followups: "on_demand",
    insights: "automatic",
    summary: "automatic"
  });
  const [generatingModes, setGeneratingModes] = useState<Set<GenerateMode>>(new Set());
  const panelModesRef = useRef(panelModes);
  const pendingManualModesRef = useRef<Set<GenerateMode>>(new Set());

  useEffect(() => {
    panelModesRef.current = panelModes;
  }, [panelModes]);

  useEffect(() => {
    let closedByComponent = false;
    let socket: WebSocket | undefined;

    const connect = () => {
      setConnectionState((current) => (current === "connecting" ? "connecting" : "reconnecting"));
      const url = realtimeUrl("response");
      console.info(`[Persuando Response] Opening realtime socket: ${url} sessionId=${history.session.id} lastSeenSequence=${lastSequenceRef.current}.`);
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        console.info(`[Persuando Response] Realtime socket opened: sessionId=${history.session.id}.`);
        setConnectionState("live");
        send(socket, {
          version: 1,
          type: "response.subscribe",
          sessionId: history.session.id,
          sentAt: new Date().toISOString(),
          payload: { lastSeenSequence: lastSequenceRef.current }
        });
      });

      socket.addEventListener("message", (message) => {
        const parsed = safeParseWireMessage(message.data);
        if (!parsed) return;
        if (parsed.type === "realtime.error") {
          setProviderError(parsed.safeMessage ?? "Realtime update failed.");
          return;
        }

        const events = parsed.type === "realtime.result" ? parsed.payload?.replayedEvents ?? [] : parsed.event ? [parsed.event] : [];
        console.info(
          `[Persuando Response] Realtime message received: sessionId=${history.session.id} wireType=${parsed.type} eventCount=${events.length} eventTypes=${events.map((event) => event.type).join(",") || "none"}.`
        );
        for (const event of events) {
          const accepted = shouldAcceptGeneratedEvent(event, panelModesRef.current, pendingManualModesRef.current);
          console.info(
            `[Persuando Response] Realtime event ${accepted ? "accepted" : "ignored"}: type=${event.type} sequence=${event.sequence ?? "none"} sessionId=${event.sessionId}.`
          );
          if (accepted) {
            applyEvent(event, joinedAtRef.current, {
              setConnectionState,
              setCopilotExplanations,
              setInsights,
              setLastEventAt,
              setNewInsightIds,
              setNewSuggestionIds,
              setProviderError,
              setScreenContexts,
              setSegments,
              setSessionStatus,
              setSuggestions,
              setSummaries
            });
          }
          ack(socket, history.session.id, event.sequence);
          if (event.sequence) lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
        }
      });

      socket.addEventListener("close", (event) => {
        console.warn(
          `[Persuando Response] Realtime socket closed: sessionId=${history.session.id} code=${event.code} reason=${event.reason || "none"} closedByComponent=${closedByComponent}.`
        );
        if (closedByComponent) return;
        setConnectionState("offline");
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      });
    };

    connect();

    return () => {
      closedByComponent = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (socketRef.current === socket) socketRef.current = undefined;
      socket?.close();
    };
  }, [history.session.id]);

  const latestSummary = summaries.at(-1);
  const directAnswers = suggestions.filter((suggestion) => suggestion.category === "response");
  const topics = deriveTopics(segments, insights);
  const statusCopy = useMemo(() => statusLabel(connectionState, sessionStatus), [connectionState, sessionStatus]);
  const requestGeneration = (mode: GenerateMode) => {
    if (connectionState !== "live") {
      setProviderError("Connect live updates before generating assistance.");
      return;
    }
    setProviderError(undefined);
    pendingManualModesRef.current.add(mode);
    setGeneratingModes((values) => new Set([...values, mode]));
    console.info(`[Persuando Response] Manual generation requested: sessionId=${history.session.id} mode=${mode}.`);
    send(socketRef.current, {
      version: 1,
      type: "response.generate",
      sessionId: history.session.id,
      sentAt: new Date().toISOString(),
      payload: { mode }
    });
    window.setTimeout(() => {
      setGeneratingModes((values) => {
        const next = new Set(values);
        next.delete(mode);
        pendingManualModesRef.current.delete(mode);
        return next;
      });
    }, 12000);
  };
  const updatePanelMode = (panel: PanelKey, mode: PanelMode) => {
    setPanelModes((current) => ({ ...current, [panel]: mode }));
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <strong>{history.session.title}</strong>
          <span>{statusCopy}</span>
        </div>
        <div className="stack horizontal">
          {deleteState === "confirming" ? (
            <>
              <button className="button subtle" onClick={() => setDeleteState("idle")} type="button">
                Keep
              </button>
              <button className="button danger" onClick={() => void deleteSession(history.session.id, setDeleteState)} type="button">
                Delete
              </button>
            </>
          ) : (
            <button className="button subtle" disabled={deleteState === "deleting" || deleteState === "deleted"} onClick={() => setDeleteState("confirming")} type="button">
              {deleteState === "deleted" ? "Deleted" : deleteState === "deleting" ? "Deleting" : "Delete session"}
            </button>
          )}
          <span className={connectionState === "live" ? "pill active" : "pill"}>{connectionState}</span>
          <span className={sessionStatus === "active" ? "pill active" : "pill"}>{sessionStatus}</span>
        </div>
      </header>

      <section className="detail-grid">
        <section className="panel transcript-panel">
          <div className="panel-heading">
            <h1>Transcript</h1>
            {lastEventAt ? <span className="muted">Updated {formatTime(lastEventAt)}</span> : null}
          </div>
          <TranscriptList segments={segments} />
        </section>

        <aside className="stack">
          <SummaryPanel isGenerating={generatingModes.has("summary")} mode={panelModes.summary} onGenerate={() => requestGeneration("summary")} onModeChange={(mode) => updatePanelMode("summary", mode)} summary={latestSummary} />
          <SuggestedAnswerPanel isGenerating={generatingModes.has("followups")} mode={panelModes.answers} newSuggestionIds={newSuggestionIds} onGenerate={() => requestGeneration("followups")} onModeChange={(mode) => updatePanelMode("answers", mode)} suggestions={directAnswers} />
          <TopicPanel topics={topics} />
          <InsightPanel insights={insights} isGenerating={generatingModes.has("insights")} mode={panelModes.insights} newInsightIds={newInsightIds} onGenerate={() => requestGeneration("insights")} onModeChange={(mode) => updatePanelMode("insights", mode)} />
          <SuggestionPanel isGenerating={generatingModes.has("followups")} mode={panelModes.followups} newSuggestionIds={newSuggestionIds} onGenerate={() => requestGeneration("followups")} onModeChange={(mode) => updatePanelMode("followups", mode)} suggestions={suggestions} />
          <ScreenContextPanel contexts={screenContexts} />
          <CopilotPanel explanations={copilotExplanations} isGenerating={generatingModes.has("code_practice")} mode={panelModes.code} onGenerate={() => requestGeneration("code_practice")} onModeChange={(mode) => updatePanelMode("code", mode)} />
          <SessionMeta deleteState={deleteState} history={history} providerError={providerError} />
        </aside>
      </section>
    </>
  );
}

interface GenerationPanelProps {
  isGenerating: boolean;
  mode: PanelMode;
  onGenerate(): void;
  onModeChange(mode: PanelMode): void;
}

function PanelTitle({ isGenerating, mode, onGenerate, onModeChange, title }: Readonly<GenerationPanelProps & { title: string }>) {
  return (
    <div className="panel-heading controls-heading">
      <h2>{title}</h2>
      <div className="panel-controls">
        <div className="segmented" role="group" aria-label={`${title} mode`}>
          <button className={mode === "automatic" ? "segmented-option active" : "segmented-option"} onClick={() => onModeChange("automatic")} type="button">
            Auto
          </button>
          <button className={mode === "on_demand" ? "segmented-option active" : "segmented-option"} onClick={() => onModeChange("on_demand")} type="button">
            On demand
          </button>
        </div>
        <button className="button subtle small" disabled={isGenerating} onClick={onGenerate} type="button">
          {isGenerating ? "Generating" : "Generate"}
        </button>
      </div>
    </div>
  );
}

function TranscriptList({ segments }: Readonly<{ segments: TranscriptSegment[] }>) {
  const groups = mergeTranscriptSegments(segments);
  if (groups.length === 0) {
    return (
      <div className="artifact-list">
        <span className="pill empty">No retained transcript yet.</span>
      </div>
    );
  }

  return (
    <div className="artifact-list transcript-scroll">
      {groups.map((group) => (
        <article className="artifact transcript-line" key={group.id}>
          <span className="timestamp">{formatMs(group.startMs)}</span>
          <p>{group.text}</p>
        </article>
      ))}
    </div>
  );
}

function SummaryPanel({ isGenerating, mode, onGenerate, onModeChange, summary }: Readonly<GenerationPanelProps & { summary?: Summary }>) {
  return (
    <section className="panel">
      <PanelTitle isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Summary" />
      <div className="artifact-list">
        {summary ? (
          <article className="artifact">
            <p>{summary.content}</p>
          </article>
        ) : (
          <span className="pill empty">No summary generated yet.</span>
        )}
      </div>
    </section>
  );
}

function SuggestedAnswerPanel({
  isGenerating,
  mode,
  newSuggestionIds,
  onGenerate,
  onModeChange,
  suggestions
}: Readonly<GenerationPanelProps & { newSuggestionIds: Set<string>; suggestions: Suggestion[] }>) {
  return (
    <section className="panel">
      <PanelTitle isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="What to say" />
      <div className="artifact-list">
        {suggestions.length === 0 ? (
          <span className="pill empty">No direct answer yet.</span>
        ) : (
          suggestions.slice(-3).map((suggestion) => (
            <article className="artifact emphasis" key={suggestion.id}>
              <span className={newSuggestionIds.has(suggestion.id) ? "pill active" : "pill"}>{newSuggestionIds.has(suggestion.id) ? "new" : suggestion.urgency}</span>
              <p>{suggestion.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function TopicPanel({ topics }: Readonly<{ topics: TopicExplanation[] }>) {
  return (
    <section className="panel">
      <h2>Topics</h2>
      <div className="artifact-list">
        {topics.length === 0 ? (
          <span className="pill empty">No topics detected yet.</span>
        ) : (
          topics.map((topic) => (
            <article className="artifact" key={topic.keyword}>
              <span className="pill">{topic.keyword}</span>
              <p>{topic.explanation}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function InsightPanel({ insights, isGenerating, mode, newInsightIds, onGenerate, onModeChange }: Readonly<GenerationPanelProps & { insights: Insight[]; newInsightIds: Set<string> }>) {
  return (
    <section className="panel">
      <PanelTitle isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Insights" />
      <div className="artifact-list">
        {insights.length === 0 ? (
          <span className="pill empty">No insights yet.</span>
        ) : (
          insights.map((insight) => (
            <article className="artifact" key={insight.id}>
              <span className={newInsightIds.has(insight.id) ? "pill active" : "pill"}>{newInsightIds.has(insight.id) ? "new" : insight.type}</span>
              <p>{insight.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SuggestionPanel({
  isGenerating,
  mode,
  newSuggestionIds,
  onGenerate,
  onModeChange,
  suggestions
}: Readonly<GenerationPanelProps & { newSuggestionIds: Set<string>; suggestions: Suggestion[] }>) {
  return (
    <section className="panel">
      <PanelTitle isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Follow-ups" />
      <div className="artifact-list">
        {suggestions.length === 0 ? (
          <span className="pill empty">No suggestions yet.</span>
        ) : (
          suggestions.map((suggestion) => (
            <article className="artifact" key={suggestion.id}>
              <span className={newSuggestionIds.has(suggestion.id) ? "pill active" : suggestion.urgency === "high" ? "pill empty" : "pill"}>
                {newSuggestionIds.has(suggestion.id) ? "new" : suggestion.category}
              </span>
              <p>{suggestion.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ScreenContextPanel({ contexts }: Readonly<{ contexts: ScreenContext[] }>) {
  return (
    <section className="panel">
      <h2>Screen context</h2>
      <div className="artifact-list panel-scroll">
        {contexts.length === 0 ? (
          <span className="pill empty">No screen context yet.</span>
        ) : (
          contexts.slice(-3).map((context) => (
            <article className="artifact" key={context.id}>
              <span className="pill active">screen</span>
              {context.imageReference ? <img alt="Captured screen context" className="screen-preview" src={context.imageReference} /> : null}
              {context.textContext ? <p>{context.textContext}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CopilotPanel({ explanations, isGenerating, mode, onGenerate, onModeChange }: Readonly<GenerationPanelProps & { explanations: CopilotExplanation[] }>) {
  return (
    <section className="panel">
      <PanelTitle isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Code practice" />
      <div className="artifact-list">
        {explanations.length === 0 ? (
          <span className="pill empty">No code explanation yet.</span>
        ) : (
          explanations.map((explanation) => (
            <article className="artifact" key={explanation.contextId}>
              <span className="pill active">{explanation.kind}</span>
              <p>{explanation.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SessionMeta({
  deleteState,
  history,
  providerError
}: Readonly<{ deleteState: "idle" | "confirming" | "deleting" | "deleted" | "failed"; history: SessionHistoryResponse; providerError?: string }>) {
  return (
    <section className="panel">
      <h2>State</h2>
      <div className="artifact-list">
        <span className="pill">{history.consentGrants.length} consent grants</span>
        <span className="muted">Retention expires {formatDate(history.session.retentionExpiresAt)}</span>
        {deleteState === "failed" ? <span className="pill empty">Delete failed.</span> : null}
        {deleteState === "deleted" ? <span className="pill active">Session deleted.</span> : null}
        {providerError ? <span className="pill empty">{providerError}</span> : null}
      </div>
    </section>
  );
}

interface ApplyEventSetters {
  setConnectionState: (state: ConnectionState) => void;
  setCopilotExplanations: Dispatch<SetStateAction<CopilotExplanation[]>>;
  setInsights: Dispatch<SetStateAction<Insight[]>>;
  setLastEventAt: (value: string) => void;
  setNewInsightIds: Dispatch<SetStateAction<Set<string>>>;
  setNewSuggestionIds: Dispatch<SetStateAction<Set<string>>>;
  setProviderError: (value: string | undefined) => void;
  setScreenContexts: Dispatch<SetStateAction<ScreenContext[]>>;
  setSegments: Dispatch<SetStateAction<TranscriptSegment[]>>;
  setSessionStatus: (status: SessionStatus) => void;
  setSuggestions: Dispatch<SetStateAction<Suggestion[]>>;
  setSummaries: Dispatch<SetStateAction<Summary[]>>;
}

function applyEvent(event: PersuandoWebSocketEvent, joinedAtIso: string, setters: ApplyEventSetters): void {
  setters.setLastEventAt(event.sentAt);
  const isAfterJoin = Date.parse(event.sentAt) >= Date.parse(joinedAtIso);
  if (event.type === "transcript.segment") upsertById(setters.setSegments, event.payload.segment);
  if (event.type === "summary.updated") upsertById(setters.setSummaries, event.payload.summary);
  if (event.type === "insight.created") {
    upsertById(setters.setInsights, event.payload.insight);
    if (isAfterJoin) addSetValue(setters.setNewInsightIds, event.payload.insight.id);
  }
  if (event.type === "suggestion.created") {
    upsertById(setters.setSuggestions, event.payload.suggestion);
    if (isAfterJoin) addSetValue(setters.setNewSuggestionIds, event.payload.suggestion.id);
  }
  if (event.type === "copilot.context") {
    console.info(
      `[Persuando Response] Applying copilot.context: sessionId=${event.sessionId} contextId=${event.payload.contextId} hasImage=${Boolean(event.payload.imageReference)} textLength=${event.payload.textContext?.length ?? 0}.`
    );
    if (event.payload.imageReference) {
      upsertByIdLimited(setters.setScreenContexts, toScreenContext(event), MAX_SCREEN_CONTEXTS);
    }
  }
  if (event.type === "copilot.explanation") {
    upsertById(setters.setCopilotExplanations, toCopilotExplanation(event));
  }
  if (event.type === "provider.error") setters.setProviderError(formatProviderError(event));
  if (event.type === "session.status") setters.setSessionStatus((event as SessionStatusEvent).payload.status);
  if (event.type === "retention.deleted") {
    setters.setConnectionState("deleted");
    setters.setProviderError(formatRetentionDeleted(event));
  }
}

function shouldAcceptGeneratedEvent(
  event: PersuandoWebSocketEvent,
  panelModes: Record<PanelKey, PanelMode>,
  pendingManualModes: Set<GenerateMode>
): boolean {
  if (event.type === "summary.updated") return panelModes.summary === "automatic" || consumePendingMode(pendingManualModes, "summary");
  if (event.type === "insight.created") return panelModes.insights === "automatic" || consumePendingMode(pendingManualModes, "insights");
  if (event.type === "suggestion.created") {
    return panelModes.answers === "automatic" || panelModes.followups === "automatic" || consumePendingMode(pendingManualModes, "followups");
  }
  if (event.type === "copilot.explanation") return panelModes.code === "automatic" || consumePendingMode(pendingManualModes, "code_practice");
  return true;
}

function consumePendingMode(pendingManualModes: Set<GenerateMode>, mode: GenerateMode): boolean {
  if (!pendingManualModes.has(mode)) return false;
  pendingManualModes.delete(mode);
  return true;
}

function addSetValue(setter: Dispatch<SetStateAction<Set<string>>>, value: string): void {
  setter((values) => new Set([...values, value]));
}

function upsertById<TItem extends { id: string }>(setter: Dispatch<SetStateAction<TItem[]>>, item: TItem): void {
  setter((items) => (items.some((existing) => existing.id === item.id) ? items.map((existing) => (existing.id === item.id ? item : existing)) : [...items, item]));
}

function upsertByIdLimited<TItem extends { id: string }>(setter: Dispatch<SetStateAction<TItem[]>>, item: TItem, maxItems: number): void {
  setter((items) => {
    const next = items.some((existing) => existing.id === item.id) ? items.map((existing) => (existing.id === item.id ? item : existing)) : [...items, item];
    return next.slice(-maxItems);
  });
}

interface TopicExplanation {
  keyword: string;
  explanation: string;
}

interface CopilotExplanation {
  id: string;
  contextId: string;
  kind: CopilotExplanationEvent["payload"]["kind"];
  content: string;
}

interface ScreenContext {
  id: string;
  imageReference?: string;
  textContext?: string;
}

interface TranscriptGroup {
  id: string;
  startMs: number;
  text: string;
}

function deriveTopics(segments: TranscriptSegment[], insights: Insight[]): TopicExplanation[] {
  const sourceText = [...segments.map((segment) => segment.text), ...insights.map((insight) => insight.content)].join(" ");
  const terms = sourceText
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 7)
    .filter((term) => !commonTerms.has(term.toLowerCase()));
  return Array.from(new Set(terms))
    .slice(0, 5)
    .map((keyword) => ({
      keyword,
      explanation: `Context term appearing in the session. Use the transcript around this word to explain it with the speaker's current intent.`
    }));
}

function mergeTranscriptSegments(segments: TranscriptSegment[]): TranscriptGroup[] {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .sort((left, right) => left.startMs - right.startMs)
    .map((segment) => ({
      id: segment.id,
      startMs: segment.startMs,
      text: removeRepeatedTranscriptText(normalizeTranscriptText(segment.text))
    }))
    .filter((group) => group.text.length > 0);
}

function normalizeTranscriptText(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ");
}

function removeRepeatedTranscriptText(value: string): string {
  const sentences = value.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [value];
  const reduced: string[] = [];
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    const previous = reduced.at(-1)?.toLowerCase();
    const previousTwo = reduced.slice(-2).join(" ").toLowerCase();
    if (previous === normalized) continue;
    if (previousTwo && normalized.includes(previousTwo)) continue;
    reduced.push(sentence);
  }
  return reduced.join(" ").trim();
}

function toScreenContext(event: Extract<PersuandoWebSocketEvent, { type: "copilot.context" }>): ScreenContext {
  return {
    id: event.payload.contextId,
    imageReference: event.payload.imageReference,
    textContext: event.payload.textContext
  };
}

function toCopilotExplanation(event: CopilotExplanationEvent): CopilotExplanation {
  return {
    id: event.payload.contextId,
    contextId: event.payload.contextId,
    kind: event.payload.kind,
    content: event.payload.content
  };
}

const commonTerms = new Set([
  "about",
  "because",
  "current",
  "discussing",
  "session",
  "should",
  "transcript",
  "conversation",
  "context",
  "quando",
  "porque",
  "sobre",
  "tambem",
  "entao"
]);

function realtimeUrl(clientType: "response"): string {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  const base = configured ?? "ws://localhost:4000/realtime";
  const url = new URL(base);
  url.searchParams.set("clientType", clientType);
  return url.toString();
}

function send(socket: WebSocket | undefined, event: PersuandoWebSocketEvent): void {
  if (socket?.readyState === WebSocket.OPEN) {
    console.info(
      `[Persuando Response] Sending realtime event: type=${event.type} sessionId=${event.sessionId} sequence=${event.sequence ?? "none"}.`
    );
    socket.send(JSON.stringify(event));
    return;
  }
  console.warn(
    `[Persuando Response] Realtime send skipped: type=${event.type} sessionId=${event.sessionId} readyState=${socket?.readyState ?? "missing"}.`
  );
}

function ack(socket: WebSocket | undefined, sessionId: string, sequence: number | undefined): void {
  if (!sequence) return;
  send(socket, {
    version: 1,
    type: "response.ack",
    sessionId: sessionId as SessionId,
    sentAt: new Date().toISOString(),
    payload: { lastReceivedSequence: sequence }
  });
}

function safeParseWireMessage(data: unknown): RealtimeWireMessage | undefined {
  if (typeof data !== "string") return undefined;
  try {
    return JSON.parse(data) as RealtimeWireMessage;
  } catch {
    return undefined;
  }
}

function maxInitialSequence(_history: SessionHistoryResponse): number {
  return 0;
}

function statusLabel(connectionState: ConnectionState, sessionStatus: SessionStatus): string {
  if (connectionState === "deleted") return "Session data was deleted.";
  if (connectionState === "live") return "Live updates connected.";
  if (connectionState === "reconnecting") return "Reconnecting to live updates.";
  if (connectionState === "offline") return "Live updates temporarily offline.";
  if (sessionStatus === "paused") return "Connecting to paused session.";
  if (sessionStatus === "ended") return "Connecting to ended session.";
  return `Connecting to ${sessionStatus} session.`;
}

function formatProviderError(event: ProviderErrorEvent): string {
  return event.payload.message;
}

function formatRetentionDeleted(event: RetentionDeletedEvent): string {
  return `Deleted ${formatTime(event.payload.deletedAt)}`;
}

function formatMs(value: number): string {
  const seconds = Math.floor(value / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    timeStyle: "short"
  }).format(new Date(value));
}

async function deleteSession(sessionId: string, setDeleteState: (state: "idle" | "confirming" | "deleting" | "deleted" | "failed") => void): Promise<void> {
  setDeleteState("deleting");
  const response = await fetch(`${apiBaseUrl()}/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "include"
  });
  setDeleteState(response.ok ? "deleted" : "failed");
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}
