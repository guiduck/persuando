"use client";

import type { GetCurrentWorkspaceResponse, Session } from "@persuando/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthMeResponse } from "../lib/api";

interface WorkspaceRealtimeHomeProps {
  googleLoginUrl: string;
  initialUser: AuthMeResponse;
  initialWorkspaceState?: GetCurrentWorkspaceResponse;
}

type RefreshState = "idle" | "refreshing" | "offline";

export function WorkspaceRealtimeHome({ googleLoginUrl, initialUser, initialWorkspaceState }: Readonly<WorkspaceRealtimeHomeProps>) {
  const [workspaceState, setWorkspaceState] = useState(initialWorkspaceState);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>();

  useEffect(() => {
    if (!initialUser.authenticated) return;
    let stopped = false;

    const refresh = async () => {
      try {
        setRefreshState("refreshing");
        const next = await fetchWorkspace();
        if (stopped) return;
        setWorkspaceState(next);
        setRefreshState("idle");
        setLastUpdatedAt(new Date().toISOString());
      } catch {
        if (!stopped) setRefreshState("offline");
      }
    };

    const interval = window.setInterval(() => void refresh(), 1500);
    void refresh();
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [initialUser.authenticated]);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <strong>Persuando Response</strong>
          <span>Response Mode</span>
        </div>
        {initialUser.authenticated ? (
          <span className="pill active">{initialUser.user?.email}</span>
        ) : (
          <a className="button" href={googleLoginUrl}>
            Sign in with Google
          </a>
        )}
      </header>

      <section className="shell">
        <aside className="panel stack">
          <div>
            <h1>{initialUser.authenticated ? "Current Workspace" : "Sign In Required"}</h1>
          </div>
          {workspaceState ? (
            <div className="stack">
              <span className="pill">{workspaceState.workspace.name}</span>
              <span className="muted">{workspaceState.workspace.activeSessionIds.length} active sessions</span>
              <span className="muted">{workspaceState.workspace.recentSessionIds.length} recent sessions</span>
              <span className={refreshState === "offline" ? "pill empty" : "pill active"}>
                {refreshState === "offline" ? "updates offline" : "live list"}
              </span>
              {lastUpdatedAt ? <span className="muted">Updated {formatTime(lastUpdatedAt)}</span> : null}
            </div>
          ) : null}
        </aside>

        <section className="stack">
          <SessionPanel title="Active Sessions" emptyLabel="No active capture sessions yet." sessions={workspaceState?.activeSessions ?? []} />
          <SessionPanel title="Recent Sessions" emptyLabel="No retained sessions yet." sessions={workspaceState?.recentSessions ?? []} />
        </section>
      </section>
    </main>
  );
}

function SessionPanel({
  emptyLabel,
  sessions,
  title
}: Readonly<{
  emptyLabel: string;
  sessions: Session[];
  title: string;
}>) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="session-list">
        {sessions.length === 0 ? (
          <span className="pill empty">{emptyLabel}</span>
        ) : (
          sessions.map((session) => (
            <Link className="session-card" href={`/sessions/${session.id}`} key={session.id}>
              <strong>{session.title}</strong>
              <span className={session.status === "active" ? "pill active" : "pill"}>{session.status}</span>
              <p>Retained until {formatDate(session.retentionExpiresAt)}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

async function fetchWorkspace(): Promise<GetCurrentWorkspaceResponse> {
  const response = await fetch(`${apiBaseUrl()}/workspaces/current`, {
    cache: "no-store",
    credentials: "include"
  });
  if (!response.ok) throw new Error("Workspace refresh failed");
  return (await response.json()) as GetCurrentWorkspaceResponse;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
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
