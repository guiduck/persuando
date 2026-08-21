import type {
  CaptureAudioChunkEvent,
  CaptureStatusEvent,
  CopilotContextEvent,
  Session,
  SessionId,
  UserSettings
} from "@persuando/contracts";

import { captureWebSocketUrl, createSession } from "./api.js";

const AUDIO_CHUNK_DURATION_MS = 6000;
const DEFAULT_COPILOT_PROGRAMMING_LANGUAGE = "javascript";

export interface ActiveCapture {
  pause(): void;
  resume(): void;
  sendContext(input: { explanationMode: "hint" | "explain" | "review"; imageReference?: string; textContext?: string }): void;
  session: Session;
  stop(): void;
}

export interface CaptureSessionCallbacks {
  onAudioLevel?(level: number): void;
  onError(message: string): void;
  onStatus(status: "active" | "reconnecting" | "error"): void;
}

export async function startMicrophoneCapture(
  settings: UserSettings,
  deviceId: string | undefined,
  callbacks: CaptureSessionCallbacks
): Promise<ActiveCapture> {
  console.info(`[Persuando Capture] Creating capture session: microphoneDefault=${settings.microphoneCaptureDefault} periodicScreenDefault=${settings.periodicScreenshotCaptureDefault} transcriptionModel=${settings.transcriptionModel} analysisModel=${settings.analysisModel} programmingLanguage=${normalizeProgrammingLanguage(settings.preferredProgrammingLanguage)}.`);
  const { session } = await createSession(settings);
  console.info(`[Persuando Capture] Capture session created: sessionId=${session.id} status=${session.status}.`);
  console.info(`[Persuando Capture] Requesting microphone stream: device=${deviceId ? "selected" : "default"}.`);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false
  });
  console.info(`[Persuando Capture] Microphone stream granted: audioTracks=${stream.getAudioTracks().length}.`);
  const socket = await connectCaptureSocket();
  console.info(`[Persuando Capture] Capture WebSocket connected: sessionId=${session.id}.`);
  const audioMeter = createAudioMeter(stream, callbacks.onAudioLevel);
  let chunkSequence = 0;
  let chunkTimer: number | undefined;
  let recorder: MediaRecorder | undefined;
  let captureState: "recording" | "paused" | "stopped" = "recording";
  let stoppedByUser = false;

  const clearChunkTimer = () => {
    if (chunkTimer) window.clearTimeout(chunkTimer);
    chunkTimer = undefined;
  };

  const stopCurrentRecorder = () => {
    clearChunkTimer();
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startNextRecorder = () => {
    if (captureState !== "recording" || socket.readyState !== WebSocket.OPEN) return;
    const chunks: Blob[] = [];
    const nextRecorder = new MediaRecorder(stream, { mimeType: preferredMimeType() });
    recorder = nextRecorder;

    nextRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    nextRecorder.addEventListener("stop", () => {
      const chunk = new Blob(chunks, { type: nextRecorder.mimeType || "audio/webm" });
      if (chunk.size > 0 && socket.readyState === WebSocket.OPEN) {
        console.info(`[Persuando Capture] Audio chunk ready: sessionId=${session.id} nextSequence=${chunkSequence + 1} byteLength=${chunk.size}.`);
        void sendAudioChunk(socket, session.id, chunk, ++chunkSequence, AUDIO_CHUNK_DURATION_MS);
      } else if (chunk.size > 0) {
        console.warn(`[Persuando Capture] Audio chunk skipped: socketState=${socket.readyState} byteLength=${chunk.size}.`);
      }
      if (captureState === "recording") startNextRecorder();
    });

    nextRecorder.start();
    chunkTimer = window.setTimeout(() => {
      if (nextRecorder.state !== "inactive") nextRecorder.stop();
    }, AUDIO_CHUNK_DURATION_MS);
  };

  sendCaptureStatus(socket, session.id, "active");
  callbacks.onStatus("active");
  startNextRecorder();

  socket.addEventListener("message", (message) => {
    const parsed = safeParseWireMessage(message.data);
    if (parsed?.type === "realtime.error") {
      stoppedByUser = true;
      captureState = "stopped";
      const safeMessage = parsed.safeMessage ?? "Provider or realtime error.";
      console.warn(`[Persuando Capture] Realtime error received: sessionId=${session.id} safeMessage=${safeMessage}.`);
      stopCurrentRecorder();
      for (const track of stream.getTracks()) track.stop();
      audioMeter.stop();
      socket.close();
      callbacks.onStatus("error");
      callbacks.onError(safeMessage);
    }
  });
  socket.addEventListener("close", () => {
    console.warn(`[Persuando Capture] Capture WebSocket closed: sessionId=${session.id} stoppedByUser=${stoppedByUser}.`);
    if (!stoppedByUser) callbacks.onStatus("reconnecting");
  });

  return {
    pause() {
      if (captureState === "recording") {
        captureState = "paused";
        stopCurrentRecorder();
        sendCaptureStatus(socket, session.id, "paused");
      }
    },
    resume() {
      if (captureState === "paused") {
        captureState = "recording";
        sendCaptureStatus(socket, session.id, "resumed");
        startNextRecorder();
      }
    },
    sendContext(input) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error("Capture WebSocket is not connected");
      const programmingLanguage = normalizeProgrammingLanguage(settings.preferredProgrammingLanguage);
      const contextEvent: CopilotContextEvent = {
        version: 1,
        type: "copilot.context",
        sessionId: session.id,
        sentAt: new Date().toISOString(),
        payload: {
          contextId: crypto.randomUUID(),
          explanationMode: input.explanationMode,
          imageReference: input.imageReference,
          programmingLanguage,
          textContext: input.textContext
        }
      };
      console.info(
        `[Persuando Capture] Sending copilot.context: sessionId=${session.id} contextId=${contextEvent.payload.contextId} hasImage=${Boolean(
          input.imageReference
        )} textLength=${input.textContext?.length ?? 0} programmingLanguage=${programmingLanguage}.`
      );
      socket.send(JSON.stringify(contextEvent));
      console.info(`[Persuando Capture] copilot.context sent: sessionId=${session.id} contextId=${contextEvent.payload.contextId} socketState=${socket.readyState}.`);
    },
    session,
    stop() {
      stoppedByUser = true;
      captureState = "stopped";
      sendCaptureStatus(socket, session.id, "ended");
      stopCurrentRecorder();
      for (const track of stream.getTracks()) track.stop();
      audioMeter.stop();
      socket.close();
    }
  };
}

function normalizeProgrammingLanguage(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_COPILOT_PROGRAMMING_LANGUAGE;
  return trimmed.slice(0, 64);
}

async function sendAudioChunk(socket: WebSocket, sessionId: string, chunk: Blob, chunkSequence: number, durationMs: number): Promise<void> {
  if (socket.readyState !== WebSocket.OPEN) return;
  const bytes = new Uint8Array(await chunk.arrayBuffer());
  const payload: CaptureAudioChunkEvent = {
    version: 1,
    type: "capture.audio_chunk",
    sessionId: sessionId as SessionId,
    sentAt: new Date().toISOString(),
    payload: {
      audioBase64: bytesToBase64(bytes),
      byteLength: bytes.byteLength,
      chunkSequence,
      clientTimestamp: new Date().toISOString(),
      codec: "webm-opus",
      durationMs
    }
  };
  socket.send(JSON.stringify(payload));
  console.info(`[Persuando Capture] Audio chunk sent: sessionId=${sessionId} chunkSequence=${chunkSequence} byteLength=${bytes.byteLength} socketState=${socket.readyState}.`);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function sendCaptureStatus(socket: WebSocket, sessionId: string, status: CaptureStatusEvent["payload"]["status"]): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  const event: CaptureStatusEvent = {
    version: 1,
    type: "capture.status",
    sessionId: sessionId as SessionId,
    sentAt: new Date().toISOString(),
    payload: { status }
  };
  socket.send(JSON.stringify(event));
  console.info(`[Persuando Capture] Capture status sent: sessionId=${sessionId} status=${status} socketState=${socket.readyState}.`);
}

interface RealtimeWireMessage {
  type: "realtime.connected" | "realtime.result" | "realtime.event" | "realtime.error";
  safeMessage?: string;
}

function preferredMimeType(): string | undefined {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return undefined;
}

function connectCaptureSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const url = captureWebSocketUrl();
    console.info(`[Persuando Capture] Opening Capture WebSocket: ${redactUserIdFromUrl(url)}.`);
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => {
      console.error("[Persuando Capture] Capture WebSocket connection failed.");
      reject(new Error("Capture WebSocket connection failed"));
    }, { once: true });
  });
}

function redactUserIdFromUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.searchParams.has("userId")) url.searchParams.set("userId", "[redacted]");
    return url.toString();
  } catch {
    return value;
  }
}

function createAudioMeter(stream: MediaStream, onAudioLevel: CaptureSessionCallbacks["onAudioLevel"]): { stop(): void } {
  if (!onAudioLevel) return { stop() {} };
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return { stop() {} };

  const audioContext = new AudioContextCtor();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Uint8Array(analyser.frequencyBinCount);
  const interval = window.setInterval(() => {
    analyser.getByteFrequencyData(samples);
    const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    onAudioLevel(Math.min(1, average / 96));
  }, 120);

  return {
    stop() {
      window.clearInterval(interval);
      onAudioLevel(0);
      void audioContext.close();
    }
  };
}

function safeParseWireMessage(data: unknown): RealtimeWireMessage | undefined {
  if (typeof data !== "string") return undefined;
  try {
    return JSON.parse(data) as RealtimeWireMessage;
  } catch {
    return undefined;
  }
}
