CREATE DATABASE IF NOT EXISTS boardstack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boardstack_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  google_email VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  subscription_period_end DATETIME NULL,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,
  ai_tokens_balance INT UNSIGNED NOT NULL DEFAULT 100,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret VARCHAR(255) NULL,
  two_factor_recovery_codes TEXT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  registration_ip VARCHAR(45) NULL,
  last_login_ip VARCHAR(45) NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_tier_status (subscription_tier, subscription_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type ENUM('register', 'password_reset', 'email_change') NOT NULL DEFAULT 'register',
  payload JSON NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_type (email, type),
  INDEX idx_verif_email_type_expires (email, type, expires_at),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resets_email_used (email, used),
  INDEX idx_reset_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT PRIMARY KEY,
  theme VARCHAR(20) NOT NULL DEFAULT 'light',
  language VARCHAR(10) NOT NULL DEFAULT 'es',
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  extended_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  save_to_cloud BOOLEAN NOT NULL DEFAULT FALSE,
  upload_permission VARCHAR(20) NOT NULL DEFAULT 'all',
  max_downloads INT UNSIGNED NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rooms_code (code),
  INDEX idx_rooms_slug (slug),
  INDEX idx_rooms_owner (owner_id),
  INDEX idx_rooms_expires (expires_at)
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
  INDEX idx_rf_expires (expires_at)
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permission_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  INDEX idx_rp_role (role_id),
  INDEX idx_rp_permission (permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT NULL,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_ur_user (user_id),
  INDEX idx_ur_role (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
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
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (name, description, is_default) VALUES
  ('SUPER_ADMIN', 'Super Administrator with exceptional root access', FALSE),
  ('PLATFORM_ADMIN', 'Platform Administrator for general platform operations', FALSE),
  ('SECURITY_ADMIN', 'Security Administrator for IAM, MFA, and audit policies', FALSE),
  ('SUPPORT_AGENT', 'Support Agent for customer assistance and incident resolution', FALSE),
  ('BILLING_ADMIN', 'Billing Administrator for finance, payments, and subscriptions', FALSE),
  ('OPERATIONS_AGENT', 'Operations Agent for daily system operations', FALSE),
  ('USER', 'Standard platform user account', TRUE);

INSERT IGNORE INTO permissions (name, description, category) VALUES
  ('app:access', 'General access to the application', 'general'),
  ('profile:view', 'View own user profile and settings', 'profile'),
  ('profile:edit', 'Update own user profile and settings', 'profile'),
  ('billing:view', 'View billing and subscription details', 'billing'),
  ('billing:manage', 'Manage subscriptions and payment methods', 'billing'),
  ('admin:access', 'Access administrative features and panels', 'admin'),
  ('admin:users:view', 'View all registered user accounts', 'admin'),
  ('admin:users:manage', 'Manage, suspend, or update user accounts', 'admin'),
  ('admin:roles:manage', 'Assign and manage user roles and permissions', 'admin'),
  ('security:audit', 'Review security logs and access sessions', 'security'),
  ('support:tickets', 'Manage user tickets and inquiries', 'support'),
  ('operations:manage', 'Manage system tasks and operational workflows', 'operations');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'USER'
  AND p.name IN (
    'app:access',
    'profile:view',
    'profile:edit',
    'billing:view',
    'billing:manage'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'PLATFORM_ADMIN'
  AND p.name NOT IN ('security:audit');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SECURITY_ADMIN'
  AND p.name IN ('app:access', 'profile:view', 'profile:edit', 'security:audit', 'admin:access', 'admin:roles:manage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPPORT_AGENT'
  AND p.name IN ('app:access', 'profile:view', 'profile:edit', 'support:tickets', 'admin:access', 'admin:users:view');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'BILLING_ADMIN'
  AND p.name IN ('app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage', 'admin:access');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'OPERATIONS_AGENT'
  AND p.name IN ('app:access', 'profile:view', 'profile:edit', 'operations:manage', 'admin:access');

INSERT IGNORE INTO users (id, uuid, username, email, password_hash, subscription_tier, subscription_status) VALUES
  (1, '00000000-0000-0000-0000-000000000001', 'admin', 'admin@boardstack.local', '$2b$10$B08DaMljR5e14RA5LJroxusmoNIwlSgeomJK2X76p2Zou.g6ZuLRG', 'pro', 'active'),
  (2, '00000000-0000-0000-0000-000000000002', 'user', 'user@boardstack.local', '$2b$10$T9IueNatLVZAIaYnsCNMeeWxBFODJITIvAB4Wjhm1jiB6AaxeHboy', 'free', 'active');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT 1, id FROM roles WHERE name = 'SUPER_ADMIN';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT 2, id FROM roles WHERE name = 'USER';

