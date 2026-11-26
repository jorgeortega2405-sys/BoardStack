CREATE DATABASE IF NOT EXISTS boardstack_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boardstack_app;

CREATE TABLE IF NOT EXISTS app_user_profiles (
  user_id INT PRIMARY KEY,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  subscription_period_end DATETIME NULL,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,
  ai_tokens_balance INT UNSIGNED NOT NULL DEFAULT 100,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_aup_tier_status (subscription_tier, subscription_status),
  INDEX idx_aup_stripe_cust (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE,
  slug VARCHAR(50) NULL UNIQUE,
  owner_id INT NULL,
  owner_username VARCHAR(100) NOT NULL,
  is_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  requires_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash VARCHAR(255) NULL,
  owner_token VARCHAR(128) NULL,
  save_to_cloud BOOLEAN NOT NULL DEFAULT FALSE,
  upload_permission VARCHAR(20) NOT NULL DEFAULT 'all',
  max_downloads INT UNSIGNED NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rooms_code (code),
  INDEX idx_rooms_slug (slug),
  INDEX idx_rooms_owner (owner_id),
  INDEX idx_rooms_expires (expires_at),
  INDEX idx_rooms_owner_created (owner_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  file_id VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NULL,
  name VARCHAR(255) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  s3_key VARCHAR(512) NOT NULL,
  s3_url VARCHAR(1024) NOT NULL,
  download_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_downloads INT UNSIGNED NULL,
  folder_id VARCHAR(64) NULL,
  folder_name VARCHAR(255) NULL,
  relative_path VARCHAR(512) NULL,
  sender_username VARCHAR(100) NOT NULL,
  sender_avatar TEXT NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rf_room (room_id),
  INDEX idx_rf_file (file_id),
  INDEX idx_rf_expires (expires_at),
  INDEX idx_rf_room_created (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  billing_type VARCHAR(50) NOT NULL,
  billing_period VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sub_user_id (user_id),
  INDEX idx_sub_status (status),
  INDEX idx_sub_user_status (user_id, status),
  INDEX idx_sub_payment_intent (stripe_payment_intent_id),
  INDEX idx_sub_subscription_id (stripe_subscription_id),
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  billing_type VARCHAR(50) NOT NULL DEFAULT 'recurring',
  billing_period VARCHAR(50) NOT NULL,
  amount_total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  stripe_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_customer_id VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_purchases_intent (stripe_payment_intent_id),
  INDEX idx_purchases_user (user_id),
  INDEX idx_purchases_user_date (user_id, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  owner_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  domain VARCHAR(100) NULL,
  seats_limit INT UNSIGNED NOT NULL DEFAULT 25,
  saml_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  saml_entry_point VARCHAR(512) NULL,
  saml_issuer VARCHAR(255) NULL,
  saml_cert TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_owner (owner_id),
  INDEX idx_org_slug (slug),
  INDEX idx_org_domain (domain),
  FOREIGN KEY (owner_id) REFERENCES app_user_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  user_id INT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_org_member (org_id, email),
  INDEX idx_om_org (org_id),
  INDEX idx_om_user (user_id),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  user_id INT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  hear_about VARCHAR(100) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_size VARCHAR(50) NOT NULL,
  country VARCHAR(100) NOT NULL,
  role_level VARCHAR(100) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  notes TEXT NULL,
  status ENUM('pending', 'contacted', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_el_user (user_id),
  INDEX idx_el_email (work_email),
  INDEX idx_el_status (status),
  INDEX idx_el_created (created_at),
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  lead_id INT NULL,
  user_id INT NULL,
  organization_id INT NULL,
  title VARCHAR(180) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  s3_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sha256_hash CHAR(64) NOT NULL,
  uploaded_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ec_lead (lead_id, created_at DESC),
  INDEX idx_ec_user (user_id, created_at DESC),
  INDEX idx_ec_org (organization_id, created_at DESC),
  FOREIGN KEY (lead_id) REFERENCES enterprise_leads(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES app_user_profiles(user_id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_user_profiles (user_id, subscription_tier, subscription_status) VALUES
  (1, 'pro', 'active'),
  (2, 'free', 'active');
