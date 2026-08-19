CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_credentials (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  encrypted_ciphertext text NOT NULL,
  encryption_version text NOT NULL,
  masked_display_value text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('unverified', 'valid', 'invalid', 'revoked', 'deleted')),
  last_checked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider_credential_id uuid REFERENCES provider_credentials(id),
  primary_language text NOT NULL DEFAULT 'en',
  response_language text NOT NULL DEFAULT 'en',
  preferred_programming_language text NOT NULL DEFAULT 'typescript',
  microphone_capture_default boolean NOT NULL DEFAULT false,
  retention_mode text NOT NULL DEFAULT 'seven_day_workspace',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('created', 'active', 'paused', 'revoked', 'error', 'ended', 'deleted')),
  started_at timestamptz,
  ended_at timestamptz,
  retention_expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  active_capture_client_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consent_grants (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'revoked', 'expired', 'missing')),
  consent_text_version text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_clients (
  id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_type text NOT NULL CHECK (client_type IN ('capture', 'response')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  last_ack_sequence bigint
);

CREATE TABLE capture_devices (
  id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  device_type text NOT NULL CHECK (device_type = 'microphone'),
  display_name text NOT NULL,
  platform text NOT NULL CHECK (platform = 'windows'),
  permission_status text NOT NULL
);

CREATE TABLE capture_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  sequence bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (session_id, sequence)
);

CREATE TABLE transcript_segments (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text text NOT NULL,
  start_ms integer NOT NULL,
  end_ms integer NOT NULL,
  confidence numeric NOT NULL,
  source text NOT NULL CHECK (source = 'microphone'),
  language text NOT NULL,
  provisional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE summaries (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_segment_ids uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL
);

CREATE TABLE insights (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  content text NOT NULL,
  confidence numeric NOT NULL,
  source_segment_ids uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL
);

CREATE TABLE suggestions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  category text NOT NULL,
  content text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  source_segment_ids uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL
);

CREATE TABLE screen_capture_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  source_label text NOT NULL,
  image_reference text,
  text_context text,
  analysis_status text NOT NULL CHECK (analysis_status IN ('captured', 'processed', 'redacted', 'deleted'))
);

CREATE TABLE code_copilot_contexts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  programming_language text NOT NULL,
  explanation_mode text NOT NULL CHECK (explanation_mode IN ('hint', 'explain', 'review')),
  problem_context text NOT NULL,
  generated_guidance text,
  status text NOT NULL CHECK (status IN ('inactive', 'active', 'paused', 'completed', 'discarded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE retention_policies (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retention_mode text NOT NULL DEFAULT 'seven_day_workspace',
  duration_days integer NOT NULL DEFAULT 7,
  manual_delete_enabled boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_owner_status ON sessions(owner_user_id, status);
CREATE INDEX idx_sessions_retention_expires_at ON sessions(retention_expires_at);
CREATE INDEX idx_transcript_segments_session_start ON transcript_segments(session_id, start_ms);
CREATE INDEX idx_capture_events_session_sequence ON capture_events(session_id, sequence);
CREATE INDEX idx_screen_capture_events_session_captured ON screen_capture_events(session_id, captured_at);
CREATE INDEX idx_code_copilot_contexts_session_status ON code_copilot_contexts(session_id, status);
CREATE INDEX idx_audit_events_user_created ON audit_events(user_id, created_at);
