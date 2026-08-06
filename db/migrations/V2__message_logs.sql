-- V2: Message logs for dashboard "Messages Sent Today" / "Total Messages Sent" stats.
-- Only successfully sent text/poll messages are ever inserted here (failed sends are never logged).

CREATE TABLE IF NOT EXISTS message_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  message_type VARCHAR(16) NOT NULL,        -- 'text' | 'poll'
  destination VARCHAR(64) NOT NULL,         -- chatId, e.g. 9471...@c.us or ...@g.us
  whatsapp_message_id VARCHAR(191) NULL,    -- Message._serialized id, when available
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_message_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  KEY idx_message_logs_user_type_sent_at (user_id, message_type, sent_at)
) ENGINE=InnoDB;
