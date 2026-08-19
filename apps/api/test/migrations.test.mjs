import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
const userSettingsMigration = await readFile(
  new URL("../migrations/0002_user_settings_capture_models.sql", import.meta.url),
  "utf8"
);

test("initial migration includes required MVP tables", () => {
  for (const table of [
    "users",
    "workspaces",
    "user_settings",
    "provider_credentials",
    "consent_grants",
    "sessions",
    "session_clients",
    "capture_devices",
    "capture_events",
    "transcript_segments",
    "summaries",
    "insights",
    "suggestions",
    "screen_capture_events",
    "code_copilot_contexts",
    "retention_policies",
    "audit_events"
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table} \\(`));
  }
});

test("initial migration models retention and deleted timestamps", () => {
  assert.match(migration, /retention_expires_at timestamptz NOT NULL/);
  assert.match(migration, /deleted_at timestamptz/);
  assert.match(migration, /duration_days integer NOT NULL DEFAULT 7/);
  assert.match(migration, /manual_delete_enabled boolean NOT NULL DEFAULT true/);
});

test("initial migration supports provider-scoped text user IDs", () => {
  assert.match(migration, /CREATE TABLE users \(\s+id text PRIMARY KEY,/);
  assert.match(migration, /owner_user_id text NOT NULL REFERENCES users\(id\)/);
  assert.match(migration, /user_id text NOT NULL REFERENCES users\(id\)/);
  assert.match(migration, /user_id text PRIMARY KEY REFERENCES users\(id\)/);
});

test("initial migration models encrypted credential metadata without plaintext secret column", () => {
  assert.match(migration, /encrypted_ciphertext text NOT NULL/);
  assert.match(migration, /encryption_version text NOT NULL/);
  assert.match(migration, /masked_display_value text NOT NULL/);
  assert.doesNotMatch(migration, /\b(secret|api_key|plaintext)\b/i);
});

test("initial migration indexes event ordering and session retention", () => {
  assert.match(migration, /UNIQUE \(session_id, sequence\)/);
  assert.match(migration, /idx_sessions_retention_expires_at/);
  assert.match(migration, /idx_capture_events_session_sequence/);
});

test("settings migration includes capture toolbar MVP preferences", () => {
  assert.match(userSettingsMigration, /periodic_screenshot_capture_default boolean NOT NULL DEFAULT false/);
  assert.match(userSettingsMigration, /code_practice_context_default boolean NOT NULL DEFAULT false/);
  assert.match(userSettingsMigration, /auto_scroll_default boolean NOT NULL DEFAULT true/);
  assert.match(userSettingsMigration, /session_timer_minutes integer/);
  assert.match(userSettingsMigration, /transcription_model text NOT NULL DEFAULT 'gpt-4o-mini-transcribe'/);
  assert.match(userSettingsMigration, /analysis_model text NOT NULL DEFAULT 'gpt-4o-mini'/);
});
