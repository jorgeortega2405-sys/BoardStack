import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const rootDir = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'))
  ? process.cwd()
  : path.resolve(process.cwd(), 'apps/BoardPDF');

const cssFiles = [
  'public/css/root.css',
  'public/css/components/component-buttons.css',
  'public/css/components/component-feedback.css',
  'public/css/components/component-forms.css',
  'public/css/components/component-layout.css',
  'public/css/components/component-overlays.css',
  'public/css/components/component-views.css',
  'public/css/tools/tool-base.css',
  'public/css/tools/tool-grid.css',
  'public/css/tools/tool-viewer.css',
];

const dynamicWhitelist = [
  /^is-pos-(top|center|bottom)-(left|center|right)$/,
  /^modal-card--(sm|md|lg)$/,
  /^toast-item--(success|danger|warning|info)$/,
  /^contact-ticket-status-badge--/,
  /^contact-ticket-msg--(customer|agent)$/,
  /^sortable-(ghost|chosen|drag)$/,
  /^(textLayer|annotationLayer|canvasWrapper|page)$/,
  /^is-(active|open|disabled|hidden|loading|processing|selected|visible|dragging|dragover|marked-remove|mobile-open|ready|success|error)$/,
];

function getFiles(dir: string, ext: string): string[] {
  let res: string[] = [];
  if (!fs.existsSync(dir)) return res;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(item.name)) {
        res = res.concat(getFiles(full, ext));
      }
    } else if (item.name.endsWith(ext)) {
      res.push(full);
    }
  }
  return res;
}

function splitSelectors(selectorStr: string): string[] {
  const selectors: string[] = [];
  let current = '';
  let inParen = 0;
  let inBracket = 0;

  for (let i = 0; i < selectorStr.length; i++) {
    const char = selectorStr[i];
    if (char === '(') inParen++;
    else if (char === ')') inParen--;
    else if (char === '[') inBracket++;
    else if (char === ']') inBracket--;

    if (char === ',' && inParen === 0 && inBracket === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    selectors.push(current.trim());
  }
  return selectors;
}

function runPurge(): void {
  const htmlFiles = getFiles(path.join(rootDir, 'public/views'), '.html').concat([path.join(rootDir, 'index.html')]);
  const tsFiles = getFiles(path.join(rootDir, 'client'), '.ts');

  const htmlContent = htmlFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const tsContent = tsFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const allContent = htmlContent + '\n' + tsContent;

  const isClassUsed = (cls: string): boolean => {
    if (dynamicWhitelist.some((rx) => rx.test(cls))) return true;
    return allContent.includes(cls);
  };

  const isBranchUsed = (sel: string): boolean => {
    const tokens = [...sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    if (tokens.length === 0) return true;
    return tokens.every((tok) => isClassUsed(tok));
  };

  let totalOriginalBytes = 0;
  let totalPurgedBytes = 0;
  let totalOriginalRules = 0;
  let totalRulesPurged = 0;
  let totalBranchesPruned = 0;
  let totalEmptyMediaPurged = 0;

  for (const rel of cssFiles) {
    const fullPath = path.join(rootDir, rel);
    const content = fs.readFileSync(fullPath, 'utf8');
    totalOriginalBytes += content.length;

    const root = postcss.parse(content);

    let fileRulesPurged = 0;
    let fileBranchesPruned = 0;
    let fileEmptyMedia = 0;

    root.walkRules((rule) => {
      if (rule.parent && (rule.parent as any).name === 'keyframes') return;
      totalOriginalRules++;

      const branches = splitSelectors(rule.selector);
      const aliveBranches = branches.filter(isBranchUsed);

      if (aliveBranches.length === 0) {
        rule.remove();
        fileRulesPurged++;
        totalRulesPurged++;
      } else if (aliveBranches.length < branches.length) {
        fileBranchesPruned += branches.length - aliveBranches.length;
        totalBranchesPruned += branches.length - aliveBranches.length;
        rule.selectors = aliveBranches;
      }
    });

    root.walkAtRules('media', (media) => {
      const hasRules = media.nodes && media.nodes.some((n) => n.type === 'rule' || n.type === 'atrule');
      if (!hasRules) {
        media.remove();
        fileEmptyMedia++;
        totalEmptyMediaPurged++;
      }
    });

    const purgedContent = root.toString();
    totalPurgedBytes += purgedContent.length;
    fs.writeFileSync(fullPath, purgedContent, 'utf8');

    process.stdout.write(
      `${rel}: original ${content.length} B -> purged ${purgedContent.length} B (purged ${fileRulesPurged} rules, pruned ${fileBranchesPruned} branches, removed ${fileEmptyMedia} media)\n`
    );
  }

  process.stdout.write('\nCSS AST PURGE COMPLETE:\n');
  process.stdout.write(`Original size: ${totalOriginalBytes} B (~${(totalOriginalBytes / 1024).toFixed(1)} KB)\n`);
  process.stdout.write(`Purged size:   ${totalPurgedBytes} B (~${(totalPurgedBytes / 1024).toFixed(1)} KB)\n`);
  process.stdout.write(`Payload saved: ${totalOriginalBytes - totalPurgedBytes} B (~${((totalOriginalBytes - totalPurgedBytes) / 1024).toFixed(1)} KB)\n`);
  process.stdout.write(`Rules purged:  ${totalRulesPurged} / ${totalOriginalRules}\n`);
  process.stdout.write(`Branches pruned: ${totalBranchesPruned}\n`);
  process.stdout.write(`Empty media pruned: ${totalEmptyMediaPurged}\n`);
}

runPurge();
