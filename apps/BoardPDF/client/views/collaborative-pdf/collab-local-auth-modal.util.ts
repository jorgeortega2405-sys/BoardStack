import { openCollabLocalAuthModal } from '../../components/modal.component.js';

function openLocalAuthModal(
  docId: string,
  onStoreCurrentAsPending: () => void,
  onClose?: () => void
): HTMLElement {
  const modal = openCollabLocalAuthModal({
    docId,
    onClose,
    onStoreCurrentAsPending,
  });
  return modal.backdrop;
}

export { openLocalAuthModal };
