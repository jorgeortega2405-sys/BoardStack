import { showToast } from './toast.service.js';
import { t } from './i18n.service.js';

const DROPBOX_APP_KEY = (import.meta as any).env?.VITE_DROPBOX_APP_KEY || 'btnm84g2xk1h2qr';

declare const window: any;

let dropboxLoadingPromise: Promise<void> | null = null;

function loadDropboxScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Dropbox && typeof window.Dropbox.choose === 'function') {
    return Promise.resolve();
  }

  if (dropboxLoadingPromise) {
    return dropboxLoadingPromise;
  }

  dropboxLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://www.dropbox.com/static/api/2/dropins.js"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Dropbox && typeof window.Dropbox.init === 'function') {
          window.Dropbox.init({ appKey: DROPBOX_APP_KEY });
        }
        resolve();
      });
      existing.addEventListener('error', () => reject(new Error(t('ui.no_se_pudo_cargar_el_componente_de_dropb'))));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.Dropbox && typeof window.Dropbox.init === 'function') {
        window.Dropbox.init({ appKey: DROPBOX_APP_KEY });
      } else if (window.Dropbox) {
        window.Dropbox.appKey = DROPBOX_APP_KEY;
      }
      resolve();
    };
    script.onerror = () => reject(new Error(t('ui.no_se_pudo_cargar_el_componente_de_dropb')));
    document.head.appendChild(script);
  });

  return dropboxLoadingPromise;
}

async function pickDropboxFiles(options: {
  extensions?: string[];
  multiselect?: boolean;
} = {}): Promise<File[]> {
  try {
    await loadDropboxScript();
  } catch {
    showToast(t('ui.no_se_pudo_inicializar_la_conexion_con_d'), 'danger');
    return [];
  }

  if (!window.Dropbox || typeof window.Dropbox.choose !== 'function') {
    showToast(t('ui.el_selector_de_dropbox_no_esta_disponibl'), 'danger');
    return [];
  }

  return new Promise<File[]>((resolve) => {
    try {
      window.Dropbox.choose({
        cancel: () => {
          resolve([]);
        },
        extensions: options.extensions || ['.pdf'],
        folderselect: false,
        linkType: 'direct',
        multiselect: options.multiselect !== false,
        success: async (chosenFiles: any[]) => {
          const rawFiles = Array.isArray(chosenFiles) ? chosenFiles : [];
          if (rawFiles.length === 0) {
            resolve([]);
            return;
          }

          showToast(
            rawFiles.length === 1 ? 'Descargando archivo desde Dropbox...' : `Descargando ${rawFiles.length} archivos desde Dropbox...`,
            'info'
          );

          const downloadedFiles: File[] = [];

          for (const item of rawFiles) {
            try {
              let blob: Blob;

              try {
                const directRes = await fetch(item.link);
                if (!directRes.ok) {
                  throw new Error(t('ui.direct_download_error'));
                }
                blob = await directRes.blob();
              } catch {
                const proxyRes = await fetch('/api/tools/cloud/fetch-file', {
                  body: JSON.stringify({
                    filename: item.name,
                    url: item.link,
                  }),
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  method: 'POST',
                });

                if (!proxyRes.ok) {
                  throw new Error(`Proxy download error: ${proxyRes.status}`);
                }
                blob = await proxyRes.blob();
              }

              const filename = item.name || 'documento.pdf';
              const file = new File([blob], filename, {
                lastModified: Date.now(),
                type: 'application/pdf',
              });
              downloadedFiles.push(file);
            } catch {
              showToast(`No se pudo descargar «${item.name || 'documento'}» de Dropbox.`, 'danger');
            }
          }

          resolve(downloadedFiles);
        },
      });
    } catch {
      showToast(t('ui.error_al_abrir_la_ventana_de_dropbox'), 'danger');
      resolve([]);
    }
  });
}

async function exportToDropbox(downloadUrl: string, filename: string): Promise<void> {
  try {
    await loadDropboxScript();
  } catch {
    showToast(t('ui.no_se_pudo_inicializar_la_conexion_con_d'), 'danger');
    return;
  }

  const absoluteUrl = downloadUrl.startsWith('http') ? downloadUrl : `${window.location.origin}${downloadUrl}`;

  if (window.Dropbox && typeof window.Dropbox.save === 'function') {
    window.Dropbox.save(absoluteUrl, filename, {
      cancel: () => {},
      error: () => {
        showToast(t('ui.no_se_pudo_guardar_el_archivo_en_dropbox'), 'danger');
      },
      success: () => {
        showToast(t('toasts.dropbox_saved'), 'success');
      },
    });
  } else {
    showToast('El servicio de Dropbox no está disponible.', 'danger');
  }
}

export { DROPBOX_APP_KEY, exportToDropbox, loadDropboxScript, pickDropboxFiles };
