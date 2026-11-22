import crypto from 'crypto';
import { escapeHtml } from './html.util.js';
import { logger } from './logger.js';
import path from 'path';

type FileCategory = 'document' | 'image' | 'text' | 'any';

interface FileValidationOptions {
  allowedCategories?: FileCategory[];
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  minSizeBytes?: number;
  originalName: string;
}

interface SanitizedFile {
  buffer: Buffer;
  canonicalExtension: string;
  category: FileCategory;
  detectedMimeType: string;
  hash: string;
  originalName: string;
  safeFilename: string;
  size: number;
}

interface DetectedSignature {
  canonicalExtension: string;
  category: FileCategory;
  mimeType: string;
}

class FileSanitizationError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'FILE_SANITIZATION_FAILED') {
    super(message);
    this.name = 'FileSanitizationError';
    this.code = code;
  }
}

const DANGEROUS_BINARY_SIGNATURES: Array<{ name: string; offset: number; sig: number[] }> = [
  { name: 'Windows PE Executable / DLL', offset: 0, sig: [0x4d, 0x5a] },
  { name: 'Linux ELF Binary', offset: 0, sig: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'Mach-O Binary (macOS 32-bit)', offset: 0, sig: [0xfe, 0xed, 0xfa, 0xce] },
  { name: 'Mach-O Binary (macOS 64-bit)', offset: 0, sig: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: 'Mach-O Binary (reversed 32-bit)', offset: 0, sig: [0xce, 0xfa, 0xed, 0xfe] },
  { name: 'Mach-O Binary (reversed 64-bit)', offset: 0, sig: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'Java Class Bytecode', offset: 0, sig: [0xca, 0xfe, 0xba, 0xbe] },
  { name: 'Shell Script Shebang', offset: 0, sig: [0x23, 0x21] },
];

const MALICIOUS_SCRIPT_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*\/\s*script\b/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<\?php\b/i,
  /<\?=[\t\r\n ]*[\w$('"[\]][\t\r\n\x20-\x7e]{1,200}\?>/i,
  /<%[\t\r\n =@-]*[a-zA-Z_$][\w.$]+[\t\r\n\x20-\x7e]{1,200}%>/i,
  /\b(eval|passthru|shell_exec|system|popen|proc_open)\s*\(/i,
  /\bbase64_decode\s*\(/i,
  /<!ENTITY/i,
  /SYSTEM\s+["']file:/i,
  /SYSTEM\s+["']http:/i,
  /\bon(error|load|click|mouseover|focus|blur|change|submit)\s*=\s*["'a-zA-Z]/i,
];

function matchesSignature(buffer: Buffer, sig: number[], offset = 0): boolean {
  if (buffer.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buffer[offset + i] !== sig[i]) return false;
  }
  return true;
}

function detectFileSignature(buffer: Buffer): DetectedSignature | null {
  if (matchesSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return {
      canonicalExtension: '.png',
      category: 'image',
      mimeType: 'image/png',
    };
  }

  if (matchesSignature(buffer, [0xff, 0xd8, 0xff])) {
    return {
      canonicalExtension: '.jpg',
      category: 'image',
      mimeType: 'image/jpeg',
    };
  }

  if (
    matchesSignature(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    matchesSignature(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return {
      canonicalExtension: '.webp',
      category: 'image',
      mimeType: 'image/webp',
    };
  }

  if (
    matchesSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    matchesSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return {
      canonicalExtension: '.gif',
      category: 'image',
      mimeType: 'image/gif',
    };
  }

  if (matchesSignature(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return {
      canonicalExtension: '.pdf',
      category: 'document',
      mimeType: 'application/pdf',
    };
  }

  if (
    matchesSignature(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    matchesSignature(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    matchesSignature(buffer, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return {
      canonicalExtension: '.zip',
      category: 'document',
      mimeType: 'application/zip',
    };
  }

  return null;
}

function scanForMaliciousPayloads(buffer: Buffer, category: FileCategory): void {
  for (const item of DANGEROUS_BINARY_SIGNATURES) {
    if (matchesSignature(buffer, item.sig, item.offset)) {
      throw new FileSanitizationError(
        `Disallowed executable or dangerous binary signature detected: ${item.name}`,
        'DANGEROUS_BINARY_DETECTED'
      );
    }
  }

  const sampleSize = Math.min(buffer.length, 512 * 1024);
  const sampleString = buffer.subarray(0, sampleSize).toString('utf-8', 0, sampleSize);

  for (const pattern of MALICIOUS_SCRIPT_PATTERNS) {
    if (pattern.test(sampleString)) {
      throw new FileSanitizationError(
        'Malicious or suspicious script signature detected in file content.',
        'MALICIOUS_SCRIPT_DETECTED'
      );
    }
  }

  if (category === 'document') {
    const dangerousPdfPatterns = [/\/Launch\b/i, /\/JavaScript\b/i, /\/JS\b/i, /\/EmbeddedFiles\b/i];
    for (const pdfPattern of dangerousPdfPatterns) {
      if (pdfPattern.test(sampleString)) {
        throw new FileSanitizationError(
          'Document contains potentially malicious active code or launch actions.',
          'MALICIOUS_DOCUMENT_ACTION'
        );
      }
    }
  }
}

function generateSafeFilename(originalName: string, canonicalExt: string, prefix = 'upload'): string {
  const rawBase = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);

  const cleanPrefix = (prefix || 'upload').replace(/[^a-z0-9_-]/g, '') || 'file';
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString('hex');
  const safeExt = canonicalExt.startsWith('.') ? canonicalExt : `.${canonicalExt}`;

  return `${cleanPrefix}_${rawBase || 'file'}_${timestamp}_${randomHex}${safeExt}`;
}

function sanitizeUploadedFile(
  buffer: Buffer,
  options: FileValidationOptions,
  filenamePrefix = 'upload'
): SanitizedFile {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new FileSanitizationError('File is empty or invalid.', 'EMPTY_FILE');
  }

  const minSize = options.minSizeBytes ?? 16;
  if (buffer.length < minSize) {
    throw new FileSanitizationError(
      `File is too small (${buffer.length} bytes), minimum allowed size is ${minSize} bytes.`,
      'FILE_TOO_SMALL'
    );
  }

  const maxSize = options.maxSizeBytes ?? 10 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new FileSanitizationError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds limit of ${(maxSize / (1024 * 1024)).toFixed(2)} MB.`,
      'FILE_TOO_LARGE'
    );
  }

  const detected = detectFileSignature(buffer);
  if (!detected) {
    throw new FileSanitizationError(
      'File signature could not be verified or is not supported.',
      'UNSUPPORTED_OR_CORRUPT_FILE'
    );
  }

  if (options.allowedCategories && options.allowedCategories.length > 0) {
    const isCategoryAllowed =
      options.allowedCategories.includes('any') ||
      options.allowedCategories.includes(detected.category);
    if (!isCategoryAllowed) {
      throw new FileSanitizationError(
        `File category "${detected.category}" is not permitted for this upload. Allowed: ${options.allowedCategories.join(', ')}`,
        'CATEGORY_NOT_ALLOWED'
      );
    }
  }

  if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
    if (!options.allowedMimeTypes.includes(detected.mimeType)) {
      throw new FileSanitizationError(
        `File MIME type "${detected.mimeType}" is not allowed.`,
        'MIME_NOT_ALLOWED'
      );
    }
  }

  scanForMaliciousPayloads(buffer, detected.category);

  const cleanOriginalName = path.basename(options.originalName || 'file')
    .replace(/[\0\r\n\t]/g, '')
    .slice(0, 100);

  const safeFilename = generateSafeFilename(cleanOriginalName, detected.canonicalExtension, filenamePrefix);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  logger.system.info(
    `File successfully sanitized: "${cleanOriginalName}" -> "${safeFilename}" [${detected.mimeType}, ${buffer.length} bytes, SHA256: ${hash.slice(0, 12)}...]`
  );

  return {
    buffer,
    canonicalExtension: detected.canonicalExtension,
    category: detected.category,
    detectedMimeType: detected.mimeType,
    hash,
    originalName: cleanOriginalName,
    safeFilename,
    size: buffer.length,
  };
}

export {
  FileSanitizationError,
  detectFileSignature,
  escapeHtml,
  generateSafeFilename,
  sanitizeUploadedFile,
  scanForMaliciousPayloads
};

export type {
  DetectedSignature,
  FileCategory,
  FileValidationOptions,
  SanitizedFile
};
