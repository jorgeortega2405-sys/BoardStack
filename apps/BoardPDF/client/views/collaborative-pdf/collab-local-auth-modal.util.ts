import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';

function openLocalAuthModal(
  docId: string,
  onStoreCurrentAsPending: () => void,
  onClose?: () => void
): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop collab-share-backdrop';
  modal.setAttribute('data-ref', 'collab-local-auth-backdrop');

  modal.innerHTML = `
    <div class="modal-container collab-share-container" data-ref="collab-local-auth-container" style="max-width: 440px;">
      <div class="collab-share-card" data-ref="collab-local-auth-card">
        <div class="collab-share-header">
          <h2 class="collab-share-title">Compartir este diseño</h2>
          <button type="button" class="collab-share-close-btn" data-ref="btn-close-local-auth-modal" aria-label="Cerrar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div style="text-align: center; padding: 12px 4px 20px 4px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--surface-secondary, #f3f4f6); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            <svg class="component-icon" style="width: 28px; height: 28px; color: var(--primary, #2563eb);" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
          </div>
          <p style="font-size: 14px; color: var(--text-secondary, #4b5563); line-height: 1.5; margin: 0 0 20px 0;">
            Tu diseño se encuentra guardado en este navegador. Para compartir un enlace de colaboración en tiempo real o invitar personas, guarda tu trabajo en tu cuenta de BoardPDF.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="component-button component-button--black component-button--h44" data-ref="btn-local-modal-register" style="width: 100%;">
              Crear cuenta gratis y guardar
            </button>
            <button type="button" class="component-button component-button--ghost component-button--h44" data-ref="btn-local-modal-login" style="width: 100%;">
              Ya tengo cuenta, iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  renderIcons(modal);

  const closeModal = () => {
    modal.remove();
    onClose?.();
  };

  modal.querySelector('[data-ref="btn-close-local-auth-modal"]')?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  modal.querySelector('[data-ref="btn-local-modal-register"]')?.addEventListener('click', () => {
    onStoreCurrentAsPending();
    closeModal();
    navigate(`/register?redirect=${encodeURIComponent(`/d/${docId}`)}`);
  });

  modal.querySelector('[data-ref="btn-local-modal-login"]')?.addEventListener('click', () => {
    onStoreCurrentAsPending();
    closeModal();
    navigate(`/login?redirect=${encodeURIComponent(`/d/${docId}`)}`);
  });

  return modal;
}

export { openLocalAuthModal };
