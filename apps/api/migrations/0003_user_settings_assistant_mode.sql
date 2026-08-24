ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS assistant_mode TEXT NOT NULL DEFAULT 'conversation';

UPDATE user_settings
SET assistant_mode = 'code_practice'
WHERE code_practice_context_default = TRUE
  AND assistant_mode = 'conversation';
