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
- Response session: live transcript, running summary, topic/keyword explanations, direct suggested responses, follow-up questions, an independent Code Practice panel, an independent System Design panel, and a Portuguese/English generation-language selector.
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
- Code Practice and System Design have separate Manual/Auto controls and loading state so they can
  generate simultaneously. Retained answers rehydrate into their original panel.
- Code Practice structured steps render complete code and the matching runnable example test side by
  side, with expected output, rationale, and prominent interview speech. The layout stacks on narrow
  screens.
- System Design renders provider-supplied fenced Mermaid diagrams through strict lazy-loaded Mermaid;
  invalid diagrams fall back to visible source instead of executing arbitrary page content.
- System Design makes progress explicit through nine numbered headings in the fixed order Requirements,
  Access patterns, Scale, Data, High-level design, Bottlenecks, Consistency, Failures, and Trade-offs.
  Each section visibly contains Problem, Solution, Trade-off, and interview speech in that order.
- Both the initial assumption-based Mermaid sketch and final evolved diagram, together with each
  immediately following `Legenda do diagrama` or `Diagram legend`, render as semantic artifacts. Every
  diagram and explanatory legend sit side by side when space permits and stack automatically on narrow
  screens. Clicking or keyboard-activating either diagram opens a near-fullscreen native dialog with
  a larger horizontally scrollable rendering and its complete legend below. Retained answers without
  the structured pairs continue through the safe Markdown renderer.
- System Design keeps its Generate state active after the three-minute slow threshold and shows an
  informational message instead of a failure. Realtime completion still arrives over WebSocket; a
  terminal client timeout is reserved for ten minutes or an explicit provider error.
- Before those generated explanations, System Design shows a compact `Guia rápido de conceitos`
  callout. Its modal reference is loaded from Markdown on demand, closes with `Escape`, restores
  normal page interaction when dismissed, and handles loading, failure, and retry states. Concept
  headings use blue; benefits use green plus a check label; risks/trade-offs use red plus a warning
  label, so meaning is not communicated by color alone.
- Response sessions expose `Edit layout`, `Done arranging`, and `Reset layout`. In edit mode, every
  card has a dedicated drag handle, current position, and earlier/later controls; sorting supports
  pointer, touch, and keyboard input and announces movement to assistive technology.
- The grid applies the logical order from left to right and stores a normalized, versioned preference
  per assistant mode in the current browser. Cross-device sync, card hiding, and custom sizing are
  deferred.
