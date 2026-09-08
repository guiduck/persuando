"use client";

import type {
  AssistantMode,
  CodePracticeWorkflow,
  InterviewResponseLanguage,
  Insight,
  PracticeStep,
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
  CopilotExplanationEvent,
  VisualGenerationMode
} from "@persuando/contracts";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { isValidElement, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { SortableSessionLayout, type SessionLayoutCardKey } from "./sortable-session-layout";

type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "deleted";
type GenerateMode = "summary" | "insights" | "followups" | VisualGenerationMode;
type PanelMode = "automatic" | "on_demand";
type PanelKey = "summary" | "answers" | "insights" | "followups" | "code" | "systemDesign";
type FocusPanelKey = SessionLayoutCardKey;

const MAX_SCREEN_CONTEXTS = 30;
const MAX_SYSTEM_DESIGN_SCREEN_CONTEXTS = 6;
const GENERATION_SLOW_NOTICE_MS = 180_000;
const GENERATION_TIMEOUT_MS = 600_000;
const systemDesignDiagramLegendPattern = /(?:^|\r?\n)(?:#{2,3}[ \t]+(?:Diagrama da solução|Solution diagram|Architecture diagram)[^\r\n]*\r?\n+)?```mermaid[^\S\r\n]*\r?\n([\s\S]+?)```\s*\r?\n+#{2}[ \t]+(Legenda do diagrama|Diagram legend)[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n#{1,2}[ \t]+|$)/i;
const layoutCardLabels: Record<SessionLayoutCardKey, string> = {
  answers: "What to say",
  code: "Code practice",
  followups: "Follow-ups",
  insights: "Insights",
  screen: "Screen context",
  state: "State",
  summary: "Summary",
  systemDesign: "System Design",
  topics: "Topics",
  transcript: "Transcript"
};

interface SessionRealtimeClientProps {
  history: SessionHistoryResponse;
  assistantMode: AssistantMode;
  initialResponseLanguage: InterviewResponseLanguage;
  realtimeEndpoint: string;
}

interface RealtimeWireMessage {
  type: "realtime.connected" | "realtime.result" | "realtime.event" | "realtime.error";
  payload?: {
    replayedEvents?: PersuandoWebSocketEvent[];
  };
  event?: PersuandoWebSocketEvent;
  safeMessage?: string;
}

export function SessionRealtimeClient({ assistantMode, history, initialResponseLanguage, realtimeEndpoint }: Readonly<SessionRealtimeClientProps>) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(history.session.status);
  const [segments, setSegments] = useState<TranscriptSegment[]>(history.transcriptSegments);
  const [summaries, setSummaries] = useState<Summary[]>(history.summaries);
  const [insights, setInsights] = useState<Insight[]>(history.insights);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(history.suggestions);
  const [copilotExplanations, setCopilotExplanations] = useState<CopilotExplanation[]>(
    () => (history.generatedGuidance ?? []).map(toCopilotExplanationFromHistory)
  );
  const [screenContexts, setScreenContexts] = useState<ScreenContext[]>((history.screenContexts ?? []).slice(-MAX_SCREEN_CONTEXTS));
  const [newInsightIds, setNewInsightIds] = useState<Set<string>>(new Set());
  const [newSuggestionIds, setNewSuggestionIds] = useState<Set<string>>(new Set());
  const [providerError, setProviderError] = useState<string | undefined>();
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [lastEventAt, setLastEventAt] = useState<string | undefined>();
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "deleting" | "deleted" | "failed">("idle");
  const [highlightedPanel, setHighlightedPanel] = useState<FocusPanelKey | undefined>();
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [layoutAnnouncement, setLayoutAnnouncement] = useState("");
  const [layoutOrder, setLayoutOrder] = useState<SessionLayoutCardKey[]>(() => loadLayoutOrder(assistantMode));
  const [codePracticeWorkflow, setCodePracticeWorkflow] = useState<CodePracticeWorkflow>(() => loadCodePracticeWorkflow(history.session.id));
  const [responseLanguage, setResponseLanguage] = useState<InterviewResponseLanguage>(
    () => loadInterviewResponseLanguage(history.session.id, initialResponseLanguage)
  );
  const lastSequenceRef = useRef(maxInitialSequence(history));
  const joinedAtRef = useRef(new Date().toISOString());
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const [panelModes, setPanelModes] = useState<Record<PanelKey, PanelMode>>({
    answers: "automatic",
    code: "on_demand",
    systemDesign: "on_demand",
    followups: "on_demand",
    insights: "automatic",
    summary: "automatic"
  });
  const [generatingModes, setGeneratingModes] = useState<Set<GenerateMode>>(new Set());
  const panelModesRef = useRef(panelModes);
  const pendingManualModesRef = useRef<Set<GenerateMode>>(new Set());
  const lastAutomaticGenerationRef = useRef<Partial<Record<GenerateMode, { contextId: string; requestedAt: number }>>>({});
  const generatingModesRef = useRef(generatingModes);

  useEffect(() => {
    panelModesRef.current = panelModes;
  }, [panelModes]);

  useEffect(() => {
    generatingModesRef.current = generatingModes;
  }, [generatingModes]);

  useEffect(() => {
    saveCodePracticeWorkflow(history.session.id, codePracticeWorkflow);
  }, [codePracticeWorkflow, history.session.id]);

  useEffect(() => {
    saveInterviewResponseLanguage(history.session.id, responseLanguage);
  }, [history.session.id, responseLanguage]);

  useEffect(() => {
    saveLayoutOrder(assistantMode, layoutOrder);
  }, [assistantMode, layoutOrder]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHighlightedPanel(undefined);
        setLayoutEditing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    let closedByComponent = false;
    let socket: WebSocket | undefined;

    const connect = () => {
      setConnectionState((current) => (current === "connecting" ? "connecting" : "reconnecting"));
      const url = realtimeUrl(realtimeEndpoint, "response");
      console.info(`[Persuando Response] Opening realtime socket: ${url} sessionId=${history.session.id} lastSeenSequence=${lastSequenceRef.current}.`);
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        console.info(`[Persuando Response] Realtime socket opened: sessionId=${history.session.id}.`);
        setConnectionError(undefined);
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
          setGeneratingModes(new Set());
          pendingManualModesRef.current.clear();
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
          if (accepted) {
            const completedMode = generatedModeForEvent(event);
            if (completedMode) {
              setProviderError(undefined);
              setGeneratingModes((values) => {
                const next = new Set(values);
                next.delete(completedMode);
                return next;
              });
            }
          }
          if (event.type === "provider.error") {
            setGeneratingModes(new Set());
            pendingManualModesRef.current.clear();
          }
          ack(socket, history.session.id, event.sequence);
          if (event.sequence) lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
        }
      });

      socket.addEventListener("error", () => {
        const endpoint = safeRealtimeEndpoint(realtimeEndpoint);
        console.error(
          `[Persuando Response] Realtime socket error: sessionId=${history.session.id} endpoint=${endpoint}.`
        );
        setConnectionError(`Could not connect to live updates at ${endpoint}. Check the Response WebSocket configuration.`);
      });

      socket.addEventListener("close", (event) => {
        console.warn(
          `[Persuando Response] Realtime socket closed: sessionId=${history.session.id} code=${event.code} reason=${event.reason || "none"} closedByComponent=${closedByComponent}.`
        );
        if (closedByComponent) return;
        setConnectionError(
          `Live updates disconnected from ${safeRealtimeEndpoint(realtimeEndpoint)} (code ${event.code}). Retrying automatically.`
        );
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
  }, [history.session.id, realtimeEndpoint]);

  const latestSummary = summaries.at(-1);
  const directAnswers = suggestions.filter((suggestion) => suggestion.category === "response");
  const visualMode: Extract<GenerateMode, "code_practice" | "exam_study"> = assistantMode === "exam_study" ? "exam_study" : "code_practice";
  const visibleExplanations = copilotExplanations.filter((item) => (item.assistantMode ?? "code_practice") === visualMode);
  const systemDesignExplanations = copilotExplanations.filter((item) => item.assistantMode === "system_design");
  const topics = deriveTopics(segments, insights);
  const statusCopy = useMemo(() => statusLabel(connectionState, sessionStatus), [connectionState, sessionStatus]);
  const requestGeneration = (mode: GenerateMode, source: "manual" | "automatic" = "manual") => {
    if (connectionState !== "live") {
      setConnectionError(
        `Cannot generate until live updates connect to ${safeRealtimeEndpoint(realtimeEndpoint)}. The app is retrying automatically.`
      );
      return;
    }
    if (generatingModesRef.current.has(mode)) {
      console.info(`[Persuando Response] Generation skipped because a request is already in flight: sessionId=${history.session.id} mode=${mode}.`);
      return;
    }
    setProviderError(undefined);
    if (source === "manual") pendingManualModesRef.current.add(mode);
    setGeneratingModes((values) => new Set([...values, mode]));
    const screenContextLimit = mode === "system_design" ? MAX_SYSTEM_DESIGN_SCREEN_CONTEXTS : MAX_SCREEN_CONTEXTS;
    const requestScreenContexts = mode === "code_practice" || mode === "system_design" || mode === "exam_study"
      ? screenContexts.slice(-screenContextLimit).map((context) => ({
          imageReference: context.imageReference,
          textContext: context.textContext
        }))
      : undefined;
    console.info(`[Persuando Response] ${source === "manual" ? "Manual" : "Automatic"} generation requested: sessionId=${history.session.id} mode=${mode} workflow=${mode === "code_practice" ? codePracticeWorkflow : "none"} responseLanguage=${responseLanguage} screenContexts=${requestScreenContexts?.length ?? 0} imageReferences=${requestScreenContexts?.filter((context) => Boolean(context.imageReference)).length ?? 0}.`);
    send(socketRef.current, {
      version: 1,
      type: "response.generate",
      sessionId: history.session.id,
      sentAt: new Date().toISOString(),
      payload: {
        mode,
        codePracticeWorkflow: mode === "code_practice" ? codePracticeWorkflow : undefined,
        responseLanguage,
        screenContexts: requestScreenContexts
      }
    });
    window.setTimeout(() => {
      if (source !== "manual" || !pendingManualModesRef.current.has(mode)) return;
      setProviderError("Generation is taking longer than usual, but it is still running. The result will appear automatically when it is ready.");
    }, GENERATION_SLOW_NOTICE_MS);
    window.setTimeout(() => {
      const timedOut = source === "manual" && pendingManualModesRef.current.delete(mode);
      setGeneratingModes((values) => {
        const next = new Set(values);
        next.delete(mode);
        return next;
      });
      if (timedOut) {
        setProviderError("Generation did not finish within 10 minutes. The provider request was stopped or failed to return a usable response. Check the API generation logs.");
      }
    }, GENERATION_TIMEOUT_MS);
  };
  const updatePanelMode = (panel: PanelKey, mode: PanelMode) => {
    setPanelModes((current) => ({ ...current, [panel]: mode }));
  };

  useEffect(() => {
    if (assistantMode === "conversation") return;
    if (panelModes.code !== "automatic") return;
    if (connectionState !== "live" || sessionStatus !== "active") return;
    if (screenContexts.length === 0 || generatingModes.has(visualMode)) return;

    const newestContextId = screenContexts.at(-1)?.id;
    if (!newestContextId) return;
    const now = Date.now();
    const previous = lastAutomaticGenerationRef.current[visualMode];
    if (previous && (previous.contextId === newestContextId || now - previous.requestedAt < 8000)) return;

    lastAutomaticGenerationRef.current[visualMode] = { contextId: newestContextId, requestedAt: now };
    console.info(
      `[Persuando Response] Code Practice auto trigger armed: sessionId=${history.session.id} screenContexts=${screenContexts.length}.`
    );
    const timer = window.setTimeout(() => requestGeneration(visualMode, "automatic"), 1200);
    return () => window.clearTimeout(timer);
  }, [assistantMode, connectionState, generatingModes, history.session.id, panelModes.code, screenContexts, sessionStatus, visualMode]);

  useEffect(() => {
    if (assistantMode !== "code_practice" || panelModes.systemDesign !== "automatic") return;
    if (connectionState !== "live" || sessionStatus !== "active") return;
    if (screenContexts.length === 0 || generatingModes.has("system_design")) return;

    const newestContextId = screenContexts.at(-1)?.id;
    if (!newestContextId) return;
    const now = Date.now();
    const previous = lastAutomaticGenerationRef.current.system_design;
    if (previous && (previous.contextId === newestContextId || now - previous.requestedAt < 8000)) return;

    lastAutomaticGenerationRef.current.system_design = { contextId: newestContextId, requestedAt: now };
    console.info(
      `[Persuando Response] System Design auto trigger armed: sessionId=${history.session.id} screenContexts=${screenContexts.length}.`
    );
    const timer = window.setTimeout(() => requestGeneration("system_design", "automatic"), 1200);
    return () => window.clearTimeout(timer);
  }, [assistantMode, connectionState, generatingModes, history.session.id, panelModes.systemDesign, screenContexts, sessionStatus]);

  const focusControl = (panel: FocusPanelKey, title: string) => (
    <HighlightPanelButton
      expanded={highlightedPanel === panel}
      onToggle={() => setHighlightedPanel((current) => (current === panel ? undefined : panel))}
      title={title}
    />
  );
  const panelClass = (panel: FocusPanelKey) => panelClassName(panel, highlightedPanel);
  const visualStatus = visualMode === "code_practice" ? codePracticeStatus(screenContexts.length, generatingModes.has(visualMode), panelModes.code) : undefined;
  const visibleLayoutOrder = normalizeLayoutOrder(layoutOrder, assistantMode);
  const currentLayoutLabels = assistantMode === "exam_study"
    ? { ...layoutCardLabels, code: "Exam Study" }
    : layoutCardLabels;
  const toggleLayoutEditing = () => {
    setHighlightedPanel(undefined);
    setLayoutEditing((current) => {
      const next = !current;
      setLayoutAnnouncement(next
        ? "Layout editing enabled. Drag cards or use their move buttons."
        : "Layout saved for future sessions in this assistant mode.");
      return next;
    });
  };
  const resetLayout = () => {
    setLayoutOrder(defaultLayoutOrder(assistantMode));
    setLayoutAnnouncement("Default card order restored.");
  };
  const renderLayoutCard = (card: SessionLayoutCardKey): ReactNode => {
    switch (card) {
      case "transcript":
        return (
          <section className={`panel transcript-panel ${panelClass("transcript")}`}>
            <div className="panel-heading">
              <h1>Transcript</h1>
              <div className="panel-controls">{lastEventAt ? <span className="muted">Updated {formatTime(lastEventAt)}</span> : null}{focusControl("transcript", "Transcript")}</div>
            </div>
            <TranscriptList segments={segments} />
          </section>
        );
      case "summary":
        return <SummaryPanel className={panelClass("summary")} focusControl={focusControl("summary", "Summary")} isGenerating={generatingModes.has("summary")} mode={panelModes.summary} onGenerate={() => requestGeneration("summary")} onModeChange={(mode) => updatePanelMode("summary", mode)} summary={latestSummary} />;
      case "answers":
        return <SuggestedAnswerPanel className={panelClass("answers")} focusControl={focusControl("answers", "What to say")} isGenerating={generatingModes.has("followups")} mode={panelModes.answers} newSuggestionIds={newSuggestionIds} onGenerate={() => requestGeneration("followups")} onModeChange={(mode) => updatePanelMode("answers", mode)} suggestions={directAnswers} />;
      case "topics":
        return <TopicPanel className={panelClass("topics")} focusControl={focusControl("topics", "Topics")} topics={topics} />;
      case "insights":
        return <InsightPanel className={panelClass("insights")} focusControl={focusControl("insights", "Insights")} insights={insights} isGenerating={generatingModes.has("insights")} mode={panelModes.insights} newInsightIds={newInsightIds} onGenerate={() => requestGeneration("insights")} onModeChange={(mode) => updatePanelMode("insights", mode)} />;
      case "followups":
        return <SuggestionPanel className={panelClass("followups")} focusControl={focusControl("followups", "Follow-ups")} isGenerating={generatingModes.has("followups")} mode={panelModes.followups} newSuggestionIds={newSuggestionIds} onGenerate={() => requestGeneration("followups")} onModeChange={(mode) => updatePanelMode("followups", mode)} suggestions={suggestions} />;
      case "screen":
        return <ScreenContextPanel className={panelClass("screen")} contexts={screenContexts} focusControl={focusControl("screen", "Screen context")} />;
      case "code":
        if (assistantMode === "exam_study") {
          return (
            <CopilotPanel
              className={panelClass("code")}
              codePracticeWorkflow={codePracticeWorkflow}
              error={connectionError ?? providerError}
              explanations={visibleExplanations}
              focusControl={focusControl("code", "Exam Study")}
              isGenerating={generatingModes.has("exam_study")}
              mode={panelModes.code}
              onGenerate={() => requestGeneration("exam_study")}
              onModeChange={(mode) => updatePanelMode("code", mode)}
              onWorkflowChange={setCodePracticeWorkflow}
              status={visualStatus}
              title="Exam Study"
              visualMode="exam_study"
            />
          );
        }
        return (
          <CopilotPanel
            className={panelClass("code")}
            codePracticeWorkflow={codePracticeWorkflow}
            error={connectionError ?? providerError}
            explanations={visibleExplanations}
            focusControl={focusControl("code", "Code practice")}
            isGenerating={generatingModes.has("code_practice")}
            mode={panelModes.code}
            onGenerate={() => requestGeneration("code_practice")}
            onModeChange={(mode) => updatePanelMode("code", mode)}
            onWorkflowChange={setCodePracticeWorkflow}
            status={visualStatus}
            title="Code practice"
            visualMode="code_practice"
          />
        );
      case "systemDesign":
        return (
          <CopilotPanel
            className={panelClass("systemDesign")}
            codePracticeWorkflow={codePracticeWorkflow}
            error={connectionError ?? providerError}
            explanations={systemDesignExplanations}
            focusControl={focusControl("systemDesign", "System Design")}
            isGenerating={generatingModes.has("system_design")}
            mode={panelModes.systemDesign}
            onGenerate={() => requestGeneration("system_design")}
            onModeChange={(mode) => updatePanelMode("systemDesign", mode)}
            onWorkflowChange={setCodePracticeWorkflow}
            status={codePracticeStatus(screenContexts.length, generatingModes.has("system_design"), panelModes.systemDesign)}
            title="System Design"
            visualMode="system_design"
          />
        );
      case "state":
        return <SessionMeta className={panelClass("state")} deleteState={deleteState} focusControl={focusControl("state", "State")} history={history} providerError={connectionError ?? providerError} />;
    }
  };
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <strong>{history.session.title}</strong>
          <span>{statusCopy}</span>
        </div>
        <div className="stack horizontal">
          <button
            aria-pressed={layoutEditing}
            className={layoutEditing ? "button layout-edit-button active" : "button subtle layout-edit-button"}
            onClick={toggleLayoutEditing}
            type="button"
          >
            {layoutEditing ? "Done arranging" : "Edit layout"}
          </button>
          {layoutEditing ? (
            <button className="button subtle" onClick={resetLayout} type="button">
              Reset layout
            </button>
          ) : null}
          <LanguageSelector language={responseLanguage} onChange={setResponseLanguage} />
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

      <p aria-atomic="true" aria-live="polite" className="sr-only">{layoutAnnouncement}</p>

      {layoutEditing ? (
        <aside className="layout-edit-banner" id="layout-edit-instructions">
          <strong>Arrange your session</strong>
          <span>Drag cards into place. The grid fills left to right, or use each card’s arrow buttons. Your order is saved for this assistant mode.</span>
        </aside>
      ) : null}

      <section
        aria-describedby={layoutEditing ? "layout-edit-instructions" : undefined}
        className={`${highlightedPanel ? "detail-grid has-highlight" : "detail-grid"}${layoutEditing ? " layout-edit-mode" : ""}`}
      >
        <SortableSessionLayout
          editing={layoutEditing}
          highlightedCard={highlightedPanel}
          items={visibleLayoutOrder}
          labels={currentLayoutLabels}
          onAnnouncement={setLayoutAnnouncement}
          onItemsChange={setLayoutOrder}
        >
          {renderLayoutCard}
        </SortableSessionLayout>
      </section>
    </>
  );
}

interface PanelFrameProps {
  className?: string;
  focusControl?: ReactNode;
}

interface GenerationPanelProps extends PanelFrameProps {
  isGenerating: boolean;
  mode: PanelMode;
  onGenerate(): void;
  onModeChange(mode: PanelMode): void;
}

function HighlightPanelButton({ expanded, onToggle, title }: Readonly<{ expanded: boolean; onToggle(): void; title: string }>) {
  const label = expanded ? `Collapse ${title} panel` : `Expand ${title} panel`;
  return (
    <button aria-label={label} className="icon-button small" onClick={onToggle} title={label} type="button">
      {expanded ? "-" : "+"}
    </button>
  );
}

function LanguageSelector({
  language,
  onChange
}: Readonly<{
  language: InterviewResponseLanguage;
  onChange(language: InterviewResponseLanguage): void;
}>) {
  return (
    <div className="segmented language-selector" role="group" aria-label="Model response language">
      <button className={language === "pt-BR" ? "segmented-option active" : "segmented-option"} onClick={() => onChange("pt-BR")} type="button">
        Português
      </button>
      <button className={language === "en-US" ? "segmented-option active" : "segmented-option"} onClick={() => onChange("en-US")} type="button">
        English
      </button>
    </div>
  );
}

function PanelTitle({ focusControl, isGenerating, mode, onGenerate, onModeChange, title }: Readonly<GenerationPanelProps & { title: string }>) {
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
        {focusControl}
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

function SummaryPanel({ className, focusControl, isGenerating, mode, onGenerate, onModeChange, summary }: Readonly<GenerationPanelProps & { summary?: Summary }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <PanelTitle focusControl={focusControl} isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Summary" />
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

function SuggestedAnswerPanel({ className, focusControl, isGenerating, mode, newSuggestionIds, onGenerate, onModeChange, suggestions }: Readonly<GenerationPanelProps & { newSuggestionIds: Set<string>; suggestions: Suggestion[] }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <PanelTitle focusControl={focusControl} isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="What to say" />
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

function TopicPanel({ className, focusControl, topics }: Readonly<PanelFrameProps & { topics: TopicExplanation[] }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <div className="panel-heading"><h2>Topics</h2>{focusControl}</div>
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

function InsightPanel({ className, focusControl, insights, isGenerating, mode, newInsightIds, onGenerate, onModeChange }: Readonly<GenerationPanelProps & { insights: Insight[]; newInsightIds: Set<string> }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <PanelTitle focusControl={focusControl} isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Insights" />
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

function SuggestionPanel({ className, focusControl, isGenerating, mode, newSuggestionIds, onGenerate, onModeChange, suggestions }: Readonly<GenerationPanelProps & { newSuggestionIds: Set<string>; suggestions: Suggestion[] }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <PanelTitle focusControl={focusControl} isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title="Follow-ups" />
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

function ScreenContextPanel({ className, contexts, focusControl }: Readonly<PanelFrameProps & { contexts: ScreenContext[] }>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const newestContextId = contexts.at(-1)?.id;
  const newestFirstContexts = [...contexts].reverse();

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [newestContextId]);

  return (
    <section className={`panel ${className ?? ""}`}>
      <div className="panel-heading">
        <h2>Screen context</h2>
        <div className="panel-controls"><span className="pill">{contexts.length}/{MAX_SCREEN_CONTEXTS} newest to oldest</span>{focusControl}</div>
      </div>
      <div className="artifact-list panel-scroll" ref={scrollContainerRef}>
        {contexts.length === 0 ? (
          <span className="pill empty">No screen context yet.</span>
        ) : (
          newestFirstContexts.map((context, index) => (
            <article className="artifact" key={context.id}>
              <span className="pill active">screen {contexts.length - index}{index === 0 ? " newest" : ""}</span>
              {context.imageReference ? <img alt="Captured screen context" className="screen-preview" src={context.imageReference} /> : null}
              {context.textContext ? <p>{context.textContext}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CopilotPanel({ className, codePracticeWorkflow, error, explanations, focusControl, isGenerating, mode, onGenerate, onModeChange, onWorkflowChange, status, title, visualMode }: Readonly<GenerationPanelProps & { codePracticeWorkflow: CodePracticeWorkflow; error?: string; explanations: CopilotExplanation[]; onWorkflowChange(workflow: CodePracticeWorkflow): void; status?: string; title: string; visualMode: VisualGenerationMode }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <PanelTitle focusControl={focusControl} isGenerating={isGenerating} mode={mode} onGenerate={onGenerate} onModeChange={onModeChange} title={title} />
      {visualMode === "code_practice" ? (
        <div className="workflow-row">
          <div className="segmented workflow-segmented" role="group" aria-label="Code Practice workflow">
            <button className={codePracticeWorkflow === "exercise" ? "segmented-option active" : "segmented-option"} onClick={() => onWorkflowChange("exercise")} type="button">
              Code Problem
            </button>
            <button className={codePracticeWorkflow === "repository" ? "segmented-option active" : "segmented-option"} onClick={() => onWorkflowChange("repository")} type="button">
              Repository
            </button>
          </div>
          {status ? <span className={isGenerating ? "pill active" : "pill"}>{status}</span> : null}
        </div>
      ) : null}
      {visualMode === "system_design" ? <SystemDesignReferenceLauncher /> : null}
      <div className="artifact-list">
        {error ? (
          <span className="pill empty">
            Latest generation failed: {error}{explanations.length > 0 ? " The previous successful explanation is still shown below." : ""}
          </span>
        ) : null}
        {explanations.length === 0 ? (
          <span className="pill empty">No {title.toLowerCase()} explanation yet.</span>
        ) : (
          explanations.map((explanation) => (
            <article className="artifact" key={explanation.contextId}>
              <span className="pill active">{explanation.assistantMode === "system_design" ? "system design" : explanation.codePracticeWorkflow ?? explanation.kind}</span>
              {explanation.assistantMode === "system_design"
                ? <SystemDesignExplanationContent content={explanation.content} />
                : <MarkdownContent content={explanation.content} />}
              {explanation.practiceSteps?.length ? <PracticeStepCards steps={explanation.practiceSteps} /> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SystemDesignReferenceLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <aside className="system-design-reference-callout">
        <div>
          <strong>Guia rápido de conceitos</strong>
          <span>Revise componentes, quando usá-los e os trade-offs antes da solução.</span>
        </div>
        <button
          aria-controls="system-design-reference-dialog"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="button subtle"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Abrir guia rápido
        </button>
      </aside>
      {isOpen ? <SystemDesignReferenceDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

function SystemDesignReferenceDialog({ onClose }: Readonly<{ onClose(): void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState<string>();
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    void fetch("/system-design-reference.md", { cache: "force-cache", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`System Design reference request failed with status ${response.status}.`);
        return response.text();
      })
      .then(setContent)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const closeDialog = () => dialogRef.current?.close();

  return (
    <dialog
      aria-describedby="system-design-reference-description"
      aria-labelledby="system-design-reference-title"
      className="system-design-reference-dialog"
      id="system-design-reference-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="system-design-reference-surface">
        <header className="system-design-reference-header">
          <div>
            <span className="pill active">referência rápida</span>
            <h2 id="system-design-reference-title">Guia rápido de System Design</h2>
            <p id="system-design-reference-description">Conceitos, usos, benefícios, custos e exemplos de como explicar decisões na entrevista.</p>
          </div>
          <button autoFocus aria-label="Fechar guia rápido" className="icon-button small" onClick={closeDialog} title="Fechar guia rápido" type="button">
            ×
          </button>
        </header>
        <div className="system-design-reference-body">
          {!content && !loadError ? <p aria-live="polite" role="status">Carregando guia rápido…</p> : null}
          {loadError ? (
            <div className="system-design-reference-load-error" role="alert">
              <p>Não foi possível carregar o guia rápido.</p>
              <button className="button subtle" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Tentar novamente</button>
            </div>
          ) : null}
          {content ? <SystemDesignReferenceMarkdown content={content} /> : null}
        </div>
      </div>
    </dialog>
  );
}

function SystemDesignReferenceMarkdown({ content }: Readonly<{ content: string }>) {
  return (
    <div className="markdown-content system-design-reference-markdown">
      <ReactMarkdown
        components={{
          code: MarkdownCode,
          h2: SystemDesignConceptHeading,
          h3: SystemDesignDetailHeading,
          li: SystemDesignReferenceListItem,
          pre: MarkdownPre
        }}
        rehypePlugins={[rehypeHighlight]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SystemDesignConceptHeading({ children, ...props }: ComponentProps<"h2">) {
  return <h2 className="system-design-reference-concept" {...props}>{children}</h2>;
}

function SystemDesignDetailHeading({ children, ...props }: ComponentProps<"h3">) {
  const text = reactNodeText(children);
  const tone = text.startsWith("✅") ? "positive" : text.startsWith("⚠") ? "negative" : "neutral";
  return <h3 className={`system-design-reference-${tone}`} {...props}>{children}</h3>;
}

function SystemDesignReferenceListItem({ children, ...props }: ComponentProps<"li">) {
  const text = reactNodeText(children).trim();
  const tone = text.startsWith("✅") ? "positive" : text.startsWith("⚠") ? "negative" : "neutral";
  return <li className={`system-design-reference-${tone}`} {...props}>{children}</li>;
}

function reactNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return reactNodeText(node.props.children);
  return "";
}

function PracticeStepCards({ steps }: Readonly<{ steps: PracticeStep[] }>) {
  return (
    <section className="practice-steps" aria-label="Development steps with matching tests">
      <h3>Etapas com testes correspondentes</h3>
      {steps.map((step, index) => (
        <article className="practice-step" key={`${index}-${step.title}`}>
          <header>
            <span className="pill active">etapa {index + 1}</span>
            <h4>{step.title}</h4>
            <p>{step.objective}</p>
          </header>
          <div className="code-test-grid">
            <div>
              <h5>Código completo nesta etapa</h5>
              <figure className="code-block">
                <pre><code>{step.completeCode}</code></pre>
              </figure>
            </div>
            <div>
              <h5>Teste desta etapa</h5>
              <figure className="code-block">
                <pre><code>{step.testCode}</code></pre>
              </figure>
              <p><strong>Resultado esperado:</strong> {step.expectedResult}</p>
            </div>
          </div>
          <p>{step.explanation}</p>
          <blockquote>
            <strong>Fala para entrevista:</strong> {step.interviewerSpeech}
          </blockquote>
        </article>
      ))}
    </section>
  );
}

function MarkdownContent({ content }: Readonly<{ content: string }>) {
  return (
    <div className="markdown-content">
      <ReactMarkdown components={{ code: MarkdownCode, pre: MarkdownPre }} rehypePlugins={[rehypeHighlight]} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SystemDesignExplanationContent({ content }: Readonly<{ content: string }>) {
  const paired = extractSystemDesignDiagramLegend(content);
  if (!paired) return <MarkdownContent content={content} />;

  return (
    <div className="system-design-explanation">
      {paired.before ? <MarkdownContent content={paired.before} /> : null}
      <SystemDesignDiagramWithLegend chart={paired.chart} legend={paired.legend} legendTitle={paired.legendTitle} />
      {paired.after ? <SystemDesignExplanationContent content={paired.after} /> : null}
    </div>
  );
}

function SystemDesignDiagramWithLegend({ chart, legend, legendTitle }: Readonly<{ chart: string; legend: string; legendTitle: string }>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section aria-label="Diagrama da arquitetura e sua legenda" className="system-design-diagram-legend-grid">
        <div className="system-design-diagram-column">
          <span className="pill active">diagrama da solução</span>
          <MermaidDiagram chart={chart} onExpand={() => setIsOpen(true)} />
        </div>
        <aside aria-label={legendTitle} className="system-design-legend-column">
          <span className="pill">leitura do diagrama</span>
          <h3>{legendTitle}</h3>
          <MarkdownContent content={legend} />
        </aside>
      </section>
      {isOpen ? (
        <SystemDesignDiagramDialog
          chart={chart}
          legend={legend}
          legendTitle={legendTitle}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

function SystemDesignDiagramDialog({ chart, legend, legendTitle, onClose }: Readonly<{
  chart: string;
  legend: string;
  legendTitle: string;
  onClose(): void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const closeDialog = () => dialogRef.current?.close();

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="system-design-diagram-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="system-design-diagram-dialog-surface">
        <header className="system-design-reference-header">
          <div>
            <span className="pill active">visualização ampliada</span>
            <h2 id={titleId}>Diagrama completo da arquitetura</h2>
            <p id={descriptionId}>Explore o diagrama em tamanho maior e consulte a legenda completa logo abaixo.</p>
          </div>
          <button autoFocus aria-label="Fechar diagrama ampliado" className="icon-button small" onClick={closeDialog} title="Fechar diagrama ampliado" type="button">
            ×
          </button>
        </header>
        <div className="system-design-diagram-dialog-body">
          <div className="system-design-diagram-dialog-canvas">
            <MermaidDiagram chart={chart} />
          </div>
          <section aria-label={legendTitle} className="system-design-diagram-dialog-legend">
            <span className="pill">leitura do diagrama</span>
            <h3>{legendTitle}</h3>
            <MarkdownContent content={legend} />
          </section>
        </div>
      </div>
    </dialog>
  );
}

interface SystemDesignDiagramLegend {
  after: string;
  before: string;
  chart: string;
  legend: string;
  legendTitle: string;
}

function extractSystemDesignDiagramLegend(content: string): SystemDesignDiagramLegend | undefined {
  const match = systemDesignDiagramLegendPattern.exec(content);
  if (!match || !match[1]?.trim() || !match[2]?.trim() || !match[3]?.trim()) return undefined;
  return {
    after: content.slice((match.index ?? 0) + match[0].length).trim(),
    before: content.slice(0, match.index ?? 0).trim(),
    chart: match[1].trim(),
    legend: match[3].trim(),
    legendTitle: match[2].trim()
  };
}

function MarkdownPre({ children }: ComponentProps<"pre">) {
  const codeChild = Array.isArray(children) ? children[0] : children;
  const codeProps = typeof codeChild === "object" && codeChild && "props" in codeChild
    ? codeChild.props as { children?: ReactNode; className?: string }
    : undefined;
  const className = codeProps
    ? codeProps.className
    : undefined;
  const language = /language-([\w#+.-]+)/.exec(className ?? "")?.[1];
  if (language === "mermaid") {
    return <MermaidDiagram chart={String(codeProps?.children ?? "").trim()} />;
  }
  return (
    <figure className="code-block">
      {language ? <figcaption>{language}</figcaption> : null}
      <pre>{children}</pre>
    </figure>
  );
}

function MermaidDiagram({ chart, onExpand }: Readonly<{ chart: string; onExpand?: () => void }>) {
  const reactId = useId();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral"
        });
        const diagramId = `mermaid-${reactId.replaceAll(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;
        const { svg } = await mermaid.render(diagramId, chart);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        setImageUrl(objectUrl);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void render();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [chart, reactId]);

  if (imageUrl) {
    return (
      <figure className="mermaid-diagram">
        {onExpand ? (
          <button
            aria-haspopup="dialog"
            aria-label="Ampliar diagrama da arquitetura"
            className="mermaid-diagram-expand"
            onClick={onExpand}
            title="Abrir diagrama em tela ampliada"
            type="button"
          >
            <img alt="System Design architecture diagram" src={imageUrl} />
            <span aria-hidden="true" className="mermaid-diagram-expand-label">⛶ Ampliar</span>
          </button>
        ) : <img alt="System Design architecture diagram" src={imageUrl} />}
      </figure>
    );
  }
  return (
    <figure className="code-block mermaid-fallback">
      <figcaption>{error ? "mermaid source — diagram could not be rendered" : "rendering mermaid diagram"}</figcaption>
      <pre><code>{chart}</code></pre>
    </figure>
  );
}

function MarkdownCode({ children, className, ...props }: ComponentProps<"code">) {
  const hasLanguage = /language-[\w#+.-]+/.test(className ?? "");
  return <code className={hasLanguage ? className : className ? `${className} inline-code` : "inline-code"} {...props}>{children}</code>;
}

function SessionMeta({ className, deleteState, focusControl, history, providerError }: Readonly<PanelFrameProps & { deleteState: "idle" | "confirming" | "deleting" | "deleted" | "failed"; history: SessionHistoryResponse; providerError?: string }>) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <div className="panel-heading"><h2>State</h2>{focusControl}</div>
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
    const screenPrefix = event.payload.debugId ? `[screen:${event.payload.debugId}] ` : "";
    console.info(
      `[Persuando Response] ${screenPrefix}copilot.context event received: sessionId=${event.sessionId} contextId=${event.payload.contextId} hasImage=${Boolean(event.payload.imageReference)} imageLength=${event.payload.imageReference?.length ?? 0} textLength=${event.payload.textContext?.length ?? 0} transportLatencyMs=${Math.max(0, Date.now() - Date.parse(event.sentAt))}.`
    );
    if (event.payload.imageReference) {
      const screenContext = toScreenContext(event);
      setters.setScreenContexts((items) => {
        const next = items.some((existing) => existing.id === screenContext.id)
          ? items.map((existing) => (existing.id === screenContext.id ? screenContext : existing))
          : [...items, screenContext];
        const limited = next.slice(-MAX_SCREEN_CONTEXTS);
        console.info(
          `[Persuando Response] ${screenPrefix}screen context count after apply: sessionId=${event.sessionId} count=${limited.length} hasImage=${Boolean(screenContext.imageReference)} imageLength=${screenContext.imageReference?.length ?? 0}.`
        );
        return limited;
      });
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
  if (event.type === "copilot.context") return true;
  if (event.type === "summary.updated") return panelModes.summary === "automatic" || consumePendingMode(pendingManualModes, "summary");
  if (event.type === "insight.created") return panelModes.insights === "automatic" || consumePendingMode(pendingManualModes, "insights");
  if (event.type === "suggestion.created") {
    return panelModes.answers === "automatic" || panelModes.followups === "automatic" || consumePendingMode(pendingManualModes, "followups");
  }
  if (event.type === "copilot.explanation") {
    const mode = event.payload.assistantMode ?? "code_practice";
    const panelMode = mode === "system_design" ? panelModes.systemDesign : panelModes.code;
    return panelMode === "automatic" || consumePendingMode(pendingManualModes, mode);
  }
  if (event.type === "generation.completed") {
    const panelMode = event.payload.mode === "system_design" ? panelModes.systemDesign : panelModes.code;
    return panelMode === "automatic" || consumePendingMode(pendingManualModes, event.payload.mode);
  }
  return true;
}

function generatedModeForEvent(event: PersuandoWebSocketEvent): GenerateMode | undefined {
  if (event.type === "summary.updated") return "summary";
  if (event.type === "insight.created") return "insights";
  if (event.type === "suggestion.created") return "followups";
  if (event.type === "copilot.explanation") return event.payload.assistantMode ?? "code_practice";
  if (event.type === "generation.completed") return event.payload.mode;
  return undefined;
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
  assistantMode?: VisualGenerationMode;
  codePracticeWorkflow?: CodePracticeWorkflow;
  kind: CopilotExplanationEvent["payload"]["kind"];
  content: string;
  practiceSteps?: PracticeStep[];
}

interface ScreenContext {
  debugId?: string;
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
    debugId: event.payload.debugId,
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
    assistantMode: event.payload.assistantMode,
    codePracticeWorkflow: event.payload.codePracticeWorkflow,
    content: event.payload.content,
    practiceSteps: event.payload.practiceSteps
  };
}

function toCopilotExplanationFromHistory(
  guidance: NonNullable<SessionHistoryResponse["generatedGuidance"]>[number]
): CopilotExplanation {
  return {
    id: guidance.id,
    contextId: guidance.id,
    kind: "explanation",
    assistantMode: guidance.assistantMode,
    codePracticeWorkflow: guidance.codePracticeWorkflow,
    content: guidance.content,
    practiceSteps: guidance.practiceSteps
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

function realtimeUrl(realtimeEndpoint: string, clientType: "response"): string {
  const base = realtimeEndpoint;
  const url = new URL(base);
  url.searchParams.set("clientType", clientType);
  return url.toString();
}

function safeRealtimeEndpoint(realtimeEndpoint: string): string {
  try {
    const url = new URL(realtimeEndpoint);
    url.search = "";
    return url.toString();
  } catch {
    return "the configured realtime endpoint";
  }
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

function panelClassName(panel: FocusPanelKey, highlightedPanel: FocusPanelKey | undefined): string {
  if (!highlightedPanel) return "";
  return panel === highlightedPanel ? "highlighted-panel" : "compact-panel";
}

function codePracticeStatus(screenContextCount: number, isGenerating: boolean, mode: PanelMode): string {
  if (isGenerating) return "analyzing";
  if (screenContextCount === 0) return "waiting for screenshots";
  if (mode === "automatic") return "updated context";
  return "ready";
}

function loadCodePracticeWorkflow(sessionId: string): CodePracticeWorkflow {
  if (typeof window === "undefined") return "exercise";
  const stored = window.localStorage.getItem(codePracticeWorkflowStorageKey(sessionId));
  return stored === "repository" ? stored : "exercise";
}

function saveCodePracticeWorkflow(sessionId: string, workflow: CodePracticeWorkflow): void {
  window.localStorage.setItem(codePracticeWorkflowStorageKey(sessionId), workflow);
}

function codePracticeWorkflowStorageKey(sessionId: string): string {
  return `persuando:${sessionId}:code-practice-workflow`;
}

function loadInterviewResponseLanguage(
  sessionId: string,
  fallback: InterviewResponseLanguage
): InterviewResponseLanguage {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(interviewResponseLanguageStorageKey(sessionId));
  return stored === "pt-BR" || stored === "en-US" ? stored : fallback;
}

function saveInterviewResponseLanguage(sessionId: string, language: InterviewResponseLanguage): void {
  window.localStorage.setItem(interviewResponseLanguageStorageKey(sessionId), language);
}

function interviewResponseLanguageStorageKey(sessionId: string): string {
  return `persuando:${sessionId}:interview-response-language:v1`;
}

function defaultLayoutOrder(assistantMode: AssistantMode): SessionLayoutCardKey[] {
  const shared: SessionLayoutCardKey[] = [
    "transcript",
    "summary",
    "answers",
    "topics",
    "insights",
    "followups",
    "screen"
  ];
  if (assistantMode === "code_practice") return [...shared, "code", "systemDesign", "state"];
  if (assistantMode === "exam_study") return [...shared, "code", "state"];
  return [...shared, "state"];
}

function normalizeLayoutOrder(
  order: readonly SessionLayoutCardKey[],
  assistantMode: AssistantMode
): SessionLayoutCardKey[] {
  const defaults = defaultLayoutOrder(assistantMode);
  const allowed = new Set(defaults);
  const seen = new Set<SessionLayoutCardKey>();
  const normalized = order.filter((card) => {
    if (!allowed.has(card) || seen.has(card)) return false;
    seen.add(card);
    return true;
  });
  return [...normalized, ...defaults.filter((card) => !seen.has(card))];
}

function loadLayoutOrder(assistantMode: AssistantMode): SessionLayoutCardKey[] {
  const fallback = defaultLayoutOrder(assistantMode);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(layoutOrderStorageKey(assistantMode)) ?? "[]") as unknown;
    return Array.isArray(stored)
      ? normalizeLayoutOrder(stored.filter(isSessionLayoutCardKey), assistantMode)
      : fallback;
  } catch {
    return fallback;
  }
}

function saveLayoutOrder(assistantMode: AssistantMode, order: readonly SessionLayoutCardKey[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    layoutOrderStorageKey(assistantMode),
    JSON.stringify(normalizeLayoutOrder(order, assistantMode))
  );
}

function layoutOrderStorageKey(assistantMode: AssistantMode): string {
  return `persuando:response-layout:${assistantMode}:v1`;
}

function isSessionLayoutCardKey(value: unknown): value is SessionLayoutCardKey {
  return typeof value === "string" && Object.hasOwn(layoutCardLabels, value);
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
