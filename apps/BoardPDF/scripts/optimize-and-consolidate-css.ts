import fs from 'node:fs';
import path from 'node:path';
import postcss, { AtRule, ChildNode, Container, Root, Rule } from 'postcss';

interface AliveData {
  classes: string[];
  dynamic_regexes: string[];
}

const rootDir = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'))
  ? process.cwd()
  : path.resolve(process.cwd(), 'apps/BoardPDF');

const aliveJsonPath = path.resolve(rootDir, '../../scripts/alive_classes.json');
const aliveData: AliveData = JSON.parse(fs.readFileSync(aliveJsonPath, 'utf8'));

const aliveSet = new Set(aliveData.classes);
const dynamicPatterns = aliveData.dynamic_regexes.map((rx) => new RegExp(rx));

function isClassAlive(cls: string): boolean {
  if (aliveSet.has(cls)) return true;
  return dynamicPatterns.some((rx) => rx.test(cls));
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
      if (current.trim().length > 0) selectors.push(current.trim());
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

function isBranchAlive(sel: string): boolean {
  const classMatches = [...sel.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]);
  if (classMatches.length === 0) return true;
  return classMatches.some((cls) => isClassAlive(cls));
}

function pruneRoot(root: Root): { branchesPruned: number; rulesRemoved: number } {
  let rulesRemoved = 0;
  let branchesPruned = 0;

  root.walkRules((rule: Rule) => {
    if (rule.parent && (rule.parent as AtRule).name === 'keyframes') return;

    const branches = splitSelectors(rule.selector);
    const aliveBranches = branches.filter(isBranchAlive);

    if (aliveBranches.length === 0) {
      rule.remove();
      rulesRemoved++;
    } else if (aliveBranches.length < branches.length) {
      branchesPruned += branches.length - aliveBranches.length;
      rule.selectors = aliveBranches;
    }
  });

  root.walkAtRules((atRule: AtRule) => {
    if (atRule.name === 'media' || atRule.name === 'supports') {
      const hasContent = atRule.nodes && atRule.nodes.some((n: ChildNode) => n.type === 'rule' || n.type === 'atrule');
      if (!hasContent) {
        atRule.remove();
      }
    }
  });

  return { branchesPruned, rulesRemoved };
}

function deduplicateRules(root: Root): number {
  const seenRules = new Map<string, Rule>();
  let duplicatesRemoved = 0;

  root.walkRules((rule: Rule) => {
    if (rule.parent && (rule.parent as AtRule).name === 'keyframes') return;

    const selectorKey = rule.selector.trim().replace(/\s+/g, ' ');
    const bodyKey = (rule.nodes || []).map((n) => n.toString().trim()).join(';');
    const fullKey = `${selectorKey}::{${bodyKey}}`;

    const parentMedia = rule.parent && (rule.parent as AtRule).name === 'media' ? (rule.parent as AtRule).params : '';
    const uniqueKey = `${parentMedia}::${fullKey}`;

    if (seenRules.has(uniqueKey)) {
      rule.remove();
      duplicatesRemoved++;
    } else {
      seenRules.set(uniqueKey, rule);
    }
  });

  return duplicatesRemoved;
}

function optimizeSingleFile(relPath: string): void {
  const fullPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, 'utf8');
  const root = postcss.parse(content);

  const { branchesPruned, rulesRemoved } = pruneRoot(root);
  const duplicatesRemoved = deduplicateRules(root);

  const optimized = root.toString();
  fs.writeFileSync(fullPath, optimized, 'utf8');

  process.stdout.write(
    `[Optimized] ${relPath}: ${content.length} B -> ${optimized.length} B (removed ${rulesRemoved} dead rules, pruned ${branchesPruned} branches, removed ${duplicatesRemoved} duplicates)\n`
  );
}

function mergeAndOptimizeFiles(inputRelPaths: string[], outputRelPath: string): void {
  const combinedRoot = postcss.root();
  let initialBytes = 0;

  for (const rel of inputRelPaths) {
    const full = path.resolve(rootDir, rel);
    if (!fs.existsSync(full)) continue;

    const content = fs.readFileSync(full, 'utf8');
    initialBytes += content.length;

    const parsed = postcss.parse(content);
    combinedRoot.append(parsed.nodes || []);
  }

  const { branchesPruned, rulesRemoved } = pruneRoot(combinedRoot);
  const duplicatesRemoved = deduplicateRules(combinedRoot);

  const finalOutput = combinedRoot.toString();
  const outputPath = path.resolve(rootDir, outputRelPath);
  fs.writeFileSync(outputPath, finalOutput, 'utf8');

  process.stdout.write(
    `[Merged & Optimized] -> ${outputRelPath}: original combined ${initialBytes} B -> ${finalOutput.length} B (removed ${rulesRemoved} dead rules, pruned ${branchesPruned} branches, removed ${duplicatesRemoved} duplicates)\n`
  );
}

export function runFullCssOptimization(): void {
  process.stdout.write('=== STARTING CSS OPTIMIZATION AND CONSOLIDATION ===\n\n');

  optimizeSingleFile('public/css/components/component-buttons.css');
  optimizeSingleFile('public/css/components/component-forms.css');
  optimizeSingleFile('public/css/components/component-feedback.css');
  optimizeSingleFile('public/css/components/component-layout.css');
  optimizeSingleFile('public/css/components/component-overlays.css');

  mergeAndOptimizeFiles(
    [
      'public/css/components/component-views.css',
      'public/css/components/component-settings.css',
      'public/css/components/component-auth.css',
      'public/css/components/component-pricing.css',
      'public/css/components/component-checkout.css',
      'public/css/components/component-projects.css',
      'public/css/components/component-avatars.css',
    ],
    'public/css/components/component-views.css'
  );

  mergeAndOptimizeFiles(
    [
      'public/css/tools/tool-base.css',
      'public/css/tools/tool-grid.css',
      'public/css/tools/tool-viewer.css',
      'public/css/tools/collaborative-pdf.css',
    ],
    'public/css/tools/tool-workspace.css'
  );

  process.stdout.write('\n=== CONSOLIDATION & AST OPTIMIZATION FINISHED ===\n');
}

runFullCssOptimization();
