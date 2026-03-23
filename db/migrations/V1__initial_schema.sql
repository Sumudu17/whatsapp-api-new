-- V1: Initial database schema (multi-user WhatsApp platform)
-- Migrated from legacy migrations/001_init.sql — do not edit after apply; add V2+ for changes.

-- Initial schema for multi-user WhatsApp platform

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_email_otps_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  KEY idx_email_otps_user_id (user_id),
  KEY idx_email_otps_purpose_email (purpose, email),
  KEY idx_email_otps_expires_at (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_INITIALIZED',
  last_connected_at DATETIME NULL,
  last_authenticated_at DATETIME NULL,
  last_disconnected_at DATETIME NULL,
  last_disconnected_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_whatsapp_sessions_user_id (user_id),
  UNIQUE KEY uniq_whatsapp_sessions_client_id (client_id),
  CONSTRAINT fk_whatsapp_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  KEY idx_whatsapp_sessions_status (status),
  KEY idx_whatsapp_sessions_updated_at (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  api_key_hash CHAR(64) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  last_used_at DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_api_keys_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  KEY idx_api_keys_user_id (user_id),
  KEY idx_api_keys_status (status),
  UNIQUE KEY uniq_api_keys_user_prefix (user_id, key_prefix)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(50) NOT NULL,
  dedup_key VARCHAR(255) NOT NULL,
  payload_json JSON NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notification_events_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  UNIQUE KEY uniq_notification_events_dedup_key (dedup_key),
  KEY idx_notification_events_event_type (event_type),
  KEY idx_notification_events_user_id (user_id),
  KEY idx_notification_events_sent_at (sent_at)
) ENGINE=InnoDB;
