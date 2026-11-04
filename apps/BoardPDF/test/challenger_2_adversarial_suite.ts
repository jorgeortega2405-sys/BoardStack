import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('CHALLENGER 2: Adversarial Pricing Template & Integration Verification Suite', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const templatePath = path.join(rootDir, 'public/views/pricing/pricing.html');
  const cssPath = path.join(rootDir, 'public/css/components/component-pricing.css');
  const controllerPath = path.join(rootDir, 'client/views/pricing.view.ts');
  const masterConfigPath = path.join(rootDir, 'src/config/subscription-plans.config.ts');
  const clientGatewayPath = path.join(rootDir, 'client/config/subscription-plans.config.ts');

  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  const controllerTs = fs.readFileSync(controllerPath, 'utf-8');
  const masterConfigTs = fs.readFileSync(masterConfigPath, 'utf-8');

  it('[ADV-01] Adversarial Latin Dictionary / Lorem Ipsum Scan (Cicero corpus)', () => {
    const rawText = templateHtml.replace(/<[^>]+>/g, ' ');

    const latinWords = [
      'lorem', 'ipsum', 'dolor', 'amet', 'consectetur', 'adipiscing', 'adipisici',
      'eiusmod', 'tempor', 'incididunt', 'labore', 'dolore', 'magna', 'aliqua',
      'nostrud', 'ullamco', 'laboris', 'aliquip', 'commodo', 'consequat', 'aute',
      'irure', 'reprehenderit', 'voluptate', 'cillum', 'fugiat', 'pariatur',
      'excepteur', 'sint', 'occaecat', 'cupidatat', 'proident', 'sunt', 'culpa',
      'deserunt', 'mollit', 'anim', 'laborum', 'perspiciatis', 'unde', 'omnis',
      'iste', 'natus', 'error', 'voluptatem', 'accusantium', 'doloremque',
      'laudantium', 'totam', 'aperiam', 'eaque', 'ipsa', 'inventore', 'veritatis',
      'architecto', 'beatae', 'dicta', 'explicabo', 'nemo', 'enim', 'ipsam',
      'voluptas', 'aspernatur', 'odit', 'fugit', 'dolores', 'eos', 'ratione',
      'sequi', 'nesciunt', 'porro', 'quisquam', 'dolorem', 'adipisci', 'numquam',
      'eius', 'tempora', 'incidunt'
    ];

    const violations: { index: number; snippet: string; word: string }[] = [];

    for (const word of latinWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(rawText)) !== null) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(rawText.length, match.index + 30);
        const snippet = rawText.slice(start, end).replace(/\s+/g, ' ').trim();
        violations.push({ index: match.index, snippet, word });
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Adversarial Latin Scanner detected ${violations.length} Latin placeholder words:\n` +
      violations.map((v) => `  - "${v.word}" in context: "...${v.snippet}..."`).join('\n')
    );
  });

  it('[ADV-02] Strict AGENTS.md Rule 3: Zero id="..." attributes in pricing.html', () => {
    const idAttrRegex = /\sid\s*=\s*["'][^"']*["']/gi;
    const matches = templateHtml.match(idAttrRegex) || [];
    assert.strictEqual(
      matches.length,
      0,
      `Detected forbidden id attributes in pricing.html: ${JSON.stringify(matches)}`
    );

    const tagWithIdRegex = /<([a-zA-Z0-9-]+)\s+[^>]*\bid\s*=[^>]*>/gi;
    const tagMatches = templateHtml.match(tagWithIdRegex) || [];
    assert.strictEqual(
      tagMatches.length,
      0,
      `Detected HTML elements with id: ${JSON.stringify(tagMatches)}`
    );
  });

  it('[ADV-03] AGENTS.md Rule 3 in Controller: Zero getElementById in pricing.view.ts', () => {
    assert.ok(
      !controllerTs.includes('getElementById'),
      'Controller pricing.view.ts must not contain document.getElementById'
    );
  });

  it('[ADV-04] Strict AGENTS.md Rule 4: All <button> elements MUST have type as first attribute', () => {
    const buttonRegex = /<button\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    let buttonCount = 0;

    while ((match = buttonRegex.exec(templateHtml)) !== null) {
      buttonCount++;
      const fullAttrs = match[1].trim();
      const firstAttrMatch = fullAttrs.match(/^([a-zA-Z0-9-]+)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/);
      assert.ok(firstAttrMatch, `Unable to parse first attribute of button: <button ${fullAttrs}>`);

      const firstAttrName = firstAttrMatch[1];
      assert.strictEqual(
        firstAttrName,
        'type',
        `Button #${buttonCount} does not have 'type' as its first attribute:\n  <button ${fullAttrs.slice(0, 80)}...>`
      );
    }

    assert.ok(buttonCount >= 7, `Expected at least 7 buttons, found ${buttonCount}`);
  });

  it('[ADV-05] Strict AGENTS.md Rule 4: Non-button elements with class must have class as first attribute', () => {
    const tagRegex = /<([a-zA-Z0-9-]+)\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    const violations: string[] = [];

    while ((match = tagRegex.exec(templateHtml)) !== null) {
      const tagName = match[1].toLowerCase();
      if (tagName === 'button' || tagName.startsWith('!--') || tagName === '!doctype') {
        continue;
      }
      const fullAttrs = match[2].trim();
      if (fullAttrs.endsWith('/')) {
        // self-closing
      }
      if (/\bclass\s*=/i.test(fullAttrs)) {
        const firstAttrMatch = fullAttrs.match(/^([a-zA-Z0-9-]+)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/);
        if (!firstAttrMatch || firstAttrMatch[1].toLowerCase() !== 'class') {
          violations.push(`<${tagName} ${fullAttrs.slice(0, 60)}...>`);
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Elements with 'class' not as first attribute:\n${violations.join('\n')}`
    );
  });

  it('[ADV-06] Strict AGENTS.md Rule 4: Non-button elements with data-ref after class', () => {
    const tagRegex = /<([a-zA-Z0-9-]+)\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    const violations: string[] = [];

    while ((match = tagRegex.exec(templateHtml)) !== null) {
      const tagName = match[1].toLowerCase();
      if (tagName === 'button' || tagName.startsWith('!--')) {
        continue;
      }
      const fullAttrs = match[2].trim();
      if (/\bclass\s*=/i.test(fullAttrs) && /\bdata-ref\s*=/i.test(fullAttrs)) {
        const classIndex = fullAttrs.indexOf('class=');
        const dataRefIndex = fullAttrs.indexOf('data-ref=');
        if (dataRefIndex < classIndex) {
          violations.push(`<${tagName} ${fullAttrs.slice(0, 60)}...>`);
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Elements where 'data-ref' precedes 'class':\n${violations.join('\n')}`
    );
  });

  it('[ADV-07] Zero Inline Styles in pricing.html', () => {
    const inlineStyleRegex = /\sstyle\s*=\s*["'][^"']*["']/gi;
    const matches = templateHtml.match(inlineStyleRegex) || [];
    assert.strictEqual(
      matches.length,
      0,
      `Found inline style attributes in pricing.html: ${JSON.stringify(matches)}`
    );
  });

  it('[ADV-08] Enterprise Card & Template: No /contact/sales route or sales contact form', () => {
    assert.ok(
      !templateHtml.includes('/contact/sales'),
      'pricing.html must NOT contain references to /contact/sales'
    );
    assert.ok(
      !controllerTs.includes('/contact/sales'),
      'pricing.view.ts must NOT navigate to /contact/sales'
    );

    const formRegex = /<form\b[^>]*>/gi;
    const formMatches = templateHtml.match(formRegex) || [];
    assert.strictEqual(
      formMatches.length,
      0,
      `pricing.html must NOT contain contact forms: ${JSON.stringify(formMatches)}`
    );

    assert.ok(
      !templateHtml.includes('data-action="contact-sales" data-tier="enterprise"'),
      'Enterprise button must not use contact-sales action'
    );
    assert.ok(
      templateHtml.includes('data-ref="btn-subscribe-enterprise" data-action="enterprise-info" data-tier="enterprise"'),
      'Enterprise button must use enterprise-info action'
    );
  });

  it('[ADV-09] Full Structural Integrity for All 4 General Plan Cards', () => {
    const requiredCards = [
      {
        actionText: 'Plan Base',
        descSubstring: 'comenzar a explorar',
        name: 'Free',
        priceMonthly: '0',
        priceYearly: '0',
        storage: '5 GB de almacenamiento',
        tier: 'free',
      },
      {
        actionText: 'Obtén BoardPDF Pro',
        descSubstring: 'profesionales, investigadores',
        name: 'Pro',
        priceMonthly: '9.99',
        priceYearly: '7.99',
        storage: '100 GB de almacenamiento',
        tier: 'pro',
      },
      {
        actionText: 'Obtén Negocios',
        descSubstring: 'despachos y equipos',
        name: 'Business',
        priceMonthly: '19.99',
        priceYearly: '15.99',
        storage: '500 GB de almacenamiento',
        tier: 'business',
      },
      {
        actionText: 'Plan Corporativo',
        descSubstring: 'Seguridad corporativa',
        name: 'Enterprise',
        priceCustom: 'Plan Corporativo',
        storage: 'Capacidad a medida',
        tier: 'enterprise',
      },
    ];

    for (const card of requiredCards) {
      assert.ok(templateHtml.includes(`data-ref="plan-card-${card.tier}"`), `Missing plan-card-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="card-header-${card.tier}"`), `Missing card-header-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="popular-badge-${card.tier}"`), `Missing popular-badge-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="card-title-${card.tier}"`), `Missing card-title-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="card-desc-${card.tier}"`), `Missing card-desc-${card.tier}`);
      assert.ok(templateHtml.includes(card.descSubstring), `Description missing expected snippet for ${card.name}`);
      assert.ok(templateHtml.includes(`data-ref="storage-badge-${card.tier}"`), `Missing storage-badge-${card.tier}`);
      assert.ok(templateHtml.includes(card.storage), `Storage text missing expected value for ${card.name}`);
      assert.ok(templateHtml.includes(`data-ref="card-price-${card.tier}"`), `Missing card-price-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="card-action-${card.tier}"`), `Missing card-action-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="btn-subscribe-${card.tier}"`), `Missing btn-subscribe-${card.tier}`);
      assert.ok(templateHtml.includes(card.actionText), `Action button text missing for ${card.name}`);
      assert.ok(templateHtml.includes(`data-ref="card-features-${card.tier}"`), `Missing card-features-${card.tier}`);
      assert.ok(templateHtml.includes(`data-ref="features-container-${card.tier}"`), `Missing features-container-${card.tier}`);

      for (let i = 1; i <= 5; i++) {
        const featureRef = `feature-${card.tier}-${i}`;
        assert.ok(templateHtml.includes(`data-ref="${featureRef}"`), `Missing feature item ${featureRef} in ${card.name}`);
      }

      if (card.priceMonthly) {
        assert.ok(
          templateHtml.includes(`data-ref="plan-price-${card.tier}" data-monthly="${card.priceMonthly}" data-yearly="${card.priceYearly}"`),
          `Pricing attributes missing or mismatch for ${card.name}`
        );
      }
      if (card.priceCustom) {
        assert.ok(
          templateHtml.includes(`class="component-card-price component-card-price--custom"`),
          `Custom price class missing for ${card.name}`
        );
      }
    }
  });

  it('[ADV-10] Full Structural Integrity for Education Plan Cards', () => {
    const eduCards = ['edu-individual', 'edu-school', 'edu-university'];

    for (const eduTier of eduCards) {
      assert.ok(templateHtml.includes(`data-ref="plan-card-${eduTier}"`), `Missing plan-card-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="card-header-${eduTier}"`), `Missing card-header-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="card-title-${eduTier}"`), `Missing card-title-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="card-desc-${eduTier}"`), `Missing card-desc-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="storage-badge-${eduTier}"`), `Missing storage-badge-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="card-price-${eduTier}"`), `Missing card-price-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="btn-subscribe-${eduTier}"`), `Missing btn-subscribe-${eduTier}`);
      assert.ok(templateHtml.includes(`data-ref="features-container-${eduTier}"`), `Missing features-container-${eduTier}`);

      const prefix = eduTier === 'edu-individual' ? 'feature-edu-ind-' : (eduTier === 'edu-school' ? 'feature-edu-sch-' : 'feature-edu-uni-');
      for (let i = 1; i <= 5; i++) {
        assert.ok(templateHtml.includes(`data-ref="${prefix}${i}"`), `Missing feature item ${prefix}${i}`);
      }
    }
  });

  it('[ADV-11] CSS Rule Verification: .component-card-price--custom exists and sets font-size', () => {
    const customPriceRegex = /\.component-card-price--custom\s*\{[^}]*font-size:\s*26px;?[^}]*\}/i;
    assert.ok(
      customPriceRegex.test(cssContent),
      'component-pricing.css must declare .component-card-price--custom with font-size: 26px;'
    );
  });

  it('[ADV-12] AGENTS.md Rule 2: Zero console.* calls in client/views/pricing.view.ts', () => {
    const consoleRegex = /\bconsole\.(log|warn|error|info|debug)\s*\(/g;
    const matches = controllerTs.match(consoleRegex) || [];
    assert.strictEqual(
      matches.length,
      0,
      `Forbidden console calls found in pricing.view.ts: ${JSON.stringify(matches)}`
    );
  });

  it('[ADV-13] AGENTS.md Rule 7: Horizontal and Alphabetical Imports in Controller', () => {
    const lines = controllerTs.split(/\r?\n/);
    const importLines = lines.filter((l) => l.startsWith('import '));

    for (const imp of importLines) {
      assert.ok(!imp.includes('\n'), `Import statement is not on a single line: ${imp}`);
      const namedMatch = imp.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const members = namedMatch[1].split(',').map((m) => m.trim());
        const sorted = [...members].sort((a, b) => a.localeCompare(b));
        assert.deepStrictEqual(
          members,
          sorted,
          `Named imports not sorted alphabetically in line: ${imp}`
        );
      }
    }

    const modulePaths = importLines.map((imp) => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      return match ? match[1] : '';
    });
    const sortedModulePaths = [...modulePaths].sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(
      modulePaths,
      sortedModulePaths,
      `Import statements are not ordered alphabetically by module path: ${JSON.stringify(modulePaths)}`
    );
  });

  it('[ADV-14] AGENTS.md Rule 8: Zero JSDoc / Decorative Comments in Controller & Master Config', () => {
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const decorativeRegex = /\/\*+\s*={3,}[\s\S]*?\*+\//g;

    assert.strictEqual(
      (controllerTs.match(jsdocRegex) || []).length,
      0,
      'pricing.view.ts must not contain JSDoc blocks'
    );
    assert.strictEqual(
      (controllerTs.match(decorativeRegex) || []).length,
      0,
      'pricing.view.ts must not contain decorative banner comments'
    );

    assert.strictEqual(
      (masterConfigTs.match(jsdocRegex) || []).length,
      0,
      'subscription-plans.config.ts must not contain JSDoc blocks'
    );
    assert.strictEqual(
      (masterConfigTs.match(decorativeRegex) || []).length,
      0,
      'subscription-plans.config.ts must not contain decorative banner comments'
    );
  });

  it('[ADV-15] Master Config Pure Types and Zero Node/DOM Globals', () => {
    assert.ok(
      !masterConfigTs.includes('window.'),
      'subscription-plans.config.ts must not reference window'
    );
    assert.ok(
      !masterConfigTs.includes('document.'),
      'subscription-plans.config.ts must not reference document'
    );
    assert.ok(
      !masterConfigTs.includes('process.'),
      'subscription-plans.config.ts must not reference process'
    );
    assert.ok(
      fs.existsSync(clientGatewayPath),
      'Client gateway client/config/subscription-plans.config.ts must exist'
    );
  });
});
