import fs from 'fs';
import path from 'path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type LogChannel = 'app' | 'database' | 'system' | 'auth' | 'error';

interface LogOptions {
  channel: LogChannel;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any> | Error | unknown;
}

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'token',
  'secret',
  'secretKey',
  'clientSecret',
  'webhookSecret',
  'apiKey',
  'authorization',
  'cookie',
  'cookies',
];

function sanitizeValue(key: string, value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  const isSensitiveKey = SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));
  if (isSensitiveKey) {
    return '[REDACTED]';
  }

  if (typeof value === 'object') {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
      ...(obj as any),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    sanitized[k] = sanitizeValue(k, v);
  }
  return sanitized;
}

class LoggerService {
  private static readonly MAX_LOG_SIZE_BYTES = 20 * 1024 * 1024;
  private logsDir: string;
  private writeStreams: Map<string, fs.WriteStream> = new Map();
  private isInitialized = false;

  constructor() {
    this.logsDir = path.resolve(process.cwd(), 'logs');
    this.ensureLogsDirectory();
  }

  private ensureLogsDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[Logger] Failed to create logs directory:', err);
    }
  }

  private rotateLogIfNeeded(filename: string): void {
    const filePath = path.join(this.logsDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size >= LoggerService.MAX_LOG_SIZE_BYTES) {
          const existingStream = this.writeStreams.get(filename);
          if (existingStream) {
            existingStream.end();
            this.writeStreams.delete(filename);
          }
          const rotatedPath = `${filePath}.1`;
          if (fs.existsSync(rotatedPath)) {
            fs.unlinkSync(rotatedPath);
          }
          fs.renameSync(filePath, rotatedPath);
        }
      }
    } catch {}
  }

  private getWriteStream(filename: string): fs.WriteStream | null {
    if (!this.isInitialized) {
      this.ensureLogsDirectory();
    }

    this.rotateLogIfNeeded(filename);

    if (this.writeStreams.has(filename)) {
      return this.writeStreams.get(filename)!;
    }

    try {
      const filePath = path.join(this.logsDir, filename);
      const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' });
      stream.on('error', (err) => {
        console.error(`[Logger] Error writing to ${filename}:`, err);
      });
      this.writeStreams.set(filename, stream);
      return stream;
    } catch (err) {
      console.error(`[Logger] Failed to initialize write stream for ${filename}:`, err);
      return null;
    }
  }

  private formatTimestamp(date: Date = new Date()): string {
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
  }

  public log(options: LogOptions): void {
    const { channel, level, message, metadata } = options;
    const timestamp = this.formatTimestamp();

    let metaString = '';
    if (metadata !== undefined) {
      try {
        const sanitizedMeta = sanitizeObject(metadata);
        if (sanitizedMeta instanceof Error) {
          metaString = `\n  Error: ${sanitizedMeta.message}\n  Stack: ${sanitizedMeta.stack}`;
        } else if (typeof sanitizedMeta === 'object' && Object.keys(sanitizedMeta).length > 0) {
          metaString = ` | metadata: ${JSON.stringify(sanitizedMeta)}`;
        } else if (typeof sanitizedMeta !== 'object') {
          metaString = ` | details: ${String(sanitizedMeta)}`;
        }
      } catch {
        metaString = ' | metadata: [Unserializable Object]';
      }
    }

    const logLine = `[${timestamp}] [${level}] [ADMIN-${channel.toUpperCase()}] ${message}${metaString}\n`;

    const channelStream = this.getWriteStream(`admin-${channel}.txt`);
    if (channelStream && channelStream.writable) {
      channelStream.write(logLine);
    }

    if (level === 'ERROR' && channel !== 'error') {
      const errorStream = this.getWriteStream('admin-error.txt');
      if (errorStream && errorStream.writable) {
        errorStream.write(logLine);
      }
    }

    const consoleOutput = `[${timestamp}] [ADMIN-${channel.toUpperCase()}] [${level}] ${message}`;
    if (level === 'ERROR') {
      console.error(consoleOutput, metadata ? metadata : '');
    } else if (level === 'WARN') {
      console.warn(consoleOutput, metadata ? metadata : '');
    } else {
      console.log(consoleOutput, metadata ? metadata : '');
    }
  }

  private createChannelLogger(channel: LogChannel) {
    return {
      debug: (message: string, metadata?: any) => this.log({ channel, level: 'DEBUG', message, metadata }),
      info: (message: string, metadata?: any) => this.log({ channel, level: 'INFO', message, metadata }),
      warn: (message: string, metadata?: any) => this.log({ channel, level: 'WARN', message, metadata }),
      error: (message: string, metadata?: any) => this.log({ channel, level: 'ERROR', message, metadata }),
    };
  }

  public readonly app = this.createChannelLogger('app');
  public readonly database = this.createChannelLogger('database');
  public readonly system = this.createChannelLogger('system');
  public readonly auth = this.createChannelLogger('auth');
  public readonly error = (message: string, metadata?: any) => this.log({ channel: 'error', level: 'ERROR', message, metadata });
}

const logger = new LoggerService();

export {
  LoggerService,
  logger,
  sanitizeObject
};

export type {
  LogChannel,
  LogLevel
};
