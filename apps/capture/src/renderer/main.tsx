import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import type { ConsentGrant, ConsentType, ProviderCredentialMetadata, UserSettings } from "@persuando/contracts";

import {
  getCurrentUser,
  getSettings,
  googleLoginUrl,
  grantConsent,
  listConsentGrants,
  revokeConsent,
  saveProviderCredential,
  setCaptureAuthUser,
  settingsRequestFrom,
  updateSettings,
  validateProviderCredential
} from "./api.js";
import { startMicrophoneCapture, type ActiveCapture } from "./capture-session.js";
import "./styles.css";

const requiredCaptureConsents = [
  ["microphone_capture", "Microphone capture"],
  ["audio_transcription", "Audio transcription"],
  ["backend_transmission", "Backend transmission"],
  ["external_ai_provider_usage", "External AI provider usage"],
  ["session_retention", "7-day session retention"]
] as const satisfies readonly [ConsentType, string][];

const requiredContextConsents = [
  ["code_copilot", "Code practice context"],
  ["screen_coding_context_capture", "Periodic screen context"],
  ["backend_transmission", "Backend transmission"],
  ["external_ai_provider_usage", "External AI provider usage"]
] as const satisfies readonly [ConsentType, string][];

interface CaptureRuntimeState {
  activeSessionId?: string;
  endedAt?: string;
  error?: string;
  listening: boolean;
  paused: boolean;
  startedAt?: string;
  status: "idle" | "active" | "paused" | "revoked" | "error" | "ended" | "reconnecting";
  toolbarVisible: boolean;
}

const defaultState: CaptureRuntimeState = {
  listening: false,
  paused: false,
  status: "idle",
  toolbarVisible: true
};

const PERIODIC_SCREEN_CAPTURE_INTERVAL_MS = 5000;
const DEFAULT_COPILOT_PROGRAMMING_LANGUAGE = "javascript";

let activeCapture: ActiveCapture | undefined;
let periodicScreenCapture: { stop(): void } | undefined;

function normalizeProgrammingLanguageInput(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_COPILOT_PROGRAMMING_LANGUAGE;
  return trimmed.slice(0, 64);
}

function App() {
  const route = useRoute();
  const [runtimeState, setRuntimeState] = useState<CaptureRuntimeState>(defaultState);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [settings, setSettings] = useState<UserSettings | undefined>();
  const [providerCredential, setProviderCredential] = useState<ProviderCredentialMetadata | undefined>();
  const [captureError, setCaptureError] = useState<string | undefined>();
  const [consentGrants, setConsentGrants] = useState<ConsentGrant[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | undefined>();
  const [contextText, setContextText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    void window.persuandoCapture?.getState().then(setRuntimeState);
    return window.persuandoCapture?.onState(setRuntimeState);
  }, []);

  useEffect(() => {
    void initializeAuthAndBackendState(setUserEmail, setSettings, setProviderCredential, setConsentGrants).catch((error: unknown) => {
      setCaptureError(error instanceof Error ? error.message : "Could not load Capture backend state.");
    });
  }, []);

  useEffect(() => {
    void refreshMicrophones(setMicrophones, setSelectedMicrophoneId, setCaptureError);
  }, []);

  useEffect(() => {
    return window.persuandoCapture?.onCommand((command: string) => {
      void handleCaptureCommand(command, runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, contextText, consentGrants, setAudioLevel);
    });
  }, [consentGrants, contextText, runtimeState, selectedMicrophoneId, settings]);

  if (route === "toolbar") {
    return (
      <Toolbar
        captureError={captureError}
        audioLevel={audioLevel}
        runtimeState={runtimeState}
        selectedMicrophoneId={selectedMicrophoneId}
        contextText={contextText}
        setContextText={setContextText}
        setCaptureError={setCaptureError}
        setAudioLevel={setAudioLevel}
        setRuntimeState={setRuntimeState}
        settings={settings}
        consentGrants={consentGrants}
      />
    );
  }
  return (
    <Dashboard
      providerCredential={providerCredential}
      captureError={captureError}
      audioLevel={audioLevel}
      contextText={contextText}
      consentGrants={consentGrants}
      microphones={microphones}
      runtimeState={runtimeState}
      selectedMicrophoneId={selectedMicrophoneId}
      setContextText={setContextText}
      setCaptureError={setCaptureError}
      setAudioLevel={setAudioLevel}
      setProviderCredential={setProviderCredential}
      setConsentGrants={setConsentGrants}
      setRuntimeState={setRuntimeState}
      setSelectedMicrophoneId={setSelectedMicrophoneId}
      setMicrophones={setMicrophones}
      setSettings={setSettings}
      setUserEmail={setUserEmail}
      settings={settings}
      userEmail={userEmail}
    />
  );
}

function Dashboard({
  providerCredential,
  captureError,
  audioLevel,
  contextText,
  consentGrants,
  microphones,
  runtimeState,
  selectedMicrophoneId,
  setContextText,
  setCaptureError,
  setAudioLevel,
  setConsentGrants,
  setProviderCredential,
  setRuntimeState,
  setSelectedMicrophoneId,
  setMicrophones,
  setSettings,
  setUserEmail,
  settings,
  userEmail
}: Readonly<{
  providerCredential?: ProviderCredentialMetadata;
  captureError?: string;
  audioLevel: number;
  contextText: string;
  consentGrants: ConsentGrant[];
  microphones: MediaDeviceInfo[];
  runtimeState: CaptureRuntimeState;
  selectedMicrophoneId?: string;
  setContextText: (value: string) => void;
  setCaptureError: (error: string | undefined) => void;
  setAudioLevel: (level: number) => void;
  setConsentGrants: (grants: ConsentGrant[]) => void;
  setProviderCredential: (credential: ProviderCredentialMetadata | undefined) => void;
  setRuntimeState: (state: CaptureRuntimeState) => void;
  setSelectedMicrophoneId: (deviceId: string | undefined) => void;
  setMicrophones: (devices: MediaDeviceInfo[]) => void;
  setSettings: (settings: UserSettings | undefined) => void;
  setUserEmail: (email: string | undefined) => void;
  settings?: UserSettings;
  userEmail?: string;
}>) {
  const [apiKey, setApiKey] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  return (
    <main className="dashboard">
      <header className="appbar">
        <div>
          <strong>Persuando Capture</strong>
          <span>{userEmail ? `Signed in as ${userEmail}` : "Sign in inside Capture to create live sessions"}</span>
        </div>
        <div className="toolbar-actions">
          {!userEmail ? (
            <button
              onClick={() =>
                void loginWithGoogleFlow(setUserEmail, setSettings, setProviderCredential, setConsentGrants, setCaptureError)
              }
              type="button"
            >
              Sign in with Google
            </button>
          ) : null}
          <button onClick={() => void window.persuandoCapture?.showToolbar()} type="button">
            Show toolbar
          </button>
          <button className="primary" onClick={() => void toggleListening(runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, consentGrants, setAudioLevel)} type="button">
            {runtimeState.listening ? "End session" : "Start listening"}
          </button>
        </div>
      </header>
      {!userEmail ? (
        <div className="notice">
          Browser login and Capture login are separate during local development. Sign in here before starting microphone capture.
        </div>
      ) : null}
      {captureError ? <div className="notice danger">Capture error: {captureError}</div> : null}

      <section className="dashboard-grid">
        <section className="panel">
          <h1>Assistant</h1>
          <div className="assistant-card">
            <span className="assistant-icon">P</span>
            <div>
              <strong>Meeting and code practice</strong>
              <span>Transcript, explanations, suggested answers</span>
            </div>
          </div>
          <label className="context-field">
            Context prompt
            <textarea
              onChange={(event) => setContextText(event.currentTarget.value)}
              placeholder="Paste a question, code snippet, or meeting topic to explain."
              value={contextText}
            />
          </label>
          <div className="toolbar-actions inline">
            <button disabled={!runtimeState.listening} onClick={() => void sendPracticeContext(contextText, "explain", setCaptureError, consentGrants)} type="button">
              Ask
            </button>
            <button disabled={!runtimeState.listening} onClick={() => void sendPracticeContext(contextText, "review", setCaptureError, consentGrants)} type="button">
              Review
            </button>
            <button disabled={!runtimeState.listening} onClick={() => void captureScreenContext(setCaptureError, consentGrants)} type="button">
              Capture screen
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Audio device</h2>
          <label>
            Microphone
            <select onChange={(event) => setSelectedMicrophoneId(event.currentTarget.value || undefined)} value={selectedMicrophoneId ?? ""}>
              <option value="">Default microphone</option>
              {microphones.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void refreshMicrophones(setMicrophones, setSelectedMicrophoneId, setCaptureError)} type="button">
            Refresh devices
          </button>
          <div className="audio-meter" aria-label="Microphone input level">
            <span style={{ width: `${Math.round(audioLevel * 100)}%` }} />
          </div>
          <small className="meter-label">{runtimeState.listening ? "Live microphone input" : "Audio preview appears while listening"}</small>
        </section>

        <section className="panel">
          <h2>Provider</h2>
          <label>
            OpenAI-compatible API key
            <input onChange={(event) => setApiKey(event.currentTarget.value)} placeholder={providerCredential?.maskedDisplayValue ?? "sk-..."} type="password" value={apiKey} />
          </label>
          <div className="toolbar-actions inline">
            <button
              disabled={!apiKey || saveState === "saving"}
              onClick={() => void saveCredentialFlow(apiKey, settings, setProviderCredential, setSettings, setSaveState, setApiKey)}
              type="button"
            >
              {saveState === "saving" ? "Saving" : "Save key"}
            </button>
            <span className={providerCredential?.validationStatus === "valid" ? "status active" : "status"}>
              {providerCredential?.validationStatus ?? saveState}
            </span>
          </div>
          <div className="split">
            <label>
              Transcription model
              <select
                disabled={!settings}
                onChange={(event) => void updateSettingsField(settings, setSettings, { transcriptionModel: event.currentTarget.value })}
                value={settings?.transcriptionModel ?? "gpt-4o-mini-transcribe"}
              >
                <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
                <option value="gpt-4o-transcribe">gpt-4o-transcribe</option>
                <option value="gpt-realtime-whisper">gpt-realtime-whisper</option>
              </select>
            </label>
            <label>
              Analysis model
              <select
                disabled={!settings}
                onChange={(event) => void updateSettingsField(settings, setSettings, { analysisModel: event.currentTarget.value })}
                value={settings?.analysisModel ?? "gpt-4o-mini"}
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </label>
          </div>
          <div className="split">
            <label>
              Primary language
              <select
                disabled={!settings}
                onChange={(event) => void updateSettingsField(settings, setSettings, { primaryLanguage: event.currentTarget.value })}
                value={settings?.primaryLanguage ?? "en-US"}
              >
                <option value="en-US">English</option>
                <option value="pt-BR">Portuguese</option>
                <option value="es-ES">Spanish</option>
              </select>
            </label>
            <label>
              Response language
              <select
                disabled={!settings}
                onChange={(event) => void updateSettingsField(settings, setSettings, { responseLanguage: event.currentTarget.value })}
                value={settings?.responseLanguage ?? "en-US"}
              >
                <option value="en-US">English</option>
                <option value="pt-BR">Portuguese</option>
                <option value="es-ES">Spanish</option>
              </select>
            </label>
          </div>
          <div className="split">
            <label>
              Programming language
              <input
                disabled={!settings}
                onBlur={(event) =>
                  void updateSettingsField(settings, setSettings, {
                    preferredProgrammingLanguage: normalizeProgrammingLanguageInput(event.currentTarget.value)
                  })
                }
                placeholder={settings?.preferredProgrammingLanguage || DEFAULT_COPILOT_PROGRAMMING_LANGUAGE}
              />
            </label>
            <label>
              Session timer
              <input
                disabled={!settings}
                min="5"
                onBlur={(event) => void updateSettingsField(settings, setSettings, { sessionTimerMinutes: Number(event.currentTarget.value) || 30 })}
                placeholder={String(settings?.sessionTimerMinutes ?? 30)}
                type="number"
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Features</h2>
          <SettingsToggle
            checked={settings?.microphoneCaptureDefault ?? false}
            disabled={!settings}
            label="Microphone capture default"
            onChange={(value) => void updateSettingsField(settings, setSettings, { microphoneCaptureDefault: value })}
          />
          <SettingsToggle
            checked={settings?.periodicScreenshotCaptureDefault ?? false}
            disabled={!settings}
            label="Periodic screen context default"
            onChange={(value) =>
              void updatePeriodicScreenshotSetting(value, settings, setSettings, consentGrants, runtimeState, setCaptureError)
            }
          />
          <SettingsToggle
            checked={settings?.codePracticeContextDefault ?? false}
            disabled={!settings}
            label="Code practice default"
            onChange={(value) => void updateSettingsField(settings, setSettings, { codePracticeContextDefault: value })}
          />
          <SettingsToggle
            checked={settings?.autoScrollDefault ?? true}
            disabled={!settings}
            label="Auto-scroll default"
            onChange={(value) => void updateSettingsField(settings, setSettings, { autoScrollDefault: value })}
          />
        </section>

        <section className="panel">
          <h2>Consent</h2>
          <ConsentToggle consentGrants={consentGrants} consentType="microphone_capture" label="Microphone capture" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="audio_transcription" label="Audio transcription" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="backend_transmission" label="Backend transmission" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="external_ai_provider_usage" label="External AI provider usage" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="screen_coding_context_capture" label="Periodic screen context" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="code_copilot" label="Code practice context" setConsentGrants={setConsentGrants} />
          <ConsentToggle consentGrants={consentGrants} consentType="session_retention" label="7-day session retention" setConsentGrants={setConsentGrants} />
        </section>

        <section className="panel">
          <h2>Shortcuts</h2>
          <ShortcutRow action="Start or stop listening" keys="Ctrl + D" />
          <ShortcutRow action="Ask or submit prompt" keys="Ctrl + Enter" />
          <ShortcutRow action="Capture screen context" keys="Ctrl + E" />
          <ShortcutRow action="Pause or resume" keys="Ctrl + Shift + D" />
        </section>
      </section>
    </main>
  );
}

function Toolbar({
  audioLevel,
  captureError,
  consentGrants,
  contextText,
  runtimeState,
  selectedMicrophoneId,
  setContextText,
  setCaptureError,
  setAudioLevel,
  setRuntimeState,
  settings
}: Readonly<{
  audioLevel: number;
  captureError?: string;
  consentGrants: ConsentGrant[];
  contextText: string;
  runtimeState: CaptureRuntimeState;
  selectedMicrophoneId?: string;
  setContextText: (value: string) => void;
  setCaptureError: (error: string | undefined) => void;
  setAudioLevel: (level: number) => void;
  setRuntimeState: (state: CaptureRuntimeState) => void;
  settings?: UserSettings;
}>) {
  const status = useMemo(() => {
    if (!runtimeState.listening) return "Ready";
    if (runtimeState.paused) return "Paused";
    return "Listening";
  }, [runtimeState]);
  const elapsed = useElapsed(runtimeState.startedAt, runtimeState.listening);

  return (
    <main className="floating-shell">
      <section className="floating-toolbar">
        <button aria-label="Open dashboard" className="icon-button" onClick={() => void window.persuandoCapture?.showDashboard()} type="button">
          H
        </button>
        <button aria-label="Hide toolbar" className="icon-button" onClick={() => void window.persuandoCapture?.hideToolbar()} type="button">
          -
        </button>
        <button aria-label="Open assistant prompt" className="icon-button" disabled={!runtimeState.listening} onClick={() => void sendPracticeContext(contextText, "hint", setCaptureError, consentGrants)} type="button">
          A
        </button>
        <button aria-label="Capture screen context" className="icon-button" disabled={!runtimeState.listening} onClick={() => void captureScreenContext(setCaptureError, consentGrants)} type="button">
          S
        </button>
        <span className={runtimeState.listening ? "status active" : "status"}>{status}</span>
        {runtimeState.listening ? <span className="timer">{elapsed}</span> : null}
        <span className="mini-meter" aria-label="Microphone input level">
          <span style={{ width: `${Math.round(audioLevel * 100)}%` }} />
        </span>
        <input
          aria-label="Ask context"
          className="toolbar-input"
          disabled={!runtimeState.listening}
          onChange={(event) => setContextText(event.currentTarget.value)}
          placeholder="Ask"
          value={contextText}
        />
        {runtimeState.listening ? (
          <>
            <button onClick={() => void togglePaused(runtimeState, setRuntimeState)} type="button">
              {runtimeState.paused ? "Resume" : "Pause"}
            </button>
            <button className="danger" onClick={() => void toggleListening(runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, consentGrants, setAudioLevel)} type="button">
              End
            </button>
          </>
        ) : (
          <button className="primary" onClick={() => void toggleListening(runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, consentGrants, setAudioLevel)} type="button">
            Start listening
          </button>
        )}
        {captureError ? <span className="status error">Error</span> : null}
      </section>
    </main>
  );
}

function ConsentToggle({
  consentGrants,
  consentType,
  label,
  setConsentGrants
}: Readonly<{
  consentGrants: ConsentGrant[];
  consentType: ConsentType;
  label: string;
  setConsentGrants: (grants: ConsentGrant[]) => void;
}>) {
  const activeGrant = consentGrants.find((grant) => grant.consentType === consentType && grant.status === "granted");
  const checked = activeGrant !== undefined;
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => {
          if (event.currentTarget.checked) void grantConsentFlow(consentType, setState, setConsentGrants);
          if (!event.currentTarget.checked && activeGrant) void revokeConsentFlow(activeGrant.id, setState, setConsentGrants);
        }}
        type="checkbox"
      />
      <small>{state === "idle" ? "" : state}</small>
    </label>
  );
}

function ShortcutRow({ action, keys }: Readonly<{ action: string; keys: string }>) {
  return (
    <div className="shortcut-row">
      <span>{action}</span>
      <kbd>{keys}</kbd>
    </div>
  );
}

function SettingsToggle({
  checked,
  disabled,
  label,
  onChange
}: Readonly<{ checked: boolean; disabled: boolean; label: string; onChange: (value: boolean) => void }>) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} type="checkbox" />
    </label>
  );
}

async function toggleListening(
  runtimeState: CaptureRuntimeState,
  setRuntimeState: (state: CaptureRuntimeState) => void,
  settings: UserSettings | undefined,
  setCaptureError: (error: string | undefined) => void,
  selectedMicrophoneId: string | undefined,
  consentGrants: ConsentGrant[],
  setAudioLevel: (level: number) => void
): Promise<void> {
  try {
    setCaptureError(undefined);
    if (!runtimeState.listening) {
      const effectiveSettings = await getSettings()
        .then((response) => response.settings)
        .catch(() => settings);
      const effectiveConsentGrants = await listConsentGrants().catch(() => consentGrants);
      if (!effectiveSettings) {
        setCaptureError("Sign in and load settings before capture.");
        return;
      }
      console.info(
        `[Persuando Capture] Capture start settings: periodicScreenshotCaptureDefault=${effectiveSettings.periodicScreenshotCaptureDefault} screenConsent=${hasConsentGrant(effectiveConsentGrants, "screen_coding_context_capture")} codeConsent=${hasConsentGrant(effectiveConsentGrants, "code_copilot")} programmingLanguage=${normalizeProgrammingLanguageInput(effectiveSettings.preferredProgrammingLanguage)}.`
      );
      const missingConsent = missingConsentLabels(effectiveConsentGrants, requiredCaptureConsents);
      if (missingConsent.length > 0) {
        setCaptureError(`Enable consent before listening: ${missingConsent.join(", ")}.`);
        return;
      }
      activeCapture = await startMicrophoneCapture(effectiveSettings, selectedMicrophoneId, {
        onAudioLevel(level) {
          setAudioLevel(level);
        },
        onError(message) {
          setCaptureError(message);
          activeCapture = undefined;
          setAudioLevel(0);
          void window.persuandoCapture?.setStatus({ activeSessionId: undefined, error: message, listening: false, paused: false, status: "error" });
        },
        onStatus(status) {
          void window.persuandoCapture?.setStatus({ status });
        }
      });
      await window.persuandoCapture?.setStatus({ activeSessionId: activeCapture.session.id, status: "active" });
      periodicScreenCapture = await maybeStartPeriodicScreenCapture(effectiveSettings, effectiveConsentGrants, setCaptureError);
    } else {
      periodicScreenCapture?.stop();
      periodicScreenCapture = undefined;
      activeCapture?.stop();
      activeCapture = undefined;
      setAudioLevel(0);
      await window.persuandoCapture?.setStatus({ activeSessionId: undefined, status: "ended" });
    }
    const updated = await window.persuandoCapture?.setListening(!runtimeState.listening);
    if (updated) setRuntimeState(updated);
  } catch (error) {
    periodicScreenCapture?.stop();
    periodicScreenCapture = undefined;
    activeCapture?.stop();
    activeCapture = undefined;
    setAudioLevel(0);
    const message = error instanceof Error ? error.message : "Capture failed.";
    setCaptureError(message);
    await window.persuandoCapture?.setStatus({ error: message, listening: false, paused: false, status: "error" });
  }
}

async function togglePaused(runtimeState: CaptureRuntimeState, setRuntimeState: (state: CaptureRuntimeState) => void): Promise<void> {
  if (runtimeState.paused) activeCapture?.resume();
  if (!runtimeState.paused) activeCapture?.pause();
  const updated = await window.persuandoCapture?.setPaused(!runtimeState.paused);
  if (updated) setRuntimeState(updated);
}

async function handleCaptureCommand(
  command: string,
  runtimeState: CaptureRuntimeState,
  setRuntimeState: (state: CaptureRuntimeState) => void,
  settings: UserSettings | undefined,
  setCaptureError: (error: string | undefined) => void,
  selectedMicrophoneId: string | undefined,
  contextText: string,
  consentGrants: ConsentGrant[],
  setAudioLevel: (level: number) => void
): Promise<void> {
  if (command === "start-listening" && !runtimeState.listening) {
    await toggleListening(runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, consentGrants, setAudioLevel);
  }
  if (command === "end-session" && runtimeState.listening) {
    await toggleListening(runtimeState, setRuntimeState, settings, setCaptureError, selectedMicrophoneId, consentGrants, setAudioLevel);
  }
  if ((command === "pause-capture" || command === "resume-capture") && runtimeState.listening) {
    await togglePaused(runtimeState, setRuntimeState);
  }
  if (command === "capture-context") {
    await captureScreenContext(setCaptureError, consentGrants);
  }
  if (command === "start-periodic-screen-context") {
    console.info("[Persuando Capture] Command received: start-periodic-screen-context.");
    const latestSettings = await getSettings().then((response) => response.settings).catch(() => settings);
    if (!latestSettings) {
      setCaptureError("Sign in and load settings before periodic screen context.");
      return;
    }
    const latestConsentGrants = await listConsentGrants();
    console.info(`[Persuando Capture] Command start-periodic-screen-context state: activeCapture=${Boolean(activeCapture)} periodicScreenshotCaptureDefault=${latestSettings.periodicScreenshotCaptureDefault} screenConsent=${hasConsentGrant(latestConsentGrants, "screen_coding_context_capture")} codeConsent=${hasConsentGrant(latestConsentGrants, "code_copilot")}.`);
    periodicScreenCapture?.stop();
    periodicScreenCapture = await maybeStartPeriodicScreenCapture(latestSettings, latestConsentGrants, setCaptureError);
  }
  if (command === "stop-periodic-screen-context") {
    console.info("[Persuando Capture] Command received: stop-periodic-screen-context.");
    periodicScreenCapture?.stop();
    periodicScreenCapture = undefined;
    setCaptureError(undefined);
  }
  if (command === "revoke-capture") {
    periodicScreenCapture?.stop();
    periodicScreenCapture = undefined;
    activeCapture?.stop();
    activeCapture = undefined;
    setAudioLevel(0);
    const updated = await window.persuandoCapture?.setStatus({
      activeSessionId: undefined,
      listening: false,
      paused: false,
      status: "revoked"
    });
    if (updated) setRuntimeState(updated);
  }
  if (command === "ask") {
    await sendPracticeContext(contextText, "hint", setCaptureError, consentGrants);
  }
}

async function sendPracticeContext(
  contextText: string,
  explanationMode: "hint" | "explain" | "review",
  setCaptureError: (error: string | undefined) => void,
  consentGrants: ConsentGrant[]
): Promise<void> {
  try {
    if (!activeCapture) throw new Error("Start listening before sending context.");
    const missingConsent = missingConsentLabels(consentGrants, requiredContextConsents);
    if (missingConsent.length > 0) throw new Error(`Enable consent before context: ${missingConsent.join(", ")}.`);
    activeCapture.sendContext({
      explanationMode,
      textContext: contextText || "User requested practice guidance for the current session."
    });
  } catch (error) {
    setCaptureError(error instanceof Error ? error.message : "Could not send context.");
  }
}

async function maybeStartPeriodicScreenCapture(
  settings: UserSettings,
  consentGrants: ConsentGrant[],
  setCaptureError: (error: string | undefined) => void
): Promise<{ stop(): void } | undefined> {
  console.info(`[Persuando Capture] Periodic screen context evaluating: activeCapture=${Boolean(activeCapture)} setting=${settings.periodicScreenshotCaptureDefault} screenConsent=${hasConsentGrant(consentGrants, "screen_coding_context_capture")} codeConsent=${hasConsentGrant(consentGrants, "code_copilot")} grantCount=${consentGrants.length}.`);
  if (!settings.periodicScreenshotCaptureDefault) {
    console.info(
      "[Persuando Capture] Periodic screen context not started: setting disabled. Enable Periodic screen context default in Capture App > Features."
    );
    return undefined;
  }
  const missingConsent = missingConsentLabels(consentGrants, requiredContextConsents);
  if (missingConsent.length > 0) {
    setCaptureError(`Enable consent before periodic screen context: ${missingConsent.join(", ")}.`);
    return undefined;
  }
  try {
    console.info("[Persuando Capture] Periodic screen context started.");
    let stopped = false;
    const capture = async () => {
      if (stopped) return;
      if (!activeCapture) {
        console.warn("[Persuando Capture] Periodic screen context skipped: no active capture in this renderer.");
        return;
      }
      console.info("[Persuando Capture] Periodic screen context capture tick.");
      console.info("[Persuando Capture] Periodic screen context requesting image from capture bridge.");
      const image = await captureScreenImageFallback();
      console.info(`[Persuando Capture] Periodic screen context image captured: source=${image.sourceLabel} dataUrlLength=${image.dataUrl.length}.`);
      activeCapture.sendContext({
        explanationMode: "explain",
        imageReference: image.dataUrl,
        textContext: `Periodic screen context captured during the active session from ${image.sourceLabel}.`
      });
      console.info("[Persuando Capture] Periodic screen context sent to realtime.");
      setCaptureError(undefined);
    };
    const runCapture = async () => {
      try {
        await capture();
      } catch (error) {
        if (!stopped) {
          const message = error instanceof Error ? error.message : "Could not capture periodic screen context.";
          console.error(`[Persuando Capture] Periodic screen context failed: ${message}`);
          setCaptureError(message);
        }
      }
    };
    void runCapture();
    const interval = window.setInterval(() => void runCapture(), PERIODIC_SCREEN_CAPTURE_INTERVAL_MS);
    return {
      stop() {
        stopped = true;
        window.clearInterval(interval);
        console.info("[Persuando Capture] Periodic screen context stopped.");
      }
    };
  } catch (error) {
    setCaptureError(error instanceof Error ? error.message : "Could not start periodic screen context.");
    return undefined;
  }
}

async function captureScreenContext(setCaptureError: (error: string | undefined) => void, consentGrants: ConsentGrant[]): Promise<void> {
  try {
    console.info(`[Persuando Capture] Manual screen context requested: activeCapture=${Boolean(activeCapture)} screenConsent=${hasConsentGrant(consentGrants, "screen_coding_context_capture")} codeConsent=${hasConsentGrant(consentGrants, "code_copilot")}.`);
    if (!activeCapture) throw new Error("Start listening before screen context capture.");
    const missingConsent = missingConsentLabels(consentGrants, requiredContextConsents);
    if (missingConsent.length > 0) throw new Error(`Enable consent before screen context: ${missingConsent.join(", ")}.`);
    const image = await captureScreenImageFallback();
    activeCapture.sendContext({
      explanationMode: "explain",
      imageReference: image.dataUrl,
      textContext: `Visible user-requested screen context capture from ${image.sourceLabel}.`
    });
    setCaptureError(undefined);
  } catch (error) {
    setCaptureError(error instanceof Error ? error.message : "Could not capture screen context.");
  }
}

async function captureScreenImageFallback(existingStream?: MediaStream): Promise<{ dataUrl: string; sourceLabel: string }> {
  console.info(`[Persuando Capture] captureScreenImageFallback called: electronBridge=${Boolean(window.persuandoCapture?.captureScreenImage)} existingStream=${Boolean(existingStream)}.`);
  const electronCapture = await window.persuandoCapture?.captureScreenImage();
  if (electronCapture) {
    console.info(`[Persuando Capture] Electron screen bridge returned image: source=${electronCapture.sourceLabel} dataUrlLength=${electronCapture.dataUrl.length}.`);
    return electronCapture;
  }

  console.warn("[Persuando Capture] Electron screen bridge unavailable; falling back to getDisplayMedia.");
  const stream = existingStream ?? (await navigator.mediaDevices.getDisplayMedia({ audio: false, video: true }));
  try {
    const canvas = await captureStreamFrame(stream);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.55), sourceLabel: "selected screen" };
  } finally {
    if (!existingStream) for (const streamTrack of stream.getTracks()) streamTrack.stop();
  }
}

async function captureStreamFrame(stream: MediaStream): Promise<HTMLCanvasElement> {
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("No screen source selected.");
  const canvas = document.createElement("canvas");

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return canvas;
}

function useElapsed(startedAt: string | undefined, listening: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!listening) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [listening]);
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function missingConsentLabels(
  consentGrants: readonly ConsentGrant[],
  requiredConsents: readonly (readonly [ConsentType, string])[]
): string[] {
  return requiredConsents
    .filter(([consentType]) => !hasConsentGrant(consentGrants, consentType))
    .map(([, label]) => label);
}

function hasConsentGrant(consentGrants: readonly ConsentGrant[], consentType: ConsentType): boolean {
  return consentGrants.some((grant) => grant.consentType === consentType && grant.status === "granted");
}

function useRoute(): "dashboard" | "toolbar" {
  const value = window.location.hash.replace("#/", "") || window.location.pathname.replace("/", "");
  return value === "toolbar" ? "toolbar" : "dashboard";
}

async function refreshBackendState(
  setUserEmail: (email: string | undefined) => void,
  setSettings: (settings: UserSettings | undefined) => void,
  setProviderCredential: (credential: ProviderCredentialMetadata | undefined) => void,
  setConsentGrants: (grants: ConsentGrant[]) => void
): Promise<void> {
  const user = await getCurrentUser();
  setUserEmail(user.user?.email);
  if (!user.authenticated) return;
  const response = await getSettings();
  setSettings(response.settings);
  setProviderCredential(response.providerCredential);
  setConsentGrants(await listConsentGrants());
}

async function initializeAuthAndBackendState(
  setUserEmail: (email: string | undefined) => void,
  setSettings: (settings: UserSettings | undefined) => void,
  setProviderCredential: (credential: ProviderCredentialMetadata | undefined) => void,
  setConsentGrants: (grants: ConsentGrant[]) => void
): Promise<void> {
  const bridgeUser = await window.persuandoCapture?.getAuthUser();
  setCaptureAuthUser(bridgeUser);
  await refreshBackendState(setUserEmail, setSettings, setProviderCredential, setConsentGrants);
}

async function loginWithGoogleFlow(
  setUserEmail: (email: string | undefined) => void,
  setSettings: (settings: UserSettings | undefined) => void,
  setProviderCredential: (credential: ProviderCredentialMetadata | undefined) => void,
  setConsentGrants: (grants: ConsentGrant[]) => void,
  setCaptureError: (error: string | undefined) => void
): Promise<void> {
  try {
    setCaptureError(undefined);
    if (!window.persuandoCapture) {
      throw new Error("Electron bridge is unavailable. Restart Capture App after rebuilding.");
    }
    const user = await window.persuandoCapture?.loginWithGoogle(googleLoginUrl());
    setCaptureAuthUser(user);
    await refreshBackendState(setUserEmail, setSettings, setProviderCredential, setConsentGrants);
  } catch (error) {
    setCaptureError(error instanceof Error ? error.message : "Google sign in failed.");
  }
}

async function saveCredentialFlow(
  apiKey: string,
  settings: UserSettings | undefined,
  setProviderCredential: (credential: ProviderCredentialMetadata | undefined) => void,
  setSettings: (settings: UserSettings | undefined) => void,
  setSaveState: (state: "idle" | "saving" | "saved" | "failed") => void,
  setApiKey: (value: string) => void
): Promise<void> {
  if (!settings) return;
  setSaveState("saving");
  try {
    const credential = await saveProviderCredential(apiKey);
    const validated = await validateProviderCredential(credential.id);
    const response = await updateSettings(settingsRequestFrom(settings, { providerCredentialId: credential.id }));
    setProviderCredential(validated);
    setSettings(response.settings);
    setApiKey("");
    setSaveState("saved");
  } catch {
    setSaveState("failed");
  }
}

async function updateSettingsField(
  settings: UserSettings | undefined,
  setSettings: (settings: UserSettings | undefined) => void,
  patch: Partial<ReturnType<typeof settingsRequestFrom>>
): Promise<void> {
  if (!settings) return;
  const response = await updateSettings(settingsRequestFrom(settings, patch));
  setSettings(response.settings);
}

async function updatePeriodicScreenshotSetting(
  enabled: boolean,
  settings: UserSettings | undefined,
  setSettings: (settings: UserSettings | undefined) => void,
  consentGrants: ConsentGrant[],
  runtimeState: CaptureRuntimeState,
  setCaptureError: (error: string | undefined) => void
): Promise<void> {
  if (!settings) return;
  console.info(`[Persuando Capture] Periodic screen context toggle requested: enabled=${enabled} listening=${runtimeState.listening} activeCapture=${Boolean(activeCapture)}.`);
  const response = await updateSettings(settingsRequestFrom(settings, { periodicScreenshotCaptureDefault: enabled }));
  console.info(`[Persuando Capture] Periodic screen context toggle saved: enabled=${response.settings.periodicScreenshotCaptureDefault}.`);
  setSettings(response.settings);

  if (!enabled) {
    periodicScreenCapture?.stop();
    periodicScreenCapture = undefined;
    console.info("[Persuando Capture] Periodic screen context toggle disabled; stopping local and peer renderer timers.");
    await window.persuandoCapture?.stopPeriodicScreenContext();
    setCaptureError(undefined);
    return;
  }

  if (runtimeState.listening) {
    console.info("[Persuando Capture] Requesting periodic screen context start in active capture renderer.");
    if (activeCapture) {
      periodicScreenCapture?.stop();
      periodicScreenCapture = await maybeStartPeriodicScreenCapture(response.settings, consentGrants, setCaptureError);
    } else {
      console.info("[Persuando Capture] Active capture is in another renderer; forwarding periodic start command.");
      await window.persuandoCapture?.startPeriodicScreenContext();
    }
  }
}

async function grantConsentFlow(
  consentType: ConsentType,
  setState: (state: "idle" | "saving" | "saved" | "failed") => void,
  setConsentGrants: (grants: ConsentGrant[]) => void
): Promise<void> {
  setState("saving");
  try {
    await grantConsent(consentType);
    setConsentGrants(await listConsentGrants());
    setState("saved");
  } catch {
    setState("failed");
  }
}

async function revokeConsentFlow(
  grantId: string,
  setState: (state: "idle" | "saving" | "saved" | "failed") => void,
  setConsentGrants: (grants: ConsentGrant[]) => void
): Promise<void> {
  setState("saving");
  try {
    await revokeConsent(grantId);
    setConsentGrants(await listConsentGrants());
    setState("saved");
  } catch {
    setState("failed");
  }
}

async function refreshMicrophones(
  setMicrophones: (devices: MediaDeviceInfo[]) => void,
  setSelectedMicrophoneId: (deviceId: string | undefined) => void,
  setCaptureError: (error: string | undefined) => void
): Promise<void> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setCaptureError("Microphone device discovery is unavailable.");
      return;
    }
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    setMicrophones(devices);
    setSelectedMicrophoneId(devices[0]?.deviceId);
  } catch (error) {
    setCaptureError(error instanceof Error ? error.message : "Microphone permission denied.");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
