import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: string) {
  results.push({
    suite,
    name,
    passed: condition,
    details: condition ? undefined : details
  });
  if (!condition) {
    console.error(`❌ [${suite}] ${name} FAILED: ${details || 'Assertion failed'}`);
  } else {
    console.log(`✅ [${suite}] ${name}`);
  }
}

// Simple tag balance checker for HTML fragments
function checkHtmlTagBalance(htmlContent: string): { balanced: boolean; errors: string[] } {
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'use']);
  const tagRegex = /<\/?([a-zA-Z0-9-]+)(\s+[^>]*?)?(\/?)>/g;
  const stack: { tag: string; index: number }[] = [];
  const errors: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isSelfClosing = match[3] === '/' || voidTags.has(tagName);
    const isClosing = fullTag.startsWith('</');

    if (isSelfClosing && !isClosing) {
      continue;
    }

    if (isClosing) {
      if (voidTags.has(tagName)) continue;
      if (stack.length === 0) {
        errors.push(`Unexpected closing tag </${tagName}> at char ${match.index}`);
      } else {
        const last = stack.pop()!;
        if (last.tag !== tagName) {
          errors.push(`Mismatched tag: expected </${last.tag}>, found </${tagName}> at char ${match.index}`);
        }
      }
    } else {
      stack.push({ tag: tagName, index: match.index });
    }
  }

  if (stack.length > 0) {
    for (const remaining of stack) {
      errors.push(`Unclosed tag <${remaining.tag}> at char ${remaining.index}`);
    }
  }

  return { balanced: errors.length === 0, errors };
}

function resolveRepoPath(rel: string): string {
  const candidate1 = path.resolve(rel);
  if (fs.existsSync(candidate1)) return candidate1;
  const stripped = rel.replace(/^apps[\\/]BoardPDF[\\/]/, '');
  const candidate2 = path.resolve(stripped);
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

function runOracle() {
  const rootDir = process.cwd();
  console.log(`Starting Milestone 2 Challenger 2 Oracle in ${rootDir}...\n`);

  // ==========================================
  // SUITE 1: Projects Navigation & Metadata Row
  // ==========================================
  const suite1 = 'Projects Navigation & Metadata';
  const projectsHtmlPath = resolveRepoPath('apps/BoardPDF/public/views/projects/projects.html');
  const projectsViewPath = resolveRepoPath('apps/BoardPDF/client/views/projects/projects.view.ts');
  const collabCssPath = resolveRepoPath('apps/BoardPDF/public/css/tools/collaborative-pdf.css');

  const projectsHtml = fs.readFileSync(projectsHtmlPath, 'utf8');
  const projectsView = fs.readFileSync(projectsViewPath, 'utf8');
  const collabCss = fs.readFileSync(collabCssPath, 'utf8');

  assert(suite1, 'projects.html completely lacks btn-back-projects', !projectsHtml.includes('btn-back-projects'), 'Found btn-back-projects in projects.html');
  assert(suite1, 'projects.html completely lacks projects-nav-actions', !projectsHtml.includes('projects-nav-actions'), 'Found projects-nav-actions in projects.html');
  assert(suite1, 'projects.html contains zero id attributes', !/\bid\s*=/i.test(projectsHtml), 'Found id attribute in projects.html');
  assert(suite1, 'projects.view.ts completely lacks btn-back-projects references', !projectsView.includes('btn-back-projects'), 'Found btn-back-projects in projects.view.ts');
  // Check metadata rows in projects.view.ts for zero inline styles
  const metaRowMatches = projectsView.match(/<div class="tool-card__meta-row"[^>]*>([\s\S]*?)<\/div>/g) || [];
  assert(suite1, 'Found at least 4 metadata rows in projects.view.ts', metaRowMatches.length >= 4, `Found ${metaRowMatches.length}`);
  let metaRowStyleCount = 0;
  for (const row of metaRowMatches) {
    if (/\bstyle\s*=/i.test(row)) {
      metaRowStyleCount++;
    }
  }
  assert(suite1, '.tool-card__meta-row instances contain zero inline styles', metaRowStyleCount === 0, `Found ${metaRowStyleCount} meta-row instances with inline style`);

  // Check badge pills in projects.view.ts for zero inline styles
  const badgePillMatches = projectsView.match(/<span class="tool-card__badge-pill"[^>]*>([\s\S]*?)<\/span>/g) || [];
  assert(suite1, 'Found at least 4 badge pill instances in projects.view.ts', badgePillMatches.length >= 4, `Found ${badgePillMatches.length}`);
  let badgePillStyleCount = 0;
  for (const pill of badgePillMatches) {
    if (/\bstyle\s*=/i.test(pill)) {
      badgePillStyleCount++;
    }
  }
  assert(suite1, '.tool-card__badge-pill instances contain zero inline styles', badgePillStyleCount === 0, `Found ${badgePillStyleCount} badge-pill instances with inline style`);

  // Check collaborative-pdf.css for gap: 6px on .tool-card__meta-row
  const metaRowRuleRegex = /\.tool-card--collab-doc\s+\.tool-card__meta-row\s*\{([^}]+)\}/s;
  const metaRowMatch = collabCss.match(metaRowRuleRegex);
  assert(suite1, 'collaborative-pdf.css defines .tool-card--collab-doc .tool-card__meta-row', metaRowMatch !== null, 'CSS rule for meta-row not found');
  if (metaRowMatch) {
    const metaRowBody = metaRowMatch[1];
    assert(suite1, '.tool-card__meta-row contains gap: 6px', /gap:\s*6px;/i.test(metaRowBody), `Expected gap: 6px;, got: ${metaRowBody.trim()}`);
    assert(suite1, '.tool-card__meta-row uses display: flex', /display:\s*flex;/i.test(metaRowBody), 'Expected display: flex');
  }

  // Check icon styling in collaborative-pdf.css
  const iconRuleRegex = /\.tool-card--collab-doc\s+\.tool-card__meta-row\s+\.component-icon\s*\{([^}]+)\}/s;
  const iconMatch = collabCss.match(iconRuleRegex);
  assert(suite1, 'collaborative-pdf.css styles .tool-card__meta-row .component-icon', iconMatch !== null, 'Icon rule missing');
  if (iconMatch) {
    const iconBody = iconMatch[1];
    assert(suite1, 'Icon in meta-row specifies height: 12px and width: 12px', /height:\s*12px/i.test(iconBody) && /width:\s*12px/i.test(iconBody), `Icon dimensions missing in: ${iconBody.trim()}`);
    assert(suite1, 'Icon in meta-row specifies flex-shrink: 0', /flex-shrink:\s*0/i.test(iconBody), 'flex-shrink: 0 missing on icon');
  }

  // ==========================================
  // SUITE 2: Policy Pages DOM & Padding Unification
  // ==========================================
  const suite2 = 'Policy Pages DOM & Padding';
  const policyPages = [
    { name: 'terms', path: 'apps/BoardPDF/public/views/help/terms.html', expectedGroups: 11 },
    { name: 'privacy', path: 'apps/BoardPDF/public/views/help/privacy.html', expectedGroups: 13 },
    { name: 'cookies', path: 'apps/BoardPDF/public/views/help/cookies.html', expectedGroups: 6 },
    { name: 'security', path: 'apps/BoardPDF/public/views/help/security.html', expectedGroups: 6 }
  ];

  for (const page of policyPages) {
    const content = fs.readFileSync(resolveRepoPath(page.path), 'utf8');

    // Tag balance
    const tagCheck = checkHtmlTagBalance(content);
    assert(suite2, `${page.name}.html has balanced HTML tags`, tagCheck.balanced, tagCheck.errors.join('; '));

    // Zero IDs and inline styles
    assert(suite2, `${page.name}.html has 0 id attributes`, !/\bid\s*=/i.test(content), 'Found id in ' + page.name);
    assert(suite2, `${page.name}.html has 0 inline styles`, !/\bstyle\s*=/i.test(content), 'Found style in ' + page.name);

    // Attribute order check: class must be first attribute for <div>, <p>, <h2>, etc.
    const tagAttrRegex = /<([a-z0-9-]+)(\s+[^>]*?)>/gi;
    let attrOrderFailures: string[] = [];
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = tagAttrRegex.exec(content)) !== null) {
      const tag = attrMatch[1].toLowerCase();
      const attrsStr = attrMatch[2].trim();
      if (!attrsStr) continue;

      if (tag === 'button') {
        const firstAttr = attrsStr.split(/\s+/)[0];
        if (!firstAttr.startsWith('type=')) {
          attrOrderFailures.push(`button tag at char ${attrMatch.index} does not have type first: ${attrsStr}`);
        }
      } else if (attrsStr.includes('class=')) {
        const firstAttr = attrsStr.split(/\s+/)[0];
        if (!firstAttr.startsWith('class=')) {
          attrOrderFailures.push(`${tag} tag at char ${attrMatch.index} has class but not first: ${attrsStr}`);
        }
      }
    }
    assert(suite2, `${page.name}.html complies with HTML attribute order rule`, attrOrderFailures.length === 0, attrOrderFailures.slice(0, 3).join('; '));

    // Group and item hierarchy
    const groupMatches = content.match(/<div\s+class="component-group"[^>]*>/g) || [];
    const stackedItemMatches = content.match(/<div\s+class="component-item\s+component-item--stacked"[^>]*>/g) || [];
    const contentMatches = content.match(/<div\s+class="component-item__content"[^>]*>/g) || [];
    const textMatches = content.match(/<div\s+class="component-item__text"[^>]*>/g) || [];

    assert(suite2, `${page.name}.html has expected group count (${page.expectedGroups})`, groupMatches.length === page.expectedGroups, `Found ${groupMatches.length} groups, expected ${page.expectedGroups}`);
    assert(suite2, `${page.name}.html has 1-to-1 stacked items per group`, stackedItemMatches.length === groupMatches.length, `Groups: ${groupMatches.length}, Items: ${stackedItemMatches.length}`);
    assert(suite2, `${page.name}.html has 1-to-1 content elements per item`, contentMatches.length === stackedItemMatches.length, `Items: ${stackedItemMatches.length}, Contents: ${contentMatches.length}`);
    assert(suite2, `${page.name}.html has component-item__text per content`, textMatches.length >= contentMatches.length, `Contents: ${contentMatches.length}, Texts: ${textMatches.length}`);
  }

  // Confirm component-settings.css is untouched and provides padding
  const settingsCssPath = resolveRepoPath('apps/BoardPDF/public/css/components/component-settings.css');
  const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

  // Verify padding: 20px 24px in .component-item
  const componentItemRegex = /\.component-item,\s*\.settings-item\s*\{([^}]+)\}/s;
  const componentItemMatch = settingsCss.match(componentItemRegex);
  assert(suite2, 'component-settings.css defines .component-item with padding: 20px 24px', componentItemMatch !== null && /padding:\s*20px\s+24px;/i.test(componentItemMatch[1]), 'padding: 20px 24px missing in .component-item');

  // Verify .component-item--stacked defines flex-direction: column
  const stackedRegex = /\.component-item--stacked,\s*\.settings-item--stacked\s*\{([^}]+)\}/s;
  const stackedMatch = settingsCss.match(stackedRegex);
  assert(suite2, 'component-settings.css defines .component-item--stacked with flex-direction: column', stackedMatch !== null && /flex-direction:\s*column;/i.test(stackedMatch[1]), 'flex-direction: column missing in .component-item--stacked');

  // ==========================================
  // SUITE 3: i18n General.json & Keys Resolution
  // ==========================================
  const suite3 = 'i18n General.json Validation';
  const generalJsonPath = resolveRepoPath('apps/BoardPDF/public/translations/es/general.json');
  let generalJson: any = null;
  try {
    generalJson = JSON.parse(fs.readFileSync(generalJsonPath, 'utf8'));
    assert(suite3, 'general.json is valid parseable JSON', true);
  } catch (err: any) {
    assert(suite3, 'general.json is valid parseable JSON', false, err.message);
  }

  function resolveKey(obj: any, keyPath: string): string | undefined {
    const parts = keyPath.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return undefined;
      }
    }
    return typeof curr === 'string' ? curr : undefined;
  }

  const requiredCheckoutKeys = [
    'checkout.step2_benefit_1',
    'checkout.secure_processing',
    'checkout.modal_desc',
    'checkout.error_connecting_gateway',
    'checkout.error_initializing_payment'
  ];

  for (const k of requiredCheckoutKeys) {
    const val = resolveKey(generalJson, k);
    assert(suite3, `Key "${k}" resolves to valid string`, typeof val === 'string' && val.trim().length > 0, `Value: ${val}`);
    assert(suite3, `Key "${k}" does not mention Stripe`, typeof val === 'string' && !val.toLowerCase().includes('stripe'), `Stripe mentioned in: ${val}`);
  }

  // Workflows keys check
  const workflowKeys = ['workflows.create_title', 'workflows.create_desc'];
  for (const k of workflowKeys) {
    const val = resolveKey(generalJson, k);
    assert(suite3, `Workflow key "${k}" resolves`, typeof val === 'string' && val.trim().length > 0, `Value: ${val}`);
  }

  // Verify data-i18n keys in checkout.html
  const checkoutHtmlPath = resolveRepoPath('apps/BoardPDF/public/views/checkout/checkout.html');
  const checkoutHtml = fs.readFileSync(checkoutHtmlPath, 'utf8');
  const checkoutI18nMatches = checkoutHtml.match(/data-i18n="([^"]+)"/g) || [];
  for (const attr of checkoutI18nMatches) {
    const key = attr.replace('data-i18n="', '').replace('"', '');
    const resolved = resolveKey(generalJson, key);
    assert(suite3, `checkout.html data-i18n key "${key}" resolves in general.json`, resolved !== undefined, `Unresolved key: ${key}`);
  }

  // ==========================================
  // SUITE 4: Zero User-Facing Stripe Mentions
  // ==========================================
  const suite4 = 'Zero Stripe Mentions Audit';
  assert(suite4, 'checkout.html has 0 visible user-facing Stripe mentions', !/>[^<]*stripe[^<]*</i.test(checkoutHtml), 'Found Stripe in text node of checkout.html');

  const checkoutModalPath = resolveRepoPath('apps/BoardPDF/client/components/checkout-modal.component.ts');
  const checkoutModal = fs.readFileSync(checkoutModalPath, 'utf8');
  // Check modal lines for user-facing text containing stripe
  const modalLines = checkoutModal.split('\n');
  const suspiciousModalLines = modalLines.filter((l) => {
    if (!/stripe/i.test(l)) return false;
    // Allow imports, variable names, SDK calls, and mount points
    if (/import|loadStripeSdk|getStripeAppearance|stripe:|stripe\.|data-ref="stripe-payment-mount-point"|stripe-payment-mount-point/i.test(l)) return false;
    return true;
  });
  assert(suite4, 'checkout-modal.component.ts has no user-facing Stripe strings', suspiciousModalLines.length === 0, `Suspicious lines: ${suspiciousModalLines.join('; ')}`);

  const checkoutViewTsPath = resolveRepoPath('apps/BoardPDF/client/views/checkout.view.ts');
  const checkoutViewTs = fs.readFileSync(checkoutViewTsPath, 'utf8');
  const viewLines = checkoutViewTs.split('\n');
  const suspiciousViewLines = viewLines.filter((l) => {
    if (!/stripe/i.test(l)) return false;
    if (/import|loadStripeSdk|getStripeAppearance|private stripe|this\.stripe|data-ref="stripe-payment-mount-point"|stripe-payment-mount-point/i.test(l)) return false;
    return true;
  });
  assert(suite4, 'checkout.view.ts has no user-facing Stripe strings', suspiciousViewLines.length === 0, `Suspicious lines: ${suspiciousViewLines.join('; ')}`);

  // ==========================================
  // SUITE 5: Client-Side Avatar Data URI & Zero Inline Styles
  // ==========================================
  const suite5 = 'Avatar Util & Zero Inline Styles';
  const avatarUtilPath = resolveRepoPath('apps/BoardPDF/client/utils/avatar.util.ts');
  const avatarUtil = fs.readFileSync(avatarUtilPath, 'utf8');

  assert(suite5, 'avatar.util.ts contains zero inline styles (style=)', !/\bstyle\s*=/i.test(avatarUtil), 'Found style= in avatar.util.ts');
  assert(suite5, 'avatar.util.ts contains zero onerror inline handlers', !/\bonerror\s*=/i.test(avatarUtil), 'Found onerror= in avatar.util.ts');
  assert(suite5, 'avatar.util.ts exports getAvatarDataUri', avatarUtil.includes('export function getAvatarDataUri'), 'getAvatarDataUri export missing');
  assert(suite5, 'avatar.util.ts uses table-user-avatar--${tier}', avatarUtil.includes('table-user-avatar--${tier}'), 'tier class hook missing');

  const avatarsCssPath = resolveRepoPath('apps/BoardPDF/public/css/components/component-avatars.css');
  assert(suite5, 'component-avatars.css exists', fs.existsSync(avatarsCssPath), 'component-avatars.css not found');
  if (fs.existsSync(avatarsCssPath)) {
    const avatarsCss = fs.readFileSync(avatarsCssPath, 'utf8');
    assert(suite5, 'component-avatars.css defines tier background rules', avatarsCss.includes('.table-user-avatar--free') && avatarsCss.includes('.table-user-avatar--pro'), 'Tier background rules missing');
  }

  const userMenuPath = resolveRepoPath('apps/BoardPDF/client/components/layout-user-menu.component.ts');
  const userMenu = fs.readFileSync(userMenuPath, 'utf8');
  assert(suite5, 'layout-user-menu.component.ts has no .style.display mutations', !/\.style\.display\s*=/i.test(userMenu), 'Found .style.display in user menu');
  assert(suite5, 'layout-user-menu.component.ts uses is-hidden class toggle', userMenu.includes('is-hidden'), 'is-hidden class missing in user menu');

  // ==========================================
  // SUMMARY & VERDICT
  // ==========================================
  console.log('\n==========================================');
  console.log('ORACLE VERIFICATION SUMMARY:');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total assertions: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILURES:');
    for (const f of results.filter(r => !r.passed)) {
      console.error(`- [${f.suite}] ${f.name}: ${f.details}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ORACLE ASSERTIONS PASSED WITH ZERO ERRORS!');
  }
}

runOracle();
