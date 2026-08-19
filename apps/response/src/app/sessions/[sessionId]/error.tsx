"use client";

export default function SessionError({
  reset
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <strong>Session unavailable</strong>
          <span>Response Mode</span>
        </div>
        <button onClick={reset} type="button">
          Retry
        </button>
      </header>
      <section className="detail-grid">
        <div className="panel">
          <span className="pill empty">Could not load session history.</span>
        </div>
      </section>
    </main>
  );
}
