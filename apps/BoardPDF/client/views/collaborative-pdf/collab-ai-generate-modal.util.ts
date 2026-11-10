import { openModal } from '../../components/modal.component.js';
import { currentUser, fetchAiTokenBalance } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';

interface CollabAiGeneratePayload {
  mode: 'append' | 'replace';
  prompt: string;
}

interface CollabAiGenerateOptions {
  hasExistingContent: boolean;
  onSubmit: (payload: CollabAiGeneratePayload) => Promise<void> | void;
}

const MIN_GENERATE_TOKENS = 3;

function openCollabAiGenerateModal(options: CollabAiGenerateOptions): void {
  const root = document.createElement('div');
  root.className = 'collab-ai-modal';
  root.setAttribute('data-ref', 'collab-ai-modal');

  const tokensRow = document.createElement('div');
  tokensRow.className = 'collab-ai-modal__tokens-row';

  const tokenPill = document.createElement('div');
  tokenPill.className = 'collab-ai-token-pill';
  tokenPill.setAttribute('data-ref', 'ai-token-balance-pill');

  const tokenIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tokenIcon.setAttribute('class', 'component-icon');
  tokenIcon.setAttribute('aria-hidden', 'true');
  const tokenUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  tokenUse.setAttribute('href', '/icons.svg#bolt');
  tokenIcon.appendChild(tokenUse);

  const tokenText = document.createElement('span');
  tokenText.setAttribute('data-ref', 'txt-ai-token-balance');
  if (typeof currentUser?.ai_tokens_balance === 'number') {
    tokenText.textContent = t('collaborative.ai_tokens_available', { balance: String(currentUser.ai_tokens_balance) });
  } else {
    tokenText.textContent = t('collaborative.ai_tokens_loading');
  }

  tokenPill.appendChild(tokenIcon);
  tokenPill.appendChild(tokenText);
  tokensRow.appendChild(tokenPill);
  root.appendChild(tokensRow);

  const fieldLabel = document.createElement('label');
  fieldLabel.className = 'field field--textarea collab-ai-modal__field';

  const textarea = document.createElement('textarea');
  textarea.className = 'field__textarea collab-ai-modal__textarea';
  textarea.setAttribute('data-ref', 'textarea-ai-prompt');
  textarea.rows = 5;
  textarea.maxLength = 4000;
  textarea.placeholder = ' ';

  const floatingLabel = document.createElement('span');
  floatingLabel.className = 'field__label';
  floatingLabel.textContent = t('collaborative.ai_prompt_label');

  fieldLabel.appendChild(textarea);
  fieldLabel.appendChild(floatingLabel);
  root.appendChild(fieldLabel);

  const exampleHint = document.createElement('p');
  exampleHint.className = 'collab-ai-modal__hint';
  exampleHint.textContent = t('collaborative.ai_prompt_placeholder');
  root.appendChild(exampleHint);

  let selectedMode: 'append' | 'replace' = options.hasExistingContent ? 'append' : 'replace';

  if (options.hasExistingContent) {
    const modeGroup = document.createElement('div');
    modeGroup.className = 'collab-ai-mode-group';

    const modeHeading = document.createElement('span');
    modeHeading.className = 'collab-ai-mode-label';
    modeHeading.textContent = t('collaborative.ai_mode_label');
    modeGroup.appendChild(modeHeading);

    const modeOptions = document.createElement('div');
    modeOptions.className = 'collab-ai-mode-options';

    const buildModeOption = (value: 'append' | 'replace', labelText: string): HTMLLabelElement => {
      const optLabel = document.createElement('label');
      optLabel.className = 'collab-ai-mode-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'collab-ai-mode-radio';
      radio.name = 'collab-ai-mode';
      radio.value = value;
      radio.checked = selectedMode === value;
      radio.setAttribute('data-ref', `radio-ai-mode-${value}`);
      radio.addEventListener('change', () => {
        if (radio.checked) {
          selectedMode = value;
        }
      });

      const span = document.createElement('span');
      span.textContent = labelText;

      optLabel.appendChild(radio);
      optLabel.appendChild(span);
      return optLabel;
    };

    modeOptions.appendChild(buildModeOption('append', t('collaborative.ai_mode_append')));
    modeOptions.appendChild(buildModeOption('replace', t('collaborative.ai_mode_replace')));
    modeGroup.appendChild(modeOptions);
    root.appendChild(modeGroup);
  }

  const costHint = document.createElement('p');
  costHint.className = 'collab-ai-cost-hint';
  costHint.textContent = t('collaborative.ai_tokens_cost_hint', { min: String(MIN_GENERATE_TOKENS) });
  root.appendChild(costHint);

  renderIcons(root);

  let isMounted = true;
  void fetchAiTokenBalance().then((info) => {
    if (!isMounted || !info) return;
    tokenText.textContent = t('collaborative.ai_tokens_available', { balance: String(info.balance) });
  });

  const modal = openModal({
    bodyHtml: root,
    cancelText: t('common.cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('collaborative.ai_generate_btn'),
    description: t('collaborative.ai_modal_desc'),
    onClose: () => {
      isMounted = false;
    },
    onConfirm: (inst) => {
      const prompt = textarea.value.trim();
      if (!prompt) {
        inst.showError(t('collaborative.ai_prompt_required'));
        textarea.focus();
        return false;
      }
      inst.clearError();
      void options.onSubmit({
        mode: selectedMode,
        prompt,
      });
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'md',
    title: t('collaborative.ai_modal_title'),
  });

  textarea.addEventListener('input', () => {
    modal.clearError();
  });

  window.setTimeout(() => {
    textarea.focus();
  }, 60);
}

export { openCollabAiGenerateModal };
export type { CollabAiGenerateOptions, CollabAiGeneratePayload };
