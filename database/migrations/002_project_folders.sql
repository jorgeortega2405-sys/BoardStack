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

ALTER TABLE collaborative_documents
  ADD COLUMN folder_id VARCHAR(64) NULL AFTER user_id,
  ADD INDEX idx_doc_folder (folder_id),
  ADD CONSTRAINT fk_doc_folder FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL;

ALTER TABLE user_storage_assets
  ADD COLUMN folder_id VARCHAR(64) NULL AFTER document_id,
  ADD INDEX idx_asset_folder (folder_id),
  ADD CONSTRAINT fk_asset_folder FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL;
