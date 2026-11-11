interface CaptureActivity {
  isActive(): boolean;
  readonly captureRevision: number;
}

interface ManagedCapture {
  session: { id: string };
  pause(): void;
  resume(): void;
  stop(): void;
}

/** The toolbar and dashboard have separate renderers; apply shared controls to the owner. */
export function synchronizeCaptureActivity(capture: ManagedCapture, state: {
  activeSessionId?: string;
  listening: boolean;
  paused: boolean;
  status: string;
}): boolean {
  const terminal = state.status === "ended" || state.status === "revoked" || state.status === "error";
  const replaced = state.activeSessionId !== undefined && state.activeSessionId !== capture.session.id;
  if (terminal || replaced) {
    capture.stop();
    return false;
  }
  if (state.listening) {
    if (state.paused) capture.pause();
    else capture.resume();
  }
  return true;
}

/** A paused/ended/replaced session must not request or publish another screenshot. */
export async function captureActiveScreenImage<T>(
  capture: CaptureActivity | undefined,
  captureImage: () => Promise<T>,
  isCurrent: () => boolean
): Promise<T | undefined> {
  if (!capture?.isActive() || !isCurrent()) return undefined;
  const revision = capture.captureRevision;
  const image = await captureImage();
  return capture.isActive() && capture.captureRevision === revision && isCurrent() ? image : undefined;
}
