-- BoardStack / BoardPDF - Temporary Files Registry and Control (AWS S3)

CREATE DATABASE IF NOT EXISTS boardpdf_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boardpdf_db;

CREATE TABLE IF NOT EXISTS file_operations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_token VARCHAR(64) NOT NULL UNIQUE,
  s3_key VARCHAR(255) NOT NULL,
  s3_bucket VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tool_name VARCHAR(64) NOT NULL DEFAULT 'general',
  status ENUM('active', 'downloaded', 'expired', 'deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP NULL,
  INDEX idx_expires_status (expires_at, status),
  INDEX idx_file_token (file_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  google_email VARCHAR(255) NULL,
  avatar_url VARCHAR(512) NULL,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  subscription_period_end TIMESTAMP NULL,
  storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,
  ai_tokens_balance INT UNSIGNED NOT NULL DEFAULT 100,
  ai_tokens_reset_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 MONTH),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret VARCHAR(255) NULL,
  two_factor_recovery_codes TEXT NULL,
  registration_ip VARCHAR(45) NULL,
  registration_country_code VARCHAR(10) NULL,
  registration_country_name VARCHAR(100) NULL,
  registration_region VARCHAR(100) NULL,
  registration_city VARCHAR(100) NULL,
  registration_asn VARCHAR(50) NULL,
  registration_isp VARCHAR(255) NULL,
  last_login_ip VARCHAR(45) NULL,
  last_login_country VARCHAR(100) NULL,
  last_login_city VARCHAR(100) NULL,
  last_login_asn VARCHAR(50) NULL,
  last_login_isp VARCHAR(255) NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_email (email),
  INDEX idx_user_username (username),
  INDEX idx_user_storage (storage_used_bytes),
  INDEX idx_users_tokens_reset (ai_tokens_reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT PRIMARY KEY,
  theme VARCHAR(20) NOT NULL DEFAULT 'system',
  language VARCHAR(50) NOT NULL DEFAULT 'es',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_payment_intent_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_customer_id VARCHAR(255) NULL,
  plan_id VARCHAR(50) NOT NULL,
  billing_period VARCHAR(20) NOT NULL,
  amount_total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchases_user (user_id),
  INDEX idx_purchases_session (stripe_session_id),
  INDEX idx_purchases_intent (stripe_payment_intent_id),
  INDEX idx_purchases_subscription (stripe_subscription_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_folders (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  parent_id VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  folder_type ENUM('project', 'uploads', 'upload_folder') NOT NULL DEFAULT 'project',
  color VARCHAR(32) NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_folders_user (user_id),
  INDEX idx_folders_parent (parent_id),
  INDEX idx_folders_type (folder_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES project_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collaborative_documents (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  folder_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Document',
  content_json LONGTEXT NOT NULL,
  pdf_filename VARCHAR(255) NULL,
  page_count INT UNSIGNED NOT NULL DEFAULT 1,
  access_level ENUM('restricted', 'anyone_with_link') NOT NULL DEFAULT 'restricted',
  custom_slug VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_docs (user_id),
  INDEX idx_doc_folder (folder_id),
  INDEX idx_created_at (created_at),
  UNIQUE INDEX uq_doc_custom_slug (custom_slug),
  FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collaborative_document_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doc_user (document_id, user_id),
  INDEX idx_doc_members (document_id),
  INDEX idx_user_members (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_storage_assets (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  document_id VARCHAR(64) NULL,
  folder_id VARCHAR(64) NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  s3_key VARCHAR(512) NULL,
  mime_type VARCHAR(100) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  asset_type ENUM('document_json', 'document_pdf', 'upload_image', 'upload_pdf') NOT NULL,
  is_cold BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_assets (user_id),
  INDEX idx_document_assets (document_id),
  INDEX idx_asset_folder (folder_id),
  INDEX idx_cold_assets (is_cold),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_token_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  tool_id VARCHAR(50) NOT NULL,
  tokens_consumed INT UNSIGNED NOT NULL,
  pdf_pages INT UNSIGNED NOT NULL DEFAULT 1,
  pdf_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_tokens_user (user_id),
  INDEX idx_ai_tokens_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 1. PBAC Catalog & Subscription Permissions
-- ==============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permission_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_tier_permissions (
  tier VARCHAR(50) NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tier, permission_id),
  INDEX idx_sub_tier (tier),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Initial Seeds: Permissions & Tier Grants

INSERT IGNORE INTO permissions (name, description, category) VALUES
  ('tools:access', 'General access to PDF processing tools', 'tools'),
  ('subscription:feature:pro', 'Access to Pro features', 'subscription'),
  ('subscription:feature:business', 'Access to Business features and collaborative work', 'subscription');

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'business', id FROM permissions WHERE name IN (
  'subscription:feature:pro',
  'subscription:feature:business'
);

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'pro', id FROM permissions WHERE name IN (
  'subscription:feature:pro'
);

-- Linked Cloud Services (Google Drive, Dropbox)

CREATE TABLE IF NOT EXISTS user_cloud_integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider ENUM('google_drive', 'dropbox') NOT NULL,
  account_id VARCHAR(255) NULL,
  account_email VARCHAR(255) NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  token_expires_at TIMESTAMP NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_provider (user_id, provider),
  INDEX idx_user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact Form and Public Support (Contact Submissions)

CREATE TABLE IF NOT EXISTS contact_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_number VARCHAR(32) NOT NULL UNIQUE,
  tracking_token VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contact_email (email),
  INDEX idx_contact_status (status),
  INDEX idx_contact_created_at (created_at),
  INDEX idx_contact_ticket_number (ticket_number),
  INDEX idx_contact_tracking_token (tracking_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  sender_type ENUM('customer', 'agent', 'system') NOT NULL DEFAULT 'customer',
  sender_name VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_msg_submission (submission_id),
  FOREIGN KEY (submission_id) REFERENCES contact_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Color Labels & Document Label Assignments

CREATE TABLE IF NOT EXISTS user_labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,
  color ENUM('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray') NOT NULL DEFAULT 'red',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_label_name (user_id, name),
  INDEX idx_user_labels_user (user_id),
  INDEX idx_user_labels_user_default (user_id, is_default),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collaborative_document_labels (
  document_id VARCHAR(64) NOT NULL,
  label_id INT NOT NULL,
  assigned_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, label_id),
  INDEX idx_doc_labels_label (label_id),
  FOREIGN KEY (document_id) REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES user_labels(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

