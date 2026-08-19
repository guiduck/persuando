"use client";

import type { SessionHistoryResponse } from "@persuando/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionRealtimeClient } from "./session-realtime-client";

interface SessionHistoryLoaderProps {
  initialHistory?: SessionHistoryResponse;
  sessionId: string;
}

type LoadState = "loading" | "ready" | "unavailable";

export function SessionHistoryLoader({ initialHistory, sessionId }: Readonly<SessionHistoryLoaderProps>) {
  const [history, setHistory] = useState<SessionHistoryResponse | undefined>(initialHistory);
  const [state, setState] = useState<LoadState>(initialHistory ? "ready" : "loading");

  useEffect(() => {
    if (initialHistory) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${apiBaseUrl()}/sessions/${sessionId}`, {
          cache: "no-store",
          credentials: "include"
        });
        if (!response.ok) throw new Error("Session unavailable");
        const nextHistory = (await response.json()) as SessionHistoryResponse;
        if (cancelled) return;
        setHistory(nextHistory);
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialHistory, sessionId]);

  if (history) return <SessionRealtimeClient history={history} />;

  return (
    <main className="page">
      <nav className="workspace-nav">
        <Link className="pill" href="/">
          Back to workspace
        </Link>
      </nav>
      <section className="panel session-loader-panel">
        <h1>{state === "loading" ? "Loading live session" : "Session unavailable"}</h1>
        <p className="muted">
          {state === "loading"
            ? "Trying to connect with your browser session."
            : "The session may have ended, been deleted, or belongs to another signed-in account."}
        </p>
      </section>
    </main>
  );
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}
