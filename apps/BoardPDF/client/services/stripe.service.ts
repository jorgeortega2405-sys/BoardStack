let stripePromise: Promise<any> | null = null;

export function loadStripeSdk(publishableKey: string): Promise<any> {
  const win = window as any;
  if (win.Stripe && publishableKey) {
    return Promise.resolve(win.Stripe(publishableKey));
  }

  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      if (!publishableKey) {
        reject(new Error('Clave pública de Stripe ausente.'));
        return;
      }

      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (existingScript) {
        if (win.Stripe) {
          resolve(win.Stripe(publishableKey));
        } else {
          existingScript.addEventListener('load', () => {
            resolve(win.Stripe(publishableKey));
          });
          existingScript.addEventListener('error', () => {
            stripePromise = null;
            reject(new Error('Error al cargar Stripe.js.'));
          });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        resolve(win.Stripe(publishableKey));
      };
      script.onerror = () => {
        stripePromise = null;
        reject(new Error('No se pudo cargar Stripe.js.'));
      };
      document.head.appendChild(script);
    });
  }

  return stripePromise;
}

export function getStripeAppearance(): any {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.documentElement.classList.contains('dark-theme');

  return {
    labels: 'above',
    rules: {
      '.Block': {
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
        borderRadius: '12px',
        boxShadow: 'none',
      },
      '.Input': {
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
        borderRadius: '12px',
        boxShadow: 'none',
        color: isDark ? '#f4f4f5' : '#09090b',
        fontSize: '14px',
        padding: '12px 14px',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      },
      '.Input:hover': {
        borderColor: isDark ? '#3f3f46' : '#d4d4d8',
      },
      '.Input:focus': {
        borderColor: isDark ? '#ffffff' : '#09090b',
        boxShadow: `0 0 0 1px ${isDark ? '#ffffff' : '#09090b'}`,
      },
      '.Input--invalid': {
        borderColor: '#ef4444',
        boxShadow: '0 0 0 1px #ef4444',
        color: '#ef4444',
      },
      '.Label': {
        color: isDark ? '#a1a1aa' : '#52525b',
        fontSize: '13px',
        fontWeight: '500',
        marginBottom: '6px',
      },
      '.Tab': {
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
        borderRadius: '10px',
        color: isDark ? '#f4f4f5' : '#09090b',
      },
      '.Tab:hover': {
        borderColor: isDark ? '#3f3f46' : '#d4d4d8',
      },
      '.Tab--selected': {
        backgroundColor: isDark ? '#27272a' : '#f4f4f5',
        borderColor: isDark ? '#ffffff' : '#09090b',
        boxShadow: 'none',
        color: isDark ? '#ffffff' : '#09090b',
      },
    },
    theme: isDark ? 'night' : 'stripe',
    variables: {
      borderRadius: '12px',
      colorBackground: isDark ? '#18181b' : '#ffffff',
      colorDanger: '#ef4444',
      colorPrimary: isDark ? '#ffffff' : '#09090b',
      colorText: isDark ? '#f4f4f5' : '#09090b',
      colorTextPlaceholder: isDark ? '#71717a' : '#a1a1aa',
      colorTextSecondary: isDark ? '#a1a1aa' : '#52525b',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      fontSizeBase: '14px',
      spacingUnit: '4px',
    },
  };
}
