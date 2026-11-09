import { getLocalDraft, saveLocalDraft } from './collab-local-draft.util.js';
import { t } from '../services/i18n.service.js';

interface LocalProjectFolder {
  color?: string | null;
  created_at: string;
  document_count?: number;
  file_count?: number;
  folder_type: 'project' | 'uploads' | 'upload_folder';
  id: string;
  name: string;
  parent_id?: string | null;
  updated_at: string;
  user_id?: null;
}

const LOCAL_FOLDERS_KEY = 'boardpdf_local_project_folders';
const DEFAULT_LOCAL_UPLOADS_ID = 'local-uploads-folder-uuid';

function getLocalUploadsFolder(): LocalProjectFolder {
  const folders = getStoredLocalFolders();
  let uploads = folders.find((f) => f.folder_type === 'uploads');
  if (!uploads) {
    uploads = {
      color: null,
      created_at: new Date().toISOString(),
      document_count: 0,
      file_count: 0,
      folder_type: 'uploads',
      id: DEFAULT_LOCAL_UPLOADS_ID,
      name: 'Subidos',
      parent_id: null,
      updated_at: new Date().toISOString(),
      user_id: null,
    };
    folders.unshift(uploads);
    saveStoredLocalFolders(folders);
  }
  return uploads;
}

function getStoredLocalFolders(): LocalProjectFolder[] {
  try {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalProjectFolder[];
    }
  } catch {}
  return [];
}

function saveStoredLocalFolders(folders: LocalProjectFolder[]): void {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch {}
}

function listLocalFolders(parentId?: string | null, folderType?: 'project' | 'upload_folder'): { folders: LocalProjectFolder[]; uploadsFolder: LocalProjectFolder } {
  const uploadsFolder = getLocalUploadsFolder();
  const allFolders = getStoredLocalFolders();

  const filtered = allFolders.filter((f) => {
    if (f.folder_type === 'uploads') return false;
    if (parentId !== undefined && f.parent_id !== parentId) return false;
    if (folderType && f.folder_type !== folderType) return false;
    return true;
  });

  return {
    folders: filtered,
    uploadsFolder,
  };
}

function getLocalFolderById(id: string): LocalProjectFolder | null {
  if (id === DEFAULT_LOCAL_UPLOADS_ID) {
    return getLocalUploadsFolder();
  }
  const folders = getStoredLocalFolders();
  return folders.find((f) => f.id === id) || null;
}

function createLocalFolder(payload: {
  color?: string | null;
  folderType?: 'project' | 'upload_folder';
  name: string;
  parentId?: string | null;
}): LocalProjectFolder {
  const cleanName = (payload.name || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const uploadsFolder = getLocalUploadsFolder();
  const folderType = payload.folderType || (payload.parentId ? 'upload_folder' : 'project');

  if (folderType === 'project' && payload.parentId) {
    throw new Error(t('ui.no_se_pueden_crear_subcarpetas_dentro_de'));
  }

  const parentId = folderType === 'upload_folder' ? (payload.parentId || uploadsFolder.id) : null;
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fld_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  const folder: LocalProjectFolder = {
    color: payload.color || null,
    created_at: new Date().toISOString(),
    document_count: 0,
    file_count: 0,
    folder_type: folderType,
    id: newId,
    name: cleanName,
    parent_id: parentId,
    updated_at: new Date().toISOString(),
    user_id: null,
  };

  const folders = getStoredLocalFolders();
  folders.push(folder);
  saveStoredLocalFolders(folders);

  return folder;
}

function renameLocalFolder(id: string, newName: string): LocalProjectFolder {
  const cleanName = (newName || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la carpeta no puede estar vacío.');
  }

  const folders = getStoredLocalFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) {
    throw new Error('Carpeta no encontrada.');
  }
  if (folder.folder_type === 'uploads') {
    throw new Error(t('ui.no_se_puede_renombrar_la_carpeta_de_subi'));
  }

  folder.name = cleanName;
  folder.updated_at = new Date().toISOString();
  saveStoredLocalFolders(folders);
  return folder;
}

function deleteLocalFolder(id: string): boolean {
  let folders = getStoredLocalFolders();
  const target = folders.find((f) => f.id === id);
  if (!target || target.folder_type === 'uploads') {
    return false;
  }

  folders = folders.filter((f) => f.id !== id);
  saveStoredLocalFolders(folders);
  return true;
}

function moveDocToLocalFolder(docId: string, folderId: string | null): boolean {
  const draft = getLocalDraft(docId);
  if (!draft) return false;
  saveLocalDraft(docId, { folderId: folderId || null });
  return true;
}

export { createLocalFolder, deleteLocalFolder, getLocalFolderById, getLocalUploadsFolder, listLocalFolders, moveDocToLocalFolder, renameLocalFolder };
export type { LocalProjectFolder };
