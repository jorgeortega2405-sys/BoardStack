CREATE DATABASE IF NOT EXISTS boardstack_core CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boardstack_core;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  google_email VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  status ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret VARCHAR(255) NULL,
  two_factor_recovery_codes TEXT NULL,
  registration_ip VARCHAR(45) NULL,
  last_login_ip VARCHAR(45) NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_status (status)
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

CREATE TABLE IF NOT EXISTS verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type ENUM('register', 'password_reset', 'email_change') NOT NULL DEFAULT 'register',
  app_slug VARCHAR(50) NOT NULL DEFAULT 'app',
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
  INDEX idx_reset_email (email),
  INDEX idx_resets_cleanup (expires_at, used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'apps',
  base_url VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_apps_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_apps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  app_id INT NOT NULL,
  status ENUM('active', 'suspended', 'removed') NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_app (user_id, app_id),
  INDEX idx_ua_user (user_id),
  INDEX idx_ua_app (app_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  level INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_roles_slug (slug),
  INDEX idx_roles_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permissions_code (code)
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

CREATE TABLE IF NOT EXISTS app_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  slug VARCHAR(64) NOT NULL,
  title_key VARCHAR(128) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'dashboard',
  required_permission_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_page (app_id, slug),
  INDEX idx_ap_app_active (app_id, is_active, sort_order),
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  FOREIGN KEY (required_permission_id) REFERENCES permissions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_global_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT NULL,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_ugr_user (user_id),
  INDEX idx_ugr_role (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_app_roles (
  user_id INT NOT NULL,
  app_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT NULL,
  PRIMARY KEY (user_id, app_id, role_id),
  INDEX idx_uar_user_app (user_id, app_id),
  INDEX idx_uar_role (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_app_permissions (
  user_id INT NOT NULL,
  app_id INT NOT NULL,
  permission_id INT NOT NULL,
  effect ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
  assigned_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_id, permission_id),
  INDEX idx_uap_user_app (user_id, app_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO apps (slug, name, description, icon, base_url, sort_order, is_active) VALUES
  ('app', 'BoardStack App', 'Primary BoardStack web application', 'apps', 'http://localhost:3000', 10, TRUE);

INSERT IGNORE INTO roles (slug, name, description, category, level, is_default, is_global) VALUES
  ('SUPER_ADMIN', 'Super Admin', 'Exceptional access across the entire platform.', 'platform', 100, FALSE, TRUE),
  ('PLATFORM_ADMIN', 'Platform Admin', 'General platform administration.', 'platform', 90, FALSE, FALSE),
  ('SECURITY_ADMIN', 'Security Admin', 'IAM, MFA, SSO, sessions, and security policies.', 'platform', 85, FALSE, FALSE),
  ('IAM_ADMIN', 'IAM Admin', 'Users, groups, roles, permissions, and provisioning.', 'platform', 80, FALSE, FALSE),
  ('DEVOPS', 'DevOps', 'Infrastructure, deployments, and services.', 'engineering', 75, FALSE, FALSE),
  ('PRIVACY_ADMIN', 'Privacy Admin', 'Privacy, data requests, and compliance policies.', 'data', 70, FALSE, FALSE),
  ('FINANCE_ADMIN', 'Finance Admin', 'Financial configuration and oversight.', 'finance', 70, FALSE, FALSE),
  ('REFUNDS_ADMIN', 'Refunds Admin', 'Refunds and credits with specific permissions.', 'finance', 55, FALSE, FALSE),
  ('READ_ONLY_ADMIN', 'Read-Only Admin', 'Read-only administration and diagnostics.', 'platform', 50, FALSE, FALSE),
  ('SUPPORT_L2', 'Support L2', 'Advanced technical support.', 'support', 45, FALSE, FALSE),
  ('CUSTOMER_SUCCESS', 'Customer Success', 'Customer management, accounts, and adoption.', 'support', 40, FALSE, FALSE),
  ('BILLING_AGENT', 'Billing Agent', 'Billing inquiries and operations.', 'finance', 40, FALSE, FALSE),
  ('DATA_ANALYST', 'Data Analyst', 'Analytics and reporting.', 'data', 35, FALSE, FALSE),
  ('SUPPORT_L1', 'Support L1', 'Basic support and common issue resolution.', 'support', 30, FALSE, FALSE),
  ('USER', 'User', 'Standard platform user.', 'general', 10, TRUE, FALSE);

INSERT IGNORE INTO permissions (code, name, description, category) VALUES
  ('app:access', 'Application Access', 'General access to the application', 'general'),
  ('profile:view', 'View Profile', 'View own user profile and settings', 'profile'),
  ('profile:edit', 'Edit Profile', 'Update own user profile and settings', 'profile'),
  ('billing:view', 'View Billing', 'View billing and subscription details', 'billing'),
  ('billing:manage', 'Manage Billing', 'Manage subscriptions and payment methods', 'billing'),
  ('admin:overview:view', 'Admin Overview', 'View application admin overview page', 'admin'),
  ('admin:users:view', 'Admin View Users', 'View application user management page', 'admin'),
  ('admin:users:manage', 'Admin Manage Users', 'Manage and moderate application users', 'admin'),
  ('admin:rooms:view', 'Admin View Rooms', 'View application rooms management page', 'admin'),
  ('admin:billing:view', 'Admin View Billing', 'View application billing administration page', 'admin'),
  ('admin:roles:manage', 'Admin Manage Roles', 'Manage application roles and permissions', 'admin'),
  ('admin:sales:view', 'Admin View Sales Leads', 'View enterprise sales inquiries in admin panel', 'admin'),
  ('admin:sales:manage', 'Admin Manage Sales & Enterprise', 'Contact sales leads and provision Enterprise subscriptions', 'admin'),
  ('admin:settings:view', 'Admin View Settings', 'View application configuration page', 'admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'USER'
  AND p.code IN ('app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'SUPPORT_L1'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:rooms:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'DATA_ANALYST'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:rooms:view', 'admin:billing:view', 'admin:sales:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'CUSTOMER_SUCCESS'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:sales:view', 'admin:sales:manage'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'BILLING_AGENT'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:billing:view', 'admin:sales:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'SUPPORT_L2'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:users:manage', 'admin:rooms:view', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'READ_ONLY_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:rooms:view', 'admin:billing:view', 'admin:sales:view', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'REFUNDS_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:billing:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'FINANCE_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:billing:view', 'admin:sales:view', 'admin:sales:manage'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'PRIVACY_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:users:manage', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'DEVOPS'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:rooms:view', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'IAM_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:users:manage', 'admin:roles:manage', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'SECURITY_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:users:manage', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'PLATFORM_ADMIN'
  AND p.code IN (
    'app:access', 'profile:view', 'profile:edit', 'billing:view', 'billing:manage',
    'admin:overview:view', 'admin:users:view', 'admin:users:manage', 'admin:rooms:view', 'admin:billing:view', 'admin:sales:view', 'admin:sales:manage', 'admin:settings:view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'SUPER_ADMIN';

INSERT IGNORE INTO app_pages (app_id, slug, title_key, icon, required_permission_id, sort_order, is_active)
SELECT a.id, 'dashboard', 'admin.pages.dashboard', 'dashboard', p.id, 10, TRUE
FROM apps a INNER JOIN permissions p ON p.code = 'admin:overview:view' WHERE a.slug = 'app';

INSERT IGNORE INTO app_pages (app_id, slug, title_key, icon, required_permission_id, sort_order, is_active)
SELECT a.id, 'users', 'admin.pages.users', 'groups', p.id, 20, TRUE
FROM apps a INNER JOIN permissions p ON p.code = 'admin:users:view' WHERE a.slug = 'app';

INSERT IGNORE INTO app_pages (app_id, slug, title_key, icon, required_permission_id, sort_order, is_active)
SELECT a.id, 'sales', 'admin.pages.sales', 'business_center', p.id, 30, TRUE
FROM apps a INNER JOIN permissions p ON p.code = 'admin:sales:view' WHERE a.slug = 'app';

INSERT IGNORE INTO users (id, uuid, username, email, password_hash, status) VALUES
  (1, '00000000-0000-0000-0000-000000000001', 'admin', 'admin@boardstack.local', '$2b$10$B08DaMljR5e14RA5LJroxusmoNIwlSgeomJK2X76p2Zou.g6ZuLRG', 'active'),
  (2, '00000000-0000-0000-0000-000000000002', 'user', 'user@boardstack.local', '$2b$10$T9IueNatLVZAIaYnsCNMeeWxBFODJITIvAB4Wjhm1jiB6AaxeHboy', 'active');

INSERT IGNORE INTO user_preferences (user_id) VALUES (1), (2);

INSERT IGNORE INTO user_apps (user_id, app_id, status)
SELECT 1, id, 'active' FROM apps WHERE slug = 'app';

INSERT IGNORE INTO user_apps (user_id, app_id, status)
SELECT 2, id, 'active' FROM apps WHERE slug = 'app';

INSERT IGNORE INTO user_global_roles (user_id, role_id)
SELECT 1, id FROM roles WHERE slug = 'SUPER_ADMIN';

INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id)
SELECT 2, a.id, r.id
FROM apps a
CROSS JOIN roles r
WHERE a.slug = 'app' AND r.slug = 'USER';
