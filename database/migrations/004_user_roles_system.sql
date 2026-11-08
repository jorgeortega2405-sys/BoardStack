-- ==============================================================================
-- Migración 004: Sistema de Roles, Permisos y User Roles
-- ==============================================================================

USE boardpdf_db;

ALTER TABLE roles 
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NOT NULL DEFAULT '' AFTER name,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'platform' AFTER description,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD INDEX IF NOT EXISTS idx_role_category (category);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_user_roles_user (user_id),
  INDEX idx_user_roles_role (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, display_name, description, category) VALUES
('SUPER_ADMIN', 'Super Admin', 'Acceso excepcional a toda la plataforma.', 'platform'),
('PLATFORM_ADMIN', 'Platform Admin', 'Administración general de la plataforma.', 'platform'),
('SECURITY_ADMIN', 'Security Admin', 'IAM, MFA, SSO, sesiones, políticas de seguridad.', 'platform'),
('IAM_ADMIN', 'IAM Admin', 'Usuarios, grupos, roles, permisos y provisioning.', 'platform'),
('COMPLIANCE_ADMIN', 'Compliance Admin', 'Compliance, retención, controles regulatorios.', 'platform'),
('AUDITOR', 'Auditor', 'Acceso prácticamente global de solo lectura.', 'platform'),
('READ_ONLY_ADMIN', 'Read-Only Admin', 'Administración/diagnóstico de solo lectura.', 'platform'),
('SUPPORT_L1', 'Support L1', 'Soporte básico y resolución de incidencias comunes.', 'support'),
('SUPPORT_L2', 'Support L2', 'Soporte técnico avanzado.', 'support'),
('SUPPORT_L3', 'Support L3', 'Soporte técnico/infraestructura avanzado.', 'support'),
('SUPPORT_MANAGER', 'Support Manager', 'Supervisión del equipo de soporte.', 'support'),
('CUSTOMER_SUCCESS', 'Customer Success', 'Gestión de clientes, cuentas y adopción.', 'support'),
('INCIDENT_MANAGER', 'Incident Manager', 'Coordinación de incidentes críticos.', 'support'),
('ENGINEER', 'Engineer', 'Herramientas técnicas y diagnóstico.', 'engineering'),
('SENIOR_ENGINEER', 'Senior Engineer', 'Acceso técnico más amplio.', 'engineering'),
('DEVOPS', 'DevOps', 'Infraestructura, deployments y servicios.', 'engineering'),
('SRE', 'SRE', 'Observabilidad, disponibilidad y operaciones de producción.', 'engineering'),
('RELEASE_MANAGER', 'Release Manager', 'Releases y deployments controlados.', 'engineering'),
('DATA_ANALYST', 'Data Analyst', 'Analytics y reportes.', 'data'),
('DATA_ENGINEER', 'Data Engineer', 'Pipelines y procesamiento de datos.', 'data'),
('DATA_ADMIN', 'Data Admin', 'Administración de datasets/recursos de datos.', 'data'),
('PRIVACY_ADMIN', 'Privacy Admin', 'Privacidad, solicitudes de datos y políticas.', 'data'),
('DATA_AUDITOR', 'Data Auditor', 'Auditoría de acceso y uso de datos.', 'data'),
('BILLING_AGENT', 'Billing Agent', 'Consultas y operaciones de billing.', 'finance'),
('BILLING_MANAGER', 'Billing Manager', 'Gestión financiera avanzada.', 'finance'),
('FINANCE_ADMIN', 'Finance Admin', 'Configuración financiera.', 'finance'),
('REFUNDS_ADMIN', 'Refunds Admin', 'Refunds/credits con permisos específicos.', 'finance'),
('OPERATIONS_AGENT', 'Operations Agent', 'Operaciones diarias.', 'operations'),
('OPERATIONS_MANAGER', 'Operations Manager', 'Supervisión operacional.', 'operations'),
('WORKFLOW_ADMIN', 'Workflow Admin', 'Workflows, jobs y procesos.', 'operations'),
('SYSTEM_OPERATOR', 'System Operator', 'Operaciones sensibles sobre sistemas.', 'operations'),
('HR_MANAGER', 'HR Manager', 'Gestión de recursos humanos, contrataciones y compensación.', 'operations'),
('HR_RECRUITER', 'HR Recruiter', 'Reclutamiento y altas de personal.', 'operations'),
('USER', 'User', 'Standard platform user.', 'general')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  category = VALUES(category);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'USER' AND p.name = 'tools:access';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name IN ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON (r.name = u.role OR (u.role IS NULL AND r.name = 'USER'));
