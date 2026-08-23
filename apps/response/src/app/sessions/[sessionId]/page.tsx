import Link from "next/link";

import { getSessionHistory } from "../../../lib/api";
import { SessionHistoryLoader } from "./session-history-loader";

export const runtime = "nodejs";

export default async function SessionDetailPage({
  params
}: Readonly<{
  params: Promise<{ sessionId: string }>;
}>) {
  const { sessionId } = await params;
  const history = await getSessionHistory(sessionId);
  const realtimeEndpoint = resolveRealtimeEndpoint();

  return (
    <main className="page">
      <nav className="workspace-nav">
        <Link className="pill" href="/">
          Back to workspace
        </Link>
      </nav>
      <SessionHistoryLoader initialHistory={history} realtimeEndpoint={realtimeEndpoint} sessionId={sessionId} />
    </main>
  );
}

function resolveRealtimeEndpoint(): string {
  const configured = process.env.WEBSOCKET_URL ?? process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("WEBSOCKET_URL or NEXT_PUBLIC_WEBSOCKET_URL must be configured for the Response app.");
  }
  return "ws://localhost:4000/realtime";
}
