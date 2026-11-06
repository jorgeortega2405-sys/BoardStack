-- ==============================================================================
-- BoardStack / BoardPDF - Registro y Control de Archivos Temporales (AWS S3)
-- ==============================================================================

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
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
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
  INDEX idx_user_storage (storage_used_bytes)
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
  title VARCHAR(255) NOT NULL DEFAULT 'Documento sin título',
  content_json LONGTEXT NOT NULL,
  pdf_filename VARCHAR(255) NULL,
  page_count INT UNSIGNED NOT NULL DEFAULT 1,
  access_level ENUM('restricted', 'anyone_with_link') NOT NULL DEFAULT 'restricted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_docs (user_id),
  INDEX idx_doc_folder (folder_id),
  INDEX idx_created_at (created_at),
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

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_role_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_tier_permissions (
  tier VARCHAR(50) NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tier, permission_id),
  INDEX idx_sub_tier (tier),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 2. Organization, Members, Invitations & SSO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id INT NOT NULL,
  logo_url VARCHAR(512) NULL,
  domain VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_owner (owner_id),
  INDEX idx_org_slug (slug),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_user (organization_id, user_id),
  INDEX idx_org_members_user (user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  token VARCHAR(64) NOT NULL UNIQUE,
  invited_by INT NOT NULL,
  status ENUM('pending', 'accepted', 'revoked', 'expired') NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_invitations_token (token),
  INDEX idx_org_invitations_email (email),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_sso_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  entity_id VARCHAR(512) NOT NULL DEFAULT '',
  acs_url VARCHAR(512) NOT NULL DEFAULT '',
  idp_sso_url VARCHAR(512) NULL,
  idp_certificate TEXT NULL,
  idp_metadata_xml MEDIUMTEXT NULL,
  allow_unlinked_users BOOLEAN NOT NULL DEFAULT FALSE,
  enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 3. Initial Seeds: Permissions & Tier Grants
-- ==============================================================================

INSERT IGNORE INTO permissions (name, description, category) VALUES
  ('tools:access', 'Acceso general a herramientas de procesamiento PDF', 'tools'),
  ('subscription:feature:pro', 'Acceso a características Pro', 'subscription'),
  ('subscription:feature:business', 'Acceso a características Business y trabajo colaborativo', 'subscription'),
  ('subscription:feature:enterprise', 'Acceso a infraestructura y seguridad corporativa Enterprise', 'subscription'),
  ('subscription:feature:organization', 'Acceso completo al módulo y dashboard de Organización', 'organization'),
  ('subscription:feature:sso', 'Acceso a configuración de inicio de sesión único (SSO)', 'organization'),
  ('org:view', 'Visualizar dashboard e información general de la organización', 'organization'),
  ('org:manage', 'Modificar parámetros de la organización', 'organization'),
  ('members:view', 'Listar miembros e invitaciones de la organización', 'organization'),
  ('members:invite', 'Invitar nuevos miembros a la organización', 'organization'),
  ('members:modify_role', 'Modificar roles de miembros de la organización', 'organization'),
  ('members:remove', 'Remover miembros de la organización', 'organization'),
  ('sso:view', 'Visualizar configuración SAML/SSO de la organización', 'organization'),
  ('sso:manage', 'Actualizar y activar/desactivar configuración SAML/SSO', 'organization');

INSERT IGNORE INTO roles (name, description) VALUES
  ('USER', 'Usuario estándar registrado'),
  ('ADMIN', 'Administrador de plataforma');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'USER' AND p.name = 'tools:access';

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'enterprise', id FROM permissions WHERE name IN (
  'subscription:feature:pro',
  'subscription:feature:business',
  'subscription:feature:enterprise',
  'subscription:feature:organization',
  'subscription:feature:sso',
  'org:view',
  'org:manage',
  'members:view',
  'members:invite',
  'members:modify_role',
  'members:remove',
  'sso:view',
  'sso:manage'
);

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'business', id FROM permissions WHERE name IN (
  'subscription:feature:pro',
  'subscription:feature:business'
);

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'pro', id FROM permissions WHERE name IN (
  'subscription:feature:pro'
);

CREATE TABLE IF NOT EXISTS education_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  institutional_email VARCHAR(255) NOT NULL,
  institution_domain VARCHAR(100) NOT NULL,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  status ENUM('active', 'expired', 'revoked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_edu_claims_email (institutional_email),
  INDEX idx_edu_claims_domain (institution_domain),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'edu_individual', id FROM permissions WHERE name IN (
  'subscription:feature:pro'
);

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'edu_school', id FROM permissions WHERE name IN (
  'subscription:feature:pro',
  'subscription:feature:business',
  'subscription:feature:organization',
  'subscription:feature:sso',
  'org:view',
  'org:manage',
  'members:view',
  'members:invite',
  'members:modify_role',
  'members:remove',
  'sso:view',
  'sso:manage'
);

INSERT IGNORE INTO subscription_tier_permissions (tier, permission_id)
SELECT 'edu_university', id FROM permissions WHERE name IN (
  'subscription:feature:pro',
  'subscription:feature:business',
  'subscription:feature:enterprise',
  'subscription:feature:organization',
  'subscription:feature:sso',
  'org:view',
  'org:manage',
  'members:view',
  'members:invite',
  'members:modify_role',
  'members:remove',
  'sso:view',
  'sso:manage'
);

-- ==============================================================================
-- Solicitudes de Contacto y Ventas Institucionales / Enterprise
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sales_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('enterprise', 'education_school', 'education_university') NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  organization_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(150) NULL,
  role_type VARCHAR(100) NULL,
  organization_size VARCHAR(100) NULL,
  primary_use_case VARCHAR(255) NULL,
  message TEXT NULL,
  status ENUM('new', 'contacted', 'qualified', 'closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_inquiries_email (email),
  INDEX idx_sales_inquiries_cat (category),
  INDEX idx_sales_inquiries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- Servicios en la Nube Vinculados (Google Drive, Dropbox)
-- ==============================================================================

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
