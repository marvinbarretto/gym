-- Expand role constraint to include system and tool messages
ALTER TABLE gym.conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_role_check;
ALTER TABLE gym.conversation_messages
  ADD CONSTRAINT conversation_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'tool'));

-- Allow nullable content for tool-only messages
ALTER TABLE gym.conversation_messages
  ALTER COLUMN content DROP NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv
  ON gym.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON gym.conversations(session_id) WHERE session_id IS NOT NULL;
