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

  return (
    <main className="page">
      <nav className="workspace-nav">
        <Link className="pill" href="/">
          Back to workspace
        </Link>
      </nav>
      <SessionHistoryLoader initialHistory={history} sessionId={sessionId} />
    </main>
  );
}
