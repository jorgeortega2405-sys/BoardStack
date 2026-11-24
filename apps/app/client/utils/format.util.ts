function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const normalizedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, normalizedIndex)).toFixed(1))} ${sizes[normalizedIndex]}`;
}

function formatDate(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

function formatCurrency(amount: number, currency = 'USD'): string {
  const formattedNumber = Number(amount || 0).toFixed(2);
  return `${currency} $${formattedNumber}`;
}

function getFileIcon(name: string): string {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'compress';
  if (['ts', 'js', 'json', 'html', 'css', 'rs', 'py', 'sql', 'sh'].includes(ext)) return 'code';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'psd', 'ai', 'fig'].includes(ext)) return 'brush';
  return 'description';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export {
  arrayBufferToBase64,
  base64ToUint8Array,
  formatBytes,
  formatCurrency,
  formatDate,
  getFileIcon
};