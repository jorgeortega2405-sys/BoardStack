import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Pricing View HTML Template & Cards Compliance', () => {
  const templatePath = path.resolve(import.meta.dirname, '../../public/views/pricing/pricing.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  it('strictly enforces AGENTS.md Rule 3: zero id attributes in template', () => {
    const idRegex = /\sid=["'][^"']*["']/gi;
    const matches = templateHtml.match(idRegex);
    assert.strictEqual(matches, null, `Found forbidden id attributes: ${JSON.stringify(matches)}`);
  });

  it('strictly enforces AGENTS.md Rule 4: button tags must have type as first attribute', () => {
    const buttonRegex = /<button\s+([^>]+)>/gi;
    let match;
    while ((match = buttonRegex.exec(templateHtml)) !== null) {
      const attributesString = match[1].trim();
      const firstAttr = attributesString.split(/\s+/)[0];
      assert.ok(
        firstAttr.startsWith('type='),
        `Button does not have type as first attribute: <button ${attributesString.slice(0, 50)}...>`
      );
    }
  });

  it('strictly enforces AGENTS.md Rule 4: other elements with class must have class as first attribute', () => {
    const elementRegex = /<([a-z0-9-]+)\s+([^>]+)>/gi;
    let match;
    while ((match = elementRegex.exec(templateHtml)) !== null) {
      const tagName = match[1].toLowerCase();
      if (tagName === 'button' || tagName.startsWith('!--')) {
        continue;
      }
      const attributesString = match[2].trim();
      if (attributesString.includes('class=')) {
        const firstAttr = attributesString.split(/\s+/)[0];
        assert.ok(
          firstAttr.startsWith('class='),
          `Element <${tagName}> does not have class as first attribute: <${tagName} ${attributesString.slice(0, 50)}...>`
        );
      }
    }
  });

  it('enforces clean styles with zero inline style attributes', () => {
    const styleRegex = /\sstyle=["'][^"']*["']/gi;
    const matches = templateHtml.match(styleRegex);
    assert.strictEqual(matches, null, `Found inline style attributes: ${JSON.stringify(matches)}`);
  });

  it('strictly eliminates all Lorem Ipsum and dummy placeholder text', () => {
    const forbiddenPlaceholders = [
      'lorem',
      'ipsum',
      'dolor sit',
      'consectetur adipiscing',
      'sed ut perspiciatis',
      'nemo enim',
      'neque porro',
      'at vero eos',
      'excepteur sint',
    ];

    const lowerHtml = templateHtml.toLowerCase();
    for (const placeholder of forbiddenPlaceholders) {
      assert.ok(
        !lowerHtml.includes(placeholder),
        `Template contains forbidden placeholder text: "${placeholder}"`
      );
    }
  });

  it('includes active paid plans (Pro and Business) with 5 structured features each', () => {
    const cards = [
      { tier: 'pro', prefix: 'feature-pro-' },
      { tier: 'business', prefix: 'feature-business-' },
    ];

    for (const card of cards) {
      assert.ok(templateHtml.includes(`data-ref="plan-card-${card.tier}"`));
      for (let i = 1; i <= 5; i++) {
        assert.ok(
          templateHtml.includes(`data-ref="${card.prefix}${i}"`),
          `Card ${card.tier} is missing feature ${card.prefix}${i}`
        );
      }
    }
  });

  it('strictly excludes Enterprise and Education plans from pricing template', () => {
    assert.ok(!templateHtml.includes('data-ref="plan-card-enterprise"'));
    assert.ok(!templateHtml.includes('data-ref="pricing-grid-education"'));
    assert.ok(!templateHtml.includes('data-ref="category-toggle-pill"'));
    assert.ok(!templateHtml.includes('/contact/sales'));
    assert.ok(!templateHtml.includes('/contact/education'));
  });
});
