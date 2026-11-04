import aiTokenRoutes from '../../src/routes/ai-token.routes.js';
import pdfToMarkdownRoutes from '../../src/tools/pdf-to-markdown/pdf-to-markdown.routes.js';
import summarizePdfRoutes from '../../src/tools/summarize-pdf/summarize-pdf.routes.js';
import translatePdfRoutes from '../../src/tools/translate-pdf/translate-pdf.routes.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import http from 'node:http';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

describe('AI Tools & Token Routes Authentication Guard', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', aiTokenRoutes);
    app.use('/api', summarizePdfRoutes);
    app.use('/api', pdfToMarkdownRoutes);
    app.use('/api', translatePdfRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it('rejects GET /api/tokens/balance with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/tokens/balance`);
    assert.strictEqual(res.status, 401);
  });

  it('rejects POST /api/tokens/estimate with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/tokens/estimate`, {
      body: JSON.stringify({ fileSizeBytes: 1024, pageCount: 2, toolId: 'summarize-pdf' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  });

  it('rejects POST /api/tools/summarize-pdf/summarize with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/tools/summarize-pdf/summarize`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  });

  it('rejects POST /api/tools/pdf-to-markdown/convert with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/tools/pdf-to-markdown/convert`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  });

  it('rejects POST /api/tools/translate-pdf/translate with 401 when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/tools/translate-pdf/translate`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  });
});
