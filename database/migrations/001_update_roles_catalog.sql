SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roles'
    AND COLUMN_NAME = 'category'
);
SET @add_col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE roles ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT ''general'' AFTER description',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @add_col_sql;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roles'
    AND INDEX_NAME = 'idx_roles_category'
);
SET @add_idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE roles ADD INDEX idx_roles_category (category)',
  'SELECT 1'
);
PREPARE stmt_add_idx FROM @add_idx_sql;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

INSERT INTO roles (slug, name, description, category, level, is_default, is_global) VALUES
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
  ('USER', 'User', 'Standard platform user.', 'general', 10, TRUE, FALSE)
ON DUPLICATE KEY UPDATE
  slug = VALUES(slug),
  name = VALUES(name),
  description = VALUES(description),
  category = VALUES(category),
  level = VALUES(level),
  is_default = VALUES(is_default),
  is_global = VALUES(is_global);

INSERT IGNORE INTO user_global_roles (user_id, role_id, assigned_at, assigned_by)
SELECT ugr.user_id, target.id, ugr.assigned_at, ugr.assigned_by
FROM user_global_roles ugr
INNER JOIN roles legacy ON legacy.id = ugr.role_id AND LOWER(legacy.slug) IN ('superadministrator', 'administrator', 'moderator')
INNER JOIN roles target ON BINARY target.slug = CASE LOWER(legacy.slug)
  WHEN 'superadministrator' THEN 'SUPER_ADMIN'
  WHEN 'administrator' THEN 'PLATFORM_ADMIN'
  WHEN 'moderator' THEN 'SUPPORT_L2'
END;

INSERT IGNORE INTO user_app_roles (user_id, app_id, role_id, assigned_at, assigned_by)
SELECT uar.user_id, uar.app_id, target.id, uar.assigned_at, uar.assigned_by
FROM user_app_roles uar
INNER JOIN roles legacy ON legacy.id = uar.role_id AND LOWER(legacy.slug) IN ('superadministrator', 'administrator', 'moderator')
INNER JOIN roles target ON BINARY target.slug = CASE LOWER(legacy.slug)
  WHEN 'superadministrator' THEN 'SUPER_ADMIN'
  WHEN 'administrator' THEN 'PLATFORM_ADMIN'
  WHEN 'moderator' THEN 'SUPPORT_L2'
END;

DELETE FROM roles WHERE LOWER(slug) IN ('superadministrator', 'administrator', 'moderator');

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
