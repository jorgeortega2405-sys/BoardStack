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
