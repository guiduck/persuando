# Reference UI

This file tracks prototype and UI reference decisions for Persuando.

## Prototype Source

- Lovable prompt: start from `docs/lovable-prompt-base.md` after the first `/speckit-specify` output exists.
- Prototype/reference flow: `docs/prototype-mvp-flow.md`.
- Prototype URL or export: external Lovable export not created yet.
- Relevant screenshots: none yet.

## Screens

- Capture floating toolbar: compact always-on-top control surface with assistant/session selector, dashboard/home, ask/respond shortcut, start listening, recording timer, stop/end button, and status indicators.
- Capture dashboard/main window: simple session launcher, recent sessions, current assistant/profile, settings entry, and resume controls. This should be simpler than the observed competitor dashboard.
- Capture settings: OpenAI API key entry, transcription model selection, analysis model selection, microphone/screen permissions, audio/screen controls, feature toggles, session timer, auto-scroll, and shortcuts.
- Capture tray/status: background running state, show/hide toolbar, open dashboard/settings, active capture indicators, pause/resume controls, end session, and quit action.
- Response session: live transcript, running summary, topic/keyword explanations, direct suggested responses, follow-up questions, and code/practice guidance.
- Same-machine response mode: the Capture App may open Response Mode locally, but the architecture must still support Response Mode on a second device signed in to the same account.

## Design Decisions

- Treat settings and consent as first-class product surfaces, not hidden preferences.
- Make the floating toolbar the primary Capture App surface during live use.
- Keep the Capture App quiet and operational, with clear status rather than a marketing-style interface or oversized dashboard.
- Make Response Mode optimized for scanning during live use: transcript, current summary, explanations, and suggestions should be visible without heavy navigation.
- Prefer automatic generation of summaries, explanations, and suggested responses over prompt buttons that require repeated user clicks.
- Focus AI behavior on answering questions, explaining concepts, identifying keywords, and giving concise response options. Avoid generic conversational filler.
- Use explicit active/paused indicators whenever capture or AI processing is running.
- Do not copy competitor branding, names, paid-feature upsell patterns, stealth-positioning, or hidden/evasion claims.

## Production Notes

The prototype should validate workflow, information hierarchy, toolbar ergonomics, tray behavior, and consent clarity. Production implementation should preserve those decisions while replacing prototype-only data with authenticated sessions, realtime events, persisted settings, and provider-backed AI processing.

Current implementation validation:

- Capture dashboard/settings now implements provider key entry, model/language settings, feature
  defaults, consent grant/revoke, microphone selection, visible capture errors, and shortcut
  reference rows.
- Capture toolbar now implements dashboard/home, ask/context, screen context, start, pause, resume,
  end, timer/status, hide/show, and visible error state.
- Capture tray now implements close-to-tray, status, show/hide toolbar, open dashboard, start/end,
  pause/resume, capture context, revoke capture, and quit commands.
- Response session now implements retained history plus live transcript, summary, direct suggested
  answers, topics, insights, follow-ups, code-practice explanations, provider errors, reconnecting
  state, and manual delete state.
