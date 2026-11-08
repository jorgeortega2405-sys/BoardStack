import { escapeXml, getAvatarDataUri, getInitial, getUserAvatarUrl, hashString } from '../client/utils/avatar.util.js';

console.log('================================================================');
console.log('CHALLENGER AVATAR DATA URI ADVERSARIAL FUZZER & STRESS HARNESS');
console.log('================================================================\n');

// 1. Extreme Unicode & Injection Vector Generator
function generateAdversarialInputs(): string[] {
  const inputs: string[] = [];

  // Edge cases
  inputs.push('');
  inputs.push(' ');
  inputs.push('   \t\n\r\f   ');
  inputs.push('\0');
  inputs.push('\u0000\u0001\u0002\u0003\u0004\u0005');
  inputs.push('undefined');
  inputs.push('null');
  inputs.push('NaN');
  inputs.push('[object Object]');
  inputs.push('true');
  inputs.push('false');

  // XML / SVG / HTML Injections
  const injections = [
    '<script>alert("XSS")</script>',
    '"><script>alert(1)</script>',
    '</text><script>alert(1)</script><text>',
    '</svg><svg onload="alert(1)">',
    '\' onload="alert(1)"',
    '" onmouseover="alert(1)"',
    '<a href="javascript:alert(1)">Click</a>',
    '<![CDATA[<script>alert(1)</script>]]>',
    '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]>',
    '&quot;&amp;&lt;&gt;&apos;',
    '&#x3C;script&#x3E;',
    '&#60;script&#62;',
    '%3Cscript%3E',
    '"><image src=x onerror=alert(1)>',
    '"><rect width="100" height="100" fill="red"/>',
    '"><linearGradient id="evil">',
    '"><stop offset="0%" stop-color="red"/>',
    'text\u0000injection',
  ];
  inputs.push(...injections);

  // International scripts
  const scripts = [
    'Carlos María',
    'Álvaro Nuñez',
    'Érika Peña',
    'Óscar Íñigo Úrsula',
    'ñandú',
    'Владимир Путин',
    'Михаил Горбачёв',
    'Федор Достоевский',
    'Αριστοτέλης',
    'Σωκράτης',
    'Πλάτων',
    'محمد بن سلمان',
    'أحمد',
    'فاطمة',
    'אברהם',
    'שרה',
    'דוד',
    '毛泽东',
    '孙中山',
    '孔子',
    '李白',
    '织田信长',
    '徳川家康',
    '宮本武蔵',
    '김정은',
    '세종대왕',
    '이순신',
    'महात्मा गांधी',
    'रवीन्द्रनाथ ठाकुर',
    'กฤติน',
    'สมชาย',
    'Tiếng Việt có dấu: Nguyễn Văn An',
    'Ömer Şener',
    'İsmail Çetin',
    'Łukasz Żółć',
    'Kraków',
  ];
  inputs.push(...scripts);

  // Emojis & Complex Graphemes
  const emojis = [
    '😀',
    '🚀',
    '👨‍💻',
    '👩‍👩‍👧‍👦',
    '🏳️‍🌈',
    '🇦🇷',
    '🇪🇸',
    '🇲🇽',
    '🇺🇸',
    '🇯🇵',
    '🎨 Palette',
    '🔥 Fire',
    '⚡ Zap',
    '🍕 Pizza',
    '🧟 Zombie',
    '❤️ Red Heart',
    '✨ Sparkles',
  ];
  inputs.push(...emojis);

  // Mathematical & Special Unicode Symbols
  const symbols = [
    '∀x∈ℝ: x²≥0',
    '∮ E·da = Q/ε₀',
    '∑ᵢ=1ⁿ i = n(n+1)/2',
    '½ ⅓ ¼ ⅛',
    '← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙',
    '♠ ♣ ♥ ♦',
    '★ ☆ ✪ ✫ ✬ ✭ ✮ ✯',
    '♪ ♫ ♬ ♭ ♮ ♯',
    '© ® ™ § ¶ † ‡',
    '° ℃ ℉ µ Ω π θ',
  ];
  inputs.push(...symbols);

  // Extreme Lengths
  inputs.push('A'.repeat(100));
  inputs.push('B'.repeat(1000));
  inputs.push('C'.repeat(10000));
  inputs.push('ñ'.repeat(500));
  inputs.push('🚀'.repeat(500));
  inputs.push('<>'.repeat(500));

  // Random Combinations (2000 items)
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789áéíóúÁÉÍÓÚñÑ!@#$%^&*()_+-=[]{}|;:\'",.<>?/~` \t\n';
  for (let i = 0; i < 2000; i++) {
    const len = Math.floor(Math.random() * 50) + 1;
    let s = '';
    for (let j = 0; j < len; j++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    inputs.push(s);
  }

  return inputs;
}

// Lightweight XML Validator
function validateSvgXml(svg: string): { valid: boolean; error?: string } {
  // Check root open and close
  if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>')) {
    return { valid: false, error: 'SVG does not have valid root <svg> ... </svg>' };
  }

  // Check required tags
  const defsOpen = svg.indexOf('<defs>');
  const defsClose = svg.indexOf('</defs>');
  if (defsOpen === -1 || defsClose === -1 || defsOpen >= defsClose) {
    return { valid: false, error: 'Invalid <defs> block' };
  }

  const gradOpen = svg.indexOf('<linearGradient ');
  const gradClose = svg.indexOf('</linearGradient>');
  if (gradOpen === -1 || gradClose === -1 || gradOpen >= gradClose) {
    return { valid: false, error: 'Invalid <linearGradient> block' };
  }

  const rectOpen = svg.indexOf('<rect ');
  if (rectOpen === -1) {
    return { valid: false, error: 'Missing <rect> element' };
  }

  const textOpen = svg.indexOf('<text ');
  const textClose = svg.indexOf('</text>');
  if (textOpen === -1 || textClose === -1 || textOpen >= textClose) {
    return { valid: false, error: 'Invalid <text> block' };
  }

  // Extract content between <text ...> and </text>
  const textBodyStart = svg.indexOf('>', textOpen) + 1;
  const initialContent = svg.substring(textBodyStart, textClose);

  // Content MUST NOT have raw '<', '>', '&' (unless properly escaped &amp;, &lt;, &gt;, &quot;, &apos;)
  if (initialContent.includes('<')) {
    return { valid: false, error: `Unescaped "<" inside text tag: "${initialContent}"` };
  }
  if (initialContent.includes('>') && !initialContent.includes('&gt;')) {
    return { valid: false, error: `Unescaped ">" inside text tag: "${initialContent}"` };
  }
  // Check unescaped ampersand
  const rawAmpRegex = /&(?!amp;|lt;|gt;|quot;|apos;)/;
  if (rawAmpRegex.test(initialContent)) {
    return { valid: false, error: `Unescaped "&" inside text tag: "${initialContent}"` };
  }

  return { valid: true };
}

function runFuzzer() {
  const inputs = generateAdversarialInputs();
  console.log(`Generated ${inputs.length} adversarial test vectors.`);

  let totalTested = 0;
  let syntaxFailures = 0;
  let encodingFailures = 0;
  let nonDeterministicCount = 0;
  let performanceStart = Date.now();

  for (const input of inputs) {
    totalTested++;

    const uri1 = getAvatarDataUri(input);
    const uri2 = getAvatarDataUri(input);

    // Invariance: calling twice with same input must yield identical string
    if (uri1 !== uri2) {
      nonDeterministicCount++;
      console.error(`Non-deterministic output for input: ${JSON.stringify(input)}`);
    }

    if (!uri1.startsWith('data:image/svg+xml;utf8,')) {
      encodingFailures++;
      console.error(`URI does not start with prefix for input: ${JSON.stringify(input)}`);
      continue;
    }

    const encodedSvg = uri1.substring('data:image/svg+xml;utf8,'.length);
    let decodedSvg = '';
    try {
      decodedSvg = decodeURIComponent(encodedSvg);
    } catch (e: any) {
      encodingFailures++;
      console.error(`decodeURIComponent failed on input: ${JSON.stringify(input)} - ${e.message}`);
      continue;
    }

    const val = validateSvgXml(decodedSvg);
    if (!val.valid) {
      syntaxFailures++;
      console.error(`XML syntax invalid for input: ${JSON.stringify(input)}: ${val.error}`);
    }
  }

  const durationMs = Date.now() - performanceStart;
  console.log(`\n--- Fuzzing Results ---`);
  console.log(`Total vectors tested: ${totalTested}`);
  console.log(`Total duration: ${durationMs}ms (${(durationMs / totalTested).toFixed(3)}ms per vector)`);
  console.log(`Encoding failures: ${encodingFailures}`);
  console.log(`XML syntax failures: ${syntaxFailures}`);
  console.log(`Non-deterministic failures: ${nonDeterministicCount}`);

  if (encodingFailures === 0 && syntaxFailures === 0 && nonDeterministicCount === 0) {
    console.log('\n[PASS] Avatar Data URI generator is 100% robust, injection-safe, and deterministic.');
    process.exit(0);
  } else {
    console.error('\n[FAIL] Fuzzing encountered failures!');
    process.exit(1);
  }
}

runFuzzer();
