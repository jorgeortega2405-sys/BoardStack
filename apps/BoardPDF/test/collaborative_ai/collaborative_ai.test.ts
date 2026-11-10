import { MIN_AI_GENERATE_COST, calculateAiGenerateCost } from '../../src/services/ai-token.service.js';
import { AiDocumentBlueprint, GeminiFetchFn, compileAiBlueprintToDocument, extractJsonFromGeminiText, generateCollaborativeDocumentWithAi } from '../../src/tools/collaborative-pdf/collaborative-pdf-ai.service.js';
import { acquireCollaborativeAiLock, clearAllInMemoryAiLocks, getCollaborativeAiLock, releaseCollaborativeAiLock } from '../../src/tools/collaborative-pdf/collaborative-pdf-lock.service.js';
import { createAiGenerateCollaborativeDocHandler, deleteCollaborativeDocHandler, saveCollaborativeDocHandler, updateCollaborativeDocAccessLevelHandler } from '../../src/tools/collaborative-pdf/collaborative-pdf.controller.js';
import collaborativePdfRoutes from '../../src/tools/collaborative-pdf/collaborative-pdf.routes.js';
import { renderCollaborativePdf } from '../../src/tools/collaborative-pdf/collaborative-pdf.service.js';
import { CollaborativeDocumentContent, CollaborativeDocumentRecord, CollaborativeElement } from '../../src/tools/collaborative-pdf/collaborative-pdf.types.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, afterEach, before, describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';

function getElementRect(el: CollaborativeElement): { h: number; page: number; w: number; x: number; y: number } | null {
  if (el.type === 'drawing') {
    return null;
  }
  const w = Number(el.width) || 0;
  const h = Number(el.height) || 0;
  return {
    h,
    page: el.pageIndex ?? 0,
    w,
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
  };
}

function rectsOverlap(
  a: { h: number; w: number; x: number; y: number },
  b: { h: number; w: number; x: number; y: number }
): boolean {
  const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
  const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
  return overlapX && overlapY;
}

function createFakeGeminiFetcher(blueprint: AiDocumentBlueprint, totalTokenCount = 1650): GeminiFetchFn {
  return async () => ({
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(blueprint) }],
          },
        },
      ],
      usageMetadata: {
        totalTokenCount,
      },
    }),
    ok: true,
    status: 200,
    text: async () => JSON.stringify(blueprint),
  });
}

describe('Collaborative PDF AI Generation & Lock System', () => {
  const lockedDocIdsToClean = new Set<string>();

  afterEach(async () => {
    clearAllInMemoryAiLocks();
    for (const docId of lockedDocIdsToClean) {
      await releaseCollaborativeAiLock(docId);
    }
    lockedDocIdsToClean.clear();
  });

  describe('Token Cost Calculation & JSON Extraction', () => {
    it('enforces minimum token cost and scales with pages and Gemini tokens', () => {
      assert.strictEqual(MIN_AI_GENERATE_COST, 3);
      assert.strictEqual(calculateAiGenerateCost(0, 1), 3);
      assert.strictEqual(calculateAiGenerateCost(200, 1), 4);
      assert.strictEqual(calculateAiGenerateCost(2500, 4), 2 + 4 + 4);
    });

    it('extracts valid blueprints from plain JSON and markdown-fenced Gemini responses', () => {
      const sample: AiDocumentBlueprint = {
        palette: { scheme: 'emerald' },
        sections: [
          { subtitle: 'Q3 Summary', title: 'Growth Report', type: 'cover_header' },
          { text: 'Revenue grew 34% year-over-year.', type: 'paragraph' },
        ],
        title: 'Growth Report',
      };

      const plainParsed = extractJsonFromGeminiText(JSON.stringify(sample));
      assert.strictEqual(plainParsed.title, 'Growth Report');
      assert.strictEqual(plainParsed.sections.length, 2);

      const fencedParsed = extractJsonFromGeminiText(`\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\``);
      assert.strictEqual(fencedParsed.title, 'Growth Report');
      assert.strictEqual(fencedParsed.sections.length, 2);

      assert.throws(() => extractJsonFromGeminiText('not valid json at all'), /INVALID_GEMINI_JSON/);
      assert.throws(() => extractJsonFromGeminiText('{"title":"Missing sections"}'), /INVALID_GEMINI_BLUEPRINT/);
    });
  });

  describe('Multi-Page Auto-Layout Compiler & PDF Renderer', () => {
    it('compiles rich sections across multiple pages without overlap and renders valid multi-page PDF', async () => {
      const longParagraph = Array.from({ length: 18 }, (_, idx) => (
        `Clause ${idx + 1}: The service provider commits to maintaining 99.95% uptime, automated backups, encrypted storage in transit and at rest, and quarterly compliance audits across all collaborative PDF workspaces.`
      )).join(' ');

      const manyRows = Array.from({ length: 28 }, (_, idx) => [
        `Milestone ${idx + 1}`,
        idx % 2 === 0 ? 'Completed' : 'In Progress',
        `Owner ${idx + 1}`,
        `$${(idx + 1) * 450}`,
      ]);

      const blueprint: AiDocumentBlueprint = {
        palette: { scheme: 'blue' },
        sections: [
          { subtitle: 'Annual Technical & Financial Proposal 2026', title: 'Enterprise Cloud Migration', type: 'cover_header' },
          { text: '1. Executive Overview', type: 'heading' },
          { text: longParagraph, type: 'paragraph' },
          {
            cards: [
              { text: 'Target annual savings of $120,000 after migration completion.', title: 'Cost Reduction' },
              { text: 'Zero planned downtime during cutover windows.', title: 'Reliability' },
              { text: 'Full encryption across S3, Redis, and WebSocket relays.', title: 'Security' },
            ],
            type: 'callout_row',
          },
          { text: 'Key Deliverables Checklist', type: 'subheading' },
          {
            items: [
              'Infrastructure as Code repository with multi-region replication',
              'Automated integration & security regression pipeline',
              'Staff enablement workshops and runbooks',
            ],
            type: 'bullet_list',
          },
          { text: 'Implementation Phases', type: 'subheading' },
          {
            items: [
              'Discovery and workload dependency mapping',
              'Staging cutover and performance benchmarking',
              'Production migration and observability handoff',
            ],
            type: 'numbered_list',
          },
          { text: 'Remember to validate stakeholder sign-off prior to Phase 3 deployment.', title: 'Reviewer Note', type: 'sticky_note' },
          { type: 'divider' },
          { text: '2. Milestone Delivery Schedule', type: 'heading' },
          {
            headers: ['Deliverable', 'Status', 'Lead', 'Budget'],
            rows: manyRows,
            tableStyle: 'header-accent',
            type: 'table',
          },
          { type: 'page_break' },
          { text: '3. Projected Quarterly Adoption', type: 'heading' },
          {
            chartType: 'bar-vertical',
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            series: [{ name: 'Active Workspaces', values: [120, 210, 340, 490] }],
            title: 'Workspace Growth',
            type: 'chart',
          },
        ],
        title: 'Enterprise Cloud Migration',
      };

      const compiled = compileAiBlueprintToDocument(blueprint, {
        authorName: 'Architect',
        mode: 'replace',
      });

      assert.ok(compiled.content.pageCount >= 3, `Expected >= 3 pages, got ${compiled.content.pageCount}`);
      assert.strictEqual(compiled.generatedPageCount, compiled.content.pageCount);
      assert.ok(compiled.addedCount >= 10);

      const tableElements = compiled.content.elements.filter((el) => el.type === 'table');
      assert.ok(tableElements.length >= 2, 'Large table should split cleanly across pages');
      for (const tbl of tableElements) {
        if (tbl.type === 'table') {
          assert.deepStrictEqual(
            tbl.cells[0].map((c) => c.text),
            ['Deliverable', 'Status', 'Lead', 'Budget'],
            'Split table chunks must repeat headers'
          );
        }
      }

      const pageW = compiled.content.pageSize?.width || 794;
      const pageH = compiled.content.pageSize?.height || 1123;

      const byPage = new Map<number, CollaborativeElement[]>();
      for (const el of compiled.content.elements) {
        assert.ok(el.pageIndex >= 0 && el.pageIndex < compiled.content.pageCount);
        const rect = getElementRect(el);
        if (rect) {
          assert.ok(rect.w > 0 && rect.h > 0, `Element ${el.id} must have positive dimensions`);
          assert.ok(rect.x >= 0 && rect.x + rect.w <= pageW, `Element ${el.id} exceeds page width`);
          assert.ok(rect.y >= 0 && rect.y + rect.h <= pageH, `Element ${el.id} exceeds page height`);
        }
        const list = byPage.get(el.pageIndex) || [];
        list.push(el);
        byPage.set(el.pageIndex, list);
      }

      for (const [, pageEls] of byPage.entries()) {
        for (let i = 0; i < pageEls.length; i++) {
          for (let j = i + 1; j < pageEls.length; j++) {
            const a = pageEls[i];
            const b = pageEls[j];
            const aIsHeaderOverlay = a.id.startsWith('ai_banner_') && b.id.startsWith('ai_hdr');
            const bIsHeaderOverlay = b.id.startsWith('ai_banner_') && a.id.startsWith('ai_hdr');
            if (aIsHeaderOverlay || bIsHeaderOverlay) continue;

            const rectA = getElementRect(a);
            const rectB = getElementRect(b);
            if (rectA && rectB) {
              assert.strictEqual(
                rectsOverlap(rectA, rectB),
                false,
                `Elements ${a.id} and ${b.id} overlap on page ${rectA.page}`
              );
            }
          }
        }
      }

      const pdfBuffer = await renderCollaborativePdf(compiled.title, compiled.content);
      assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
      const loadedPdf = await PDFDocument.load(pdfBuffer);
      assert.strictEqual(loadedPdf.getPageCount(), compiled.content.pageCount);
    });

    it('appends new AI content below existing elements without overwriting or colliding', () => {
      const existingContent: CollaborativeDocumentContent = {
        elements: [
          {
            color: '#0f172a',
            fontFamily: 'Inter',
            fontSize: 18,
            height: 44,
            id: 'existing_title_1',
            isBold: true,
            pageIndex: 0,
            text: 'Existing Project Header',
            type: 'text',
            width: 500,
            x: 56,
            y: 60,
          },
        ],
        pageBackgrounds: ['#ffffff'],
        pageCount: 1,
        pagePdfSources: [null],
        pageSize: { height: 1123, width: 794 },
        pageSizes: [{ height: 1123, width: 794 }],
        pageTitles: ['Existing Page'],
      };

      const appendBlueprint: AiDocumentBlueprint = {
        sections: [
          { text: 'Appended Summary', type: 'heading' },
          { text: 'This appended paragraph should begin strictly below y=104.', type: 'paragraph' },
        ],
        title: 'AI Title Ignored When Existing Title Custom',
      };

      const result = compileAiBlueprintToDocument(appendBlueprint, {
        existingContent,
        mode: 'append',
      });

      const preserved = result.content.elements.find((e) => e.id === 'existing_title_1');
      assert.ok(preserved, 'Existing element must remain intact in append mode');

      const added = result.content.elements.filter((e) => e.id !== 'existing_title_1');
      assert.ok(added.length >= 2);
      for (const el of added) {
        if (el.type !== 'drawing' && el.pageIndex === 0) {
          assert.ok(el.y > 104, `Appended element ${el.id} at y=${el.y} must appear below existing bottom y=104`);
        }
      }
    });
  });

  describe('Gemini Service Orchestration & Fallback Retry', () => {
    it('retries across fallback models and returns compiled document & Gemini usage tokens', async () => {
      let attempt = 0;
      const blueprint: AiDocumentBlueprint = {
        palette: { scheme: 'purple' },
        sections: [
          { subtitle: 'Quarterly Review', title: 'Product Roadmap', type: 'cover_header' },
          { text: 'Focus on collaborative editing speed and reliability.', type: 'paragraph' },
        ],
        title: 'Product Roadmap',
      };

      const flakyFetcher: GeminiFetchFn = async () => {
        attempt += 1;
        if (attempt === 1) {
          return {
            json: async () => ({}),
            ok: false,
            status: 503,
            text: async () => 'Transient overload',
          };
        }
        return {
          json: async () => ({
            candidates: [{ content: { parts: [{ text: `\`\`\`json\n${JSON.stringify(blueprint)}\n\`\`\`` }] } }],
            usageMetadata: { totalTokenCount: 1920 },
          }),
          ok: true,
          status: 200,
          text: async () => JSON.stringify(blueprint),
        };
      };

      const res = await generateCollaborativeDocumentWithAi({
        authorName: 'Alice',
        geminiFetcher: flakyFetcher,
        mode: 'replace',
        prompt: 'Create a short product roadmap document',
      });

      assert.strictEqual(attempt, 2);
      assert.strictEqual(res.geminiTokens, 1920);
      assert.strictEqual(res.title, 'Product Roadmap');
      assert.ok(res.content.elements.length >= 2);
    });

    it('throws GEMINI_UNAVAILABLE when all candidate models fail', async () => {
      const failingFetcher: GeminiFetchFn = async () => ({
        json: async () => ({}),
        ok: false,
        status: 500,
        text: async () => 'Upstream failure',
      });

      await assert.rejects(
        () => generateCollaborativeDocumentWithAi({
          geminiFetcher: failingFetcher,
          mode: 'replace',
          prompt: 'Generate report',
        }),
        /GEMINI_UNAVAILABLE/
      );
    });

    it('filters Gemini thinking parts, skips retired 2.x models, and recovers after transient 503 bursts', async () => {
      const requestedModels: string[] = [];
      let callCount = 0;
      const blueprint: AiDocumentBlueprint = {
        palette: { scheme: 'emerald' },
        sections: [
          { subtitle: 'Quarterly Audit', title: 'Finance Summary', type: 'cover_header' },
          { text: 'Operating margin improved across all regions.', type: 'paragraph' },
        ],
        title: 'Finance Summary',
      };

      const thinkingAndRetryFetcher: GeminiFetchFn = async (url) => {
        const match = url.match(/models\/([^:]+):generateContent/);
        if (match?.[1]) {
          requestedModels.push(match[1]);
        }
        callCount += 1;
        if (callCount <= 7) {
          return {
            json: async () => ({}),
            ok: false,
            status: callCount % 2 === 0 ? 429 : 503,
            text: async () => 'Model overloaded',
          };
        }
        return {
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'Internal reasoning about schema...', thought: true },
                    { text: JSON.stringify(blueprint) },
                  ],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 1150 },
          }),
          ok: true,
          status: 200,
          text: async () => JSON.stringify(blueprint),
        };
      };

      const res = await generateCollaborativeDocumentWithAi({
        authorName: 'Tester',
        geminiFetcher: thinkingAndRetryFetcher,
        mode: 'replace',
        prompt: 'Create a financial audit summary',
      });

      assert.strictEqual(res.title, 'Finance Summary');
      assert.ok(res.content.elements.length >= 2);
      assert.ok(!requestedModels.includes('gemini-2.5-flash'));
      assert.ok(!requestedModels.includes('gemini-2.0-flash'));
      assert.ok(requestedModels.includes('gemini-3.5-flash-lite'));
      assert.ok(requestedModels.includes('gemini-3.8-flash'));
      assert.ok(callCount >= 8);
    });
  });

  describe('Distributed Document AI Lock Service', () => {
    it('acquires exclusive lock, blocks concurrent writers, validates release token, and unlocks cleanly', async () => {
      const docId = `lock_test_${crypto.randomUUID()}`;
      lockedDocIdsToClean.add(docId);

      const initial = await getCollaborativeAiLock(docId);
      assert.strictEqual(initial.locked, false);

      const first = await acquireCollaborativeAiLock(docId, 11, 'Alice');
      assert.strictEqual(first.acquired, true);
      assert.strictEqual(first.lock.locked, true);
      assert.strictEqual(first.lock.lockedBy, 'Alice');
      assert.strictEqual(first.lock.lockedByUserId, 11);
      assert.ok(first.lockToken && first.lockToken.length >= 16);

      const second = await acquireCollaborativeAiLock(docId, 22, 'Bob');
      assert.strictEqual(second.acquired, false);
      assert.strictEqual(second.lock.locked, true);
      assert.strictEqual(second.lock.lockedBy, 'Alice');

      const wrongRelease = await releaseCollaborativeAiLock(docId, 'invalid-token-123');
      assert.strictEqual(wrongRelease, false);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, true);

      const validRelease = await releaseCollaborativeAiLock(docId, first.lockToken);
      assert.strictEqual(validRelease, true);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, false);
    });
  });

  describe('HTTP Route Guards, Subscription Billing & Lock Enforcement', () => {
    let realAuthServer: http.Server;
    let realAuthBaseUrl: string;
    let mockApiServer: http.Server;
    let mockApiBaseUrl: string;

    const mockBalances = new Map<number, number>();
    const mockDocs = new Map<string, CollaborativeDocumentRecord>();
    let lastQuotaPermissions: string[] = [];
    let lastBalancePermissions: string[] = [];
    let mockConsumeCallCount = 0;
    let mockSaveCallCount = 0;
    let fakeGeminiPageCount = 1;
    let fakeGeminiTokens = 100;
    let fakeGeminiShouldFail = false;

    before(async () => {
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use(cookieParser());
      unauthApp.use('/api', collaborativePdfRoutes);

      await new Promise<void>((resolve) => {
        realAuthServer = unauthApp.listen(0, '127.0.0.1', () => {
          const addr = realAuthServer.address() as { port: number };
          realAuthBaseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      const app = express();
      app.use(express.json({ limit: '5mb' }));
      app.use(cookieParser());
      app.use((req, _res, next) => {
        const rawUser = req.headers['x-test-user'];
        if (typeof rawUser === 'string' && rawUser.trim()) {
          (req as any).user = JSON.parse(rawUser);
        }
        next();
      });

      const aiHandler = createAiGenerateCollaborativeDocHandler({
        checkDocQuota: async (_userId, permissions) => {
          lastQuotaPermissions = permissions;
          return true;
        },
        consumeTokens: async ({ pageCount, requiredTokens, userId }) => {
          mockConsumeCallCount += 1;
          const current = mockBalances.get(userId) ?? 0;
          if (current < requiredTokens) {
            return {
              balance: current,
              consumed: 0,
              limit: 2000,
              required: requiredTokens,
              resetAt: new Date().toISOString(),
              success: false,
            };
          }
          const updated = current - requiredTokens;
          mockBalances.set(userId, updated);
          return {
            balance: updated,
            consumed: requiredTokens,
            limit: 2000,
            required: pageCount > 0 ? requiredTokens : MIN_AI_GENERATE_COST,
            resetAt: new Date().toISOString(),
            success: true,
          };
        },
        generateWithAi: async (params) => {
          if (fakeGeminiShouldFail) {
            throw new Error('GEMINI_UNAVAILABLE');
          }
          const sections: AiDocumentBlueprint['sections'] = [
            { subtitle: 'Generated Subtitle', title: 'Mock AI Document', type: 'cover_header' },
          ];
          for (let p = 0; p < fakeGeminiPageCount; p++) {
            sections.push({ text: `Section ${p + 1}`, type: 'heading' });
            sections.push({ text: `Generated body for page section ${p + 1}.`, type: 'paragraph' });
            if (p + 1 < fakeGeminiPageCount) {
              sections.push({ type: 'page_break' });
            }
          }
          return generateCollaborativeDocumentWithAi({
            ...params,
            geminiFetcher: createFakeGeminiFetcher(
              {
                palette: { scheme: 'blue' },
                sections,
                title: 'Mock AI Document',
              },
              fakeGeminiTokens
            ),
          });
        },
        getDocument: async (docId) => mockDocs.get(docId) || null,
        getTokenBalance: async (userId, permissions) => {
          lastBalancePermissions = permissions || [];
          return {
            balance: mockBalances.get(userId) ?? 0,
            limit: 2000,
            resetAt: new Date().toISOString(),
          };
        },
        saveDocument: async (payload) => {
          mockSaveCallCount += 1;
          const now = new Date().toISOString();
          const saved: CollaborativeDocumentRecord = {
            access_level: payload.accessLevel || 'restricted',
            content: payload.content,
            created_at: now,
            folder_id: payload.folderId ?? null,
            id: payload.id,
            members: [],
            page_count: payload.content.pageCount || 1,
            pdf_filename: `${payload.id}.pdf`,
            title: payload.title,
            updated_at: now,
            user_id: payload.userId ?? null,
          };
          mockDocs.set(payload.id, saved);
          return saved;
        },
      });

      app.post('/api/collaborative-docs/:id/ai-generate', aiHandler);
      app.put('/api/collaborative-docs/:id', saveCollaborativeDocHandler);
      app.patch('/api/collaborative-docs/:id/access-level', updateCollaborativeDocAccessLevelHandler);
      app.delete('/api/collaborative-docs/:id', deleteCollaborativeDocHandler);

      await new Promise<void>((resolve) => {
        mockApiServer = app.listen(0, '127.0.0.1', () => {
          const addr = mockApiServer.address() as { port: number };
          mockApiBaseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    after(async () => {
      await Promise.all([
        new Promise<void>((resolve) => (realAuthServer ? realAuthServer.close(() => resolve()) : resolve())),
        new Promise<void>((resolve) => (mockApiServer ? mockApiServer.close(() => resolve()) : resolve())),
      ]);
    });

    it('rejects unauthenticated POST /api/collaborative-docs/:id/ai-generate with 401', async () => {
      const res = await fetch(`${realAuthBaseUrl}/api/collaborative-docs/unauth-doc/ai-generate`, {
        body: JSON.stringify({ prompt: 'Create invoice' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      assert.strictEqual(res.status, 401);
    });

    it('validates prompt payload and enforces document ownership/editor permissions', async () => {
      const docId = `perm_doc_${crypto.randomUUID()}`;
      mockDocs.set(docId, {
        access_level: 'restricted',
        content: { elements: [], pageCount: 1 },
        created_at: new Date().toISOString(),
        id: docId,
        members: [],
        page_count: 1,
        title: 'Private Doc',
        updated_at: new Date().toISOString(),
        user_id: 999,
      });

      const emptyPromptRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ prompt: '   ' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 999, username: 'Owner' }),
        },
        method: 'POST',
      });
      assert.strictEqual(emptyPromptRes.status, 400);

      const tooLongPromptRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ prompt: 'x'.repeat(4001) }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 999, username: 'Owner' }),
        },
        method: 'POST',
      });
      assert.strictEqual(tooLongPromptRes.status, 400);

      const forbiddenRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ prompt: 'Summarize quarterly numbers' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 123, username: 'Intruder' }),
        },
        method: 'POST',
      });
      assert.strictEqual(forbiddenRes.status, 403);
    });

    it('returns 402 on insufficient subscription tokens before and after Gemini cost calculation without consuming or locking', async () => {
      const docId = `billing_402_${crypto.randomUUID()}`;
      lockedDocIdsToClean.add(docId);
      mockConsumeCallCount = 0;
      mockSaveCallCount = 0;
      fakeGeminiShouldFail = false;

      mockBalances.set(501, 2);
      const preCheckRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ prompt: 'Build annual report' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 501, username: 'LowTokens' }),
        },
        method: 'POST',
      });
      assert.strictEqual(preCheckRes.status, 402);
      assert.strictEqual(mockConsumeCallCount, 0);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, false);

      mockBalances.set(502, 4);
      fakeGeminiPageCount = 4;
      fakeGeminiTokens = 2400;
      const postCheckRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ prompt: 'Generate a 4-page strategy handbook' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 502, username: 'MidTokens' }),
        },
        method: 'POST',
      });
      assert.strictEqual(postCheckRes.status, 402);
      const postBody = await postCheckRes.json();
      assert.strictEqual(postBody.requiredTokens, calculateAiGenerateCost(2400, 4));
      assert.strictEqual(mockBalances.get(502), 4);
      assert.strictEqual(mockConsumeCallCount, 0);
      assert.strictEqual(mockSaveCallCount, 0);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, false);
    });

    it('blocks AI generation, saves, access-level changes, and deletions with 423 while AI lock is active', async () => {
      const docId = `locked_423_${crypto.randomUUID()}`;
      lockedDocIdsToClean.add(docId);

      mockBalances.set(601, 500);
      const lockRes = await acquireCollaborativeAiLock(docId, 600, 'CollaboratorA');
      assert.strictEqual(lockRes.acquired, true);

      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 601, username: 'CollaboratorB' }),
        };

        const aiRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
          body: JSON.stringify({ prompt: 'Add executive summary' }),
          headers,
          method: 'POST',
        });
        assert.strictEqual(aiRes.status, 423);
        const aiBody = await aiRes.json();
        assert.strictEqual(aiBody.code, 'AI_GENERATION_LOCKED');
        assert.strictEqual(aiBody.aiLock.lockedBy, 'CollaboratorA');

        const saveRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}`, {
          body: JSON.stringify({ content: { elements: [], pageCount: 1 }, title: 'Overwrite attempt' }),
          headers,
          method: 'PUT',
        });
        assert.strictEqual(saveRes.status, 423);
        assert.strictEqual((await saveRes.json()).code, 'AI_GENERATION_LOCKED');

        const accessRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/access-level`, {
          body: JSON.stringify({ accessLevel: 'anyone_with_link' }),
          headers,
          method: 'PATCH',
        });
        assert.strictEqual(accessRes.status, 423);
        assert.strictEqual((await accessRes.json()).code, 'AI_GENERATION_LOCKED');

        const delRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}`, {
          headers,
          method: 'DELETE',
        });
        assert.strictEqual(delRes.status, 423);
        assert.strictEqual((await delRes.json()).code, 'AI_GENERATION_LOCKED');
      } finally {
        await releaseCollaborativeAiLock(docId, lockRes.lockToken);
      }
    });

    it('generates multi-page document, deducts subscription tokens, saves document, and releases lock on completion and failure', async () => {
      const docId = `success_doc_${crypto.randomUUID()}`;
      lockedDocIdsToClean.add(docId);

      mockBalances.set(701, 100);
      fakeGeminiShouldFail = false;
      fakeGeminiPageCount = 3;
      fakeGeminiTokens = 1600;

      const expectedCost = calculateAiGenerateCost(1600, 3);
      const okRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ mode: 'replace', prompt: 'Create a 3-page project kickoff dossier' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({
            id: 701,
            permissions: ['tools:access', 'subscription:feature:pro'],
            username: 'DesignerUser',
          }),
        },
        method: 'POST',
      });

      assert.strictEqual(okRes.status, 200);
      assert.deepStrictEqual(lastQuotaPermissions, ['tools:access', 'subscription:feature:pro']);
      assert.deepStrictEqual(lastBalancePermissions, ['tools:access', 'subscription:feature:pro']);
      const body = await okRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.aiTokens.consumed, expectedCost);
      assert.strictEqual(body.aiTokens.balance, 100 - expectedCost);
      assert.strictEqual(mockBalances.get(701), 100 - expectedCost);
      assert.strictEqual(body.generated.pageCount, 3);
      assert.strictEqual(body.document.page_count, 3);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, false);

      fakeGeminiShouldFail = true;
      const failRes = await fetch(`${mockApiBaseUrl}/api/collaborative-docs/${docId}/ai-generate`, {
        body: JSON.stringify({ mode: 'append', prompt: 'Append extra appendix' }),
        headers: {
          'Content-Type': 'application/json',
          'x-test-user': JSON.stringify({ id: 701, username: 'DesignerUser' }),
        },
        method: 'POST',
      });

      assert.strictEqual(failRes.status, 503);
      const failBody = await failRes.json();
      assert.strictEqual(failBody.success, false);
      assert.strictEqual(mockBalances.get(701), 100 - expectedCost);
      assert.strictEqual((await getCollaborativeAiLock(docId)).locked, false);
    });
  });
});
