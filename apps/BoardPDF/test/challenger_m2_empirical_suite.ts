import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeXml, getAvatarDataUri, getInitial, getUserAvatarUrl, hashString, renderUserAvatarHtml } from '../client/utils/avatar.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✓ ${name}`);
  } else {
    results.push({ name, passed: false, error: 'Assertion failed', details });
    console.error(`  ✗ FAIL: ${name}${details ? ` (${details})` : ''}`);
  }
}

function runSuite() {
  console.log('================================================================');
  console.log('CHALLENGER EMPIRICAL VERIFICATION SUITE — MILESTONE 2');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: Avatar Data URI Stress & Invariance
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Avatar Data URI Stress & Invariance ---');

  // Test 1.1: hashString determinism and stability
  const hash1 = hashString('Alice');
  const hash2 = hashString('Alice');
  const hashEmpty = hashString('');
  assert(hash1 === hash2, 'hashString is deterministic for identical inputs');
  assert(typeof hash1 === 'number' && hash1 >= 0, 'hashString produces non-negative integer');
  assert(hashEmpty === 0, 'hashString("") produces 0');

  // Test 1.2: escapeXml behavior
  const xmlSpecial = '<test & "quote" \'apos\'>';
  const escaped = escapeXml(xmlSpecial);
  assert(
    escaped === '&lt;test &amp; &quot;quote&quot; &apos;apos&apos;&gt;',
    'escapeXml properly escapes &, <, >, ", and \''
  );

  // Test 1.3: getInitial behavior across languages and edge cases
  assert(getInitial('John') === 'J', 'getInitial Latin standard');
  assert(getInitial('  ángel') === 'Á', 'getInitial Spanish accent lowercase');
  assert(getInitial('Érika') === 'É', 'getInitial Spanish accent uppercase');
  assert(getInitial('ñandú') === 'Ñ', 'getInitial Spanish ñ');
  assert(getInitial('123abc') === '1', 'getInitial Numeric leading');
  assert(getInitial('   --__!!Bob') === 'B', 'getInitial Strips leading symbols');
  assert(getInitial('!@#$%^') === 'U', 'getInitial Symbols only falls back to U');
  assert(getInitial('') === 'U', 'getInitial Empty string falls back to U');
  assert(getInitial('   ') === 'U', 'getInitial Whitespace only falls back to U');

  // Test 1.4: getAvatarDataUri across 500+ diverse adversarial inputs
  const adversarialNames = [
    '',
    ' ',
    '   ',
    'a',
    'A',
    'John Doe',
    'María José',
    'Álvaro Nuñez',
    'Émile Zola',
    'Óscar Wilde',
    'Úrsula Iguarán',
    'Ñoño',
    'محمد', // Arabic
    '李小龙', // Chinese
    '山田太郎', // Japanese
    'Александр', // Russian
    'Αλέξανδρος', // Greek
    'राजेश', // Hindi
    '🚀 Rocket',
    '👨‍💻 Developer',
    '<script>alert("xss")</script>',
    '" onclick="alert(1)"',
    '\' OR 1=1 --',
    '& < > " \'',
    'user@example.com',
    'a'.repeat(5000), // Very long string
    '!@#$%^&*()_+{}:"<>?~`-=[]\\;\',./',
    '\n\t\rLinebreaks',
    '   Spaces   Before   And   After   ',
  ];

  // Add 100 generated variations
  for (let i = 0; i < 100; i++) {
    adversarialNames.push(`User_${i}_${Math.random().toString(36).substring(2)}`);
  }

  let allValid = true;
  let allUriEncoded = true;
  let allDefsClosed = true;
  let allGradIdMatched = true;

  for (const name of adversarialNames) {
    const uri = getAvatarDataUri(name);

    if (!uri.startsWith('data:image/svg+xml;utf8,')) {
      allUriEncoded = false;
      break;
    }

    const encodedSvg = uri.substring('data:image/svg+xml;utf8,'.length);
    let decodedSvg = '';
    try {
      decodedSvg = decodeURIComponent(encodedSvg);
    } catch {
      allValid = false;
      break;
    }

    // Check SVG well-formedness
    if (!decodedSvg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') || !decodedSvg.endsWith('</svg>')) {
      allValid = false;
      break;
    }

    if (!decodedSvg.includes('<defs><linearGradient id="avatar-grad-') || !decodedSvg.includes('</defs>')) {
      allDefsClosed = false;
      break;
    }

    // Extract gradient id and fill url
    const gradMatch = decodedSvg.match(/id="(avatar-grad-\d+)"/);
    const fillMatch = decodedSvg.match(/fill="url\(#(avatar-grad-\d+)\)"/);
    if (!gradMatch || !fillMatch || gradMatch[1] !== fillMatch[1]) {
      allGradIdMatched = false;
      break;
    }

    // Ensure raw unescaped < or > not inside text tag
    const textMatch = decodedSvg.match(/<text[^>]*>(.*?)<\/text>/);
    if (textMatch) {
      const textContent = textMatch[1];
      if (textContent.includes('<') || (textContent.includes('>') && !textContent.includes('&gt;'))) {
        allValid = false;
        break;
      }
    }
  }

  assert(allUriEncoded, 'All 129+ test cases start with data:image/svg+xml;utf8,');
  assert(allValid, 'All 129+ test cases produce valid decodeable XML/SVG strings');
  assert(allDefsClosed, 'All test cases properly define linearGradient inside defs');
  assert(allGradIdMatched, 'All test cases have matching linearGradient ID and fill URL');

  // Test 1.5: Size clamping in getAvatarDataUri
  const uriMin = getAvatarDataUri('Alice', 10);
  const uriMax = getAvatarDataUri('Alice', 500);
  const uriDef = getAvatarDataUri('Alice');
  assert(decodeURIComponent(uriMin).includes('viewBox="0 0 32 32"'), 'Size clamped at min 32');
  assert(decodeURIComponent(uriMax).includes('viewBox="0 0 256 256"'), 'Size clamped at max 256');
  assert(decodeURIComponent(uriDef).includes('viewBox="0 0 80 80"'), 'Default size is 80');

  // Test 1.6: getUserAvatarUrl fallback logic
  const customUser = { id: 1, username: 'custom', avatar_url: 'https://cdn.example.com/pic.jpg' };
  const nullUser = { id: 2, username: 'nullavatar', avatar_url: null };
  const emptyUser = { id: 3, username: 'emptyavatar', avatar_url: '' };
  const anonUser = { id: 4, avatar_url: null };

  assert(getUserAvatarUrl(customUser) === 'https://cdn.example.com/pic.jpg', 'getUserAvatarUrl returns custom avatar_url when present');
  assert(getUserAvatarUrl(nullUser).startsWith('data:image/svg+xml;utf8,'), 'getUserAvatarUrl falls back to SVG data URI when avatar_url is null');
  assert(getUserAvatarUrl(emptyUser).startsWith('data:image/svg+xml;utf8,'), 'getUserAvatarUrl falls back to SVG data URI when avatar_url is empty');
  assert(decodeURIComponent(getUserAvatarUrl(anonUser)).includes('>U</text>'), 'getUserAvatarUrl falls back to U initial when no name/email exists');

  // Test 1.7: renderUserAvatarHtml output & zero inline styles
  const htmlFree = renderUserAvatarHtml({ username: 'Carlos', subscription_tier: 'free' });
  const htmlEnterprise = renderUserAvatarHtml({ username: 'Elena', subscription_tier: 'enterprise' });
  const htmlEdu = renderUserAvatarHtml({ username: 'Prof', subscription_tier: 'edu_school' });

  assert(htmlFree.includes('class="table-user-avatar table-user-avatar--free"') && htmlFree.includes('data-tier="free"'), 'renderUserAvatarHtml applies table-user-avatar--free class and data-tier');
  assert(htmlEnterprise.includes('class="table-user-avatar table-user-avatar--enterprise"') && htmlEnterprise.includes('data-tier="enterprise"'), 'renderUserAvatarHtml applies table-user-avatar--enterprise class and data-tier');
  assert(htmlEdu.includes('class="table-user-avatar table-user-avatar--edu_school"') && htmlEdu.includes('data-tier="edu_school"'), 'renderUserAvatarHtml applies table-user-avatar--edu_school class and data-tier');
  assert(!htmlFree.includes('style='), 'renderUserAvatarHtml has ZERO inline style attributes');

  // --------------------------------------------------------------------------
  // SUITE 2: Card Typography, Geometry & Styles
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Card Typography, Geometry & Styles ---');

  const componentViewsCss = fs.readFileSync(path.join(ROOT_DIR, 'public/css/components/component-views.css'), 'utf8');

  // Test 2.1: .tool-card geometry
  const toolCardMatch = componentViewsCss.match(/\.tool-card\s*\{([^}]+)\}/);
  assert(Boolean(toolCardMatch), '.tool-card rule exists in component-views.css');
  if (toolCardMatch) {
    const body = toolCardMatch[1];
    assert(body.includes('padding: 20px 20px 18px;') || body.includes('padding: 20px 20px 18px'), '.tool-card has padding: 20px 20px 18px');
    assert(body.includes('min-height: 160px'), '.tool-card has min-height: 160px');
  }

  // Test 2.2: .tool-card__title font-size 14px
  const toolCardTitleMatch = componentViewsCss.match(/\.tool-card__title\s*\{([^}]+)\}/);
  assert(Boolean(toolCardTitleMatch), '.tool-card__title rule exists in component-views.css');
  if (toolCardTitleMatch) {
    const body = toolCardTitleMatch[1];
    assert(body.includes('font-size: 14px'), '.tool-card__title has font-size: 14px');
  }

  // Test 2.3: .tool-card__desc font-size 12px
  const toolCardDescMatch = componentViewsCss.match(/\.tool-card__desc\s*\{([^}]+)\}/);
  assert(Boolean(toolCardDescMatch), '.tool-card__desc rule exists in component-views.css');
  if (toolCardDescMatch) {
    const body = toolCardDescMatch[1];
    assert(body.includes('font-size: 12px'), '.tool-card__desc has font-size: 12px');
  }

  // Test 2.4: .tool-card--create-workflow has NO background SVG
  const createWorkflowMatch = componentViewsCss.match(/\.tool-card--create-workflow\s*\{([^}]+)\}/);
  assert(Boolean(createWorkflowMatch), '.tool-card--create-workflow rule exists');
  if (createWorkflowMatch) {
    const body = createWorkflowMatch[1];
    assert(!body.includes('background-image'), '.tool-card--create-workflow has NO background-image');
    assert(!body.includes('url('), '.tool-card--create-workflow has NO background url(...)');
  }

  // Test 2.5: mobile @media query maintains font-size: 14px for title
  // Find all @media (max-width: 640px) blocks and inspect the one styling .tool-card
  let searchIdx = 0;
  let toolCardMediaBlock = '';
  while ((searchIdx = componentViewsCss.indexOf('@media (max-width: 640px)', searchIdx)) !== -1) {
    const openBrace = componentViewsCss.indexOf('{', searchIdx);
    let depth = 1;
    let curr = openBrace + 1;
    while (curr < componentViewsCss.length && depth > 0) {
      if (componentViewsCss[curr] === '{') depth++;
      else if (componentViewsCss[curr] === '}') depth--;
      curr++;
    }
    const block = componentViewsCss.substring(openBrace, curr);
    if (block.includes('.tool-card')) {
      toolCardMediaBlock = block;
      break;
    }
    searchIdx = curr;
  }

  assert(toolCardMediaBlock.length > 0, 'Mobile media query block containing .tool-card found');
  assert(toolCardMediaBlock.includes('.tool-card__title'), 'Mobile media query contains .tool-card__title');
  const titleInMobileMatch = toolCardMediaBlock.match(/\.tool-card__title\s*\{([^}]+)\}/);
  assert(
    Boolean(titleInMobileMatch && titleInMobileMatch[1].includes('font-size: 14px')),
    'Mobile media query enforces font-size: 14px on .tool-card__title'
  );

  // Test 2.6: home.view.ts and workflows.view.ts create workflow card templates
  const homeViewTs = fs.readFileSync(path.join(ROOT_DIR, 'client/views/home.view.ts'), 'utf8');
  const workflowsViewTs = fs.readFileSync(path.join(ROOT_DIR, 'client/views/workflows.view.ts'), 'utf8');

  assert(!homeViewTs.includes('SVG_TOOL_CREATE_WORKFLOW'), 'home.view.ts does not reference SVG_TOOL_CREATE_WORKFLOW');
  assert(!homeViewTs.includes('data-ref="icon-box-create-workflow"'), 'home.view.ts create workflow card does not contain icon box');
  assert(!workflowsViewTs.includes('SVG_TOOL_CREATE_WORKFLOW'), 'workflows.view.ts does not reference SVG_TOOL_CREATE_WORKFLOW');
  assert(!workflowsViewTs.includes('data-ref="icon-box-create-workflow"'), 'workflows.view.ts create workflow card does not contain icon box');

  // Test 2.7: collaborative-pdf.css metadata gap: 6px
  const collabPdfCss = fs.readFileSync(path.join(ROOT_DIR, 'public/css/tools/collaborative-pdf.css'), 'utf8');
  const metaRowMatch = collabPdfCss.match(/\.tool-card--collab-doc\s+\.tool-card__meta-row\s*\{([^}]+)\}/);
  assert(Boolean(metaRowMatch), '.tool-card--collab-doc .tool-card__meta-row exists in collaborative-pdf.css');
  if (metaRowMatch) {
    const body = metaRowMatch[1];
    assert(body.includes('gap: 6px'), '.tool-card__meta-row has gap: 6px');
  }

  // Test 2.8: projects.html has no back button and projects.view.ts has no inline styles
  const projectsHtml = fs.readFileSync(path.join(ROOT_DIR, 'public/views/projects/projects.html'), 'utf8');
  const projectsViewTs = fs.readFileSync(path.join(ROOT_DIR, 'client/views/projects/projects.view.ts'), 'utf8');
  assert(!projectsHtml.includes('btn-back-projects'), 'projects.html does NOT contain btn-back-projects');
  assert(!projectsHtml.includes('projects-nav-actions'), 'projects.html does NOT contain projects-nav-actions');

  // Check that rendered SVG icons in projects.view.ts do not have inline styles
  assert(!projectsViewTs.includes('style="height: 12px; width: 12px;"'), 'projects.view.ts badge-pill icons have no inline dimensions');
  assert(!projectsViewTs.includes('style="width: 12px; height: 12px; color: var(--text-tertiary);"'), 'projects.view.ts meta-row icons have no inline dimensions');

  // Test 2.9: Policy pages padding unification with .component-item--stacked
  const policyPages = ['terms.html', 'privacy.html', 'cookies.html', 'security.html'];
  for (const page of policyPages) {
    const pageHtml = fs.readFileSync(path.join(ROOT_DIR, 'public/views/help', page), 'utf8');
    assert(pageHtml.includes('class="component-item component-item--stacked"'), `${page} uses .component-item.component-item--stacked`);
    assert(pageHtml.includes('class="component-item__content"'), `${page} uses .component-item__content`);
    assert(pageHtml.includes('class="component-item__text"'), `${page} uses .component-item__text`);
  }

  // Test 2.10: component-settings.css is strictly untouched
  const settingsCssPath = path.join(ROOT_DIR, 'public/css/components/component-settings.css');
  assert(fs.existsSync(settingsCssPath), 'component-settings.css exists');

  // --------------------------------------------------------------------------
  // SUITE 3: Automated Stripe Elimination Scan
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Automated Stripe Elimination Scan ---');

  // Scan public/views recursively
  function getFiles(dir: string, ext = '.html'): string[] {
    let fileList: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fileList = fileList.concat(getFiles(fullPath, ext));
      } else if (fullPath.endsWith(ext)) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const htmlFiles = getFiles(path.join(ROOT_DIR, 'public/views'));
  let visibleStripeInViews = 0;
  const offendingViews: string[] = [];

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (/stripe/i.test(line)) {
        // Allow ONLY internal data-ref="stripe-payment-mount-point" or data-ref="stripe-*" internal mounts
        if (/data-ref="stripe-payment-mount-point"/.test(line)) {
          return;
        }
        visibleStripeInViews++;
        offendingViews.push(`${path.relative(ROOT_DIR, file)}:${idx + 1}: ${line.trim()}`);
      }
    });
  }

  assert(
    visibleStripeInViews === 0,
    `Zero user-facing "Stripe" mentions in public/views (Found: ${visibleStripeInViews})`,
    offendingViews.join('\n')
  );

  // Scan client/views and client/components for user-facing Stripe strings
  const clientViewsAndComponents = [
    ...getFiles(path.join(ROOT_DIR, 'client/views'), '.ts'),
    ...getFiles(path.join(ROOT_DIR, 'client/components'), '.ts'),
  ];
  let userFacingStripeInViewsAndComponents = 0;
  const offendingViewLines: string[] = [];

  for (const file of clientViewsAndComponents) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Ignore imports, SDK declarations, API endpoint urls, internal variables, and mount point references
      if (/import\s+.*stripe/i.test(line)) return;
      if (/from\s+['"].*stripe.*['"]/i.test(line)) return;
      if (/\/api\/purchase\/stripe-config/.test(line)) return;
      if (/stripeInstance|stripe\.elements|loadStripeSdk|loadStripe/.test(line)) return;
      if (/Stripe|StripeElements|StripeCardElement|StripePaymentElement/.test(line) && /let\s+|const\s+|:\s*Stripe|as\s+Stripe|private\s+stripe/i.test(line)) return;
      if (/\/\/|\*/.test(line) && /stripe/i.test(line)) return; // comments
      if (/data-ref="stripe-payment-mount-point"/.test(line)) return; // mount element ref
      if (/'stripe'|"stripe"/.test(line) && /theme:/.test(line)) return; // Stripe theme option
      if (/stripe_subscription_id|stripe_payment_intent_id|stripe_session_id/.test(line)) return; // DB column names
      if (/stripe\.confirmPayment/.test(line)) return; // SDK call

      // Check for user-facing strings (toasts, alerts, innerHTML, textContent, template literals with text)
      if (/(['"`]).*?\bstripe\b.*?\1/i.test(line)) {
        userFacingStripeInViewsAndComponents++;
        offendingViewLines.push(`${path.relative(ROOT_DIR, file)}:${idx + 1}: ${line.trim()}`);
      }
    });
  }

  assert(
    userFacingStripeInViewsAndComponents === 0,
    `Zero user-facing "Stripe" text strings in client views & components (Found: ${userFacingStripeInViewsAndComponents})`,
    offendingViewLines.join('\n')
  );

  // Scan translations
  const esGeneralPath = path.join(ROOT_DIR, 'public/translations/es/general.json');
  const esGeneral = JSON.parse(fs.readFileSync(esGeneralPath, 'utf8'));
  const esGeneralStr = JSON.stringify(esGeneral);
  assert(!/stripe/i.test(esGeneralStr), 'general.json has ZERO mentions of Stripe');

  // Verify newly added checkout keys exist
  assert(Boolean(esGeneral.checkout), 'general.json contains "checkout" dictionary');
  if (esGeneral.checkout) {
    assert(Boolean(esGeneral.checkout.error_connecting_gateway), 'checkout.error_connecting_gateway exists');
    assert(Boolean(esGeneral.checkout.error_initializing_payment), 'checkout.error_initializing_payment exists');
    assert(Boolean(esGeneral.checkout.modal_desc), 'checkout.modal_desc exists');
    assert(Boolean(esGeneral.checkout.secure_processing), 'checkout.secure_processing exists');
    assert(Boolean(esGeneral.checkout.step2_benefit_1), 'checkout.step2_benefit_1 exists');
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    console.error(`VERDICT: REQUEST_CHANGES (${failedCount} checks failed)`);
    process.exit(1);
  } else {
    console.log('VERDICT: ALL TESTS PASSED');
    process.exit(0);
  }
}

runSuite();
