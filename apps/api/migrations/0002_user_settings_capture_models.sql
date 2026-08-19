ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS periodic_screenshot_capture_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS code_practice_context_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_scroll_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS session_timer_minutes integer,
  ADD COLUMN IF NOT EXISTS transcription_model text NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
  ADD COLUMN IF NOT EXISTS analysis_model text NOT NULL DEFAULT 'gpt-4o-mini';
