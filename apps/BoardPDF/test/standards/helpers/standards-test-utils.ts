import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
let checkDir = currentDir;
while (checkDir !== path.dirname(checkDir)) {
  if (fs.existsSync(path.join(checkDir, 'apps/BoardPDF/package.json'))) {
    break;
  }
  checkDir = path.dirname(checkDir);
}
const MONOREPO_ROOT = checkDir;
const BOARDPDF_ROOT = path.resolve(MONOREPO_ROOT, 'apps/BoardPDF');
const PUBLIC_VIEWS_DIR = path.resolve(BOARDPDF_ROOT, 'public/views');
const TRANSLATIONS_DIR = path.resolve(BOARDPDF_ROOT, 'public/translations');
const SRC_DIR = path.resolve(BOARDPDF_ROOT, 'src');
const CLIENT_DIR = path.resolve(BOARDPDF_ROOT, 'client');
const SCRIPTS_DIR = path.resolve(BOARDPDF_ROOT, 'scripts');
const CSS_DIR = path.resolve(BOARDPDF_ROOT, 'public/css');

const IGNORED_DIRS = new Set([
  '.agents',
  '.git',
  '.system_generated',
  '.vite-temp',
  'brain',
  'dist',
  'node_modules',
  'target',
  'temp_storage',
]);

function findFiles(baseDir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(baseDir)) {
    return results;
  }
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function getAllTypeScriptFiles(targetDir: string = BOARDPDF_ROOT, includeTests = false): string[] {
  return findFiles(targetDir, (p) => {
    if (!includeTests && p.includes(path.sep + 'test' + path.sep)) {
      return false;
    }
    return p.endsWith('.ts') && !p.endsWith('.d.ts');
  });
}

function getAllHtmlFiles(targetDir: string = PUBLIC_VIEWS_DIR): string[] {
  return findFiles(targetDir, (p) => p.endsWith('.html'));
}

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseSourceFile(filePath: string): ts.SourceFile {
  const content = readUtf8(filePath);
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function flattenKeys(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') {
    return result;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenKeys(val, newKey));
    } else {
      result[newKey] = String(val);
    }
  }
  return result;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function findProcessEnvFallbacks(content: string): Array<{ line: number; text: string }> {
  const violations: Array<{ line: number; text: string }> = [];
  const lines = content.split('\n');
  const fallbackRegex = /process\.env(\.[A-Za-z0-9_]+|\[['"][A-Za-z0-9_]+['"]\])\s*\|\|/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fallbackRegex.test(line)) {
      violations.push({ line: i + 1, text: line.trim() });
    }
  }
  return violations;
}

function findJsDocComments(content: string): Array<{ line: number; text: string }> {
  const violations: Array<{ line: number; text: string }> = [];
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
  let match: RegExpExecArray | null;
  while ((match = jsdocRegex.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    violations.push({ line, text: match[0].split('\n')[0].trim() });
  }
  return violations;
}

function findDecorativeBanners(content: string): Array<{ line: number; text: string }> {
  const violations: Array<{ line: number; text: string }> = [];
  const lines = content.split('\n');
  const bannerRegex = /(\/\*[\s*=-]{5,}|(\/\/[\s*=-]{5,}))/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (bannerRegex.test(line) && !line.includes('eslint') && !line.includes('prettier')) {
      violations.push({ line: i + 1, text: line.trim() });
    }
  }
  return violations;
}

function findRawConsoleStatements(content: string): Array<{ line: number; text: string }> {
  const violations: Array<{ line: number; text: string }> = [];
  const lines = content.split('\n');
  const consoleRegex = /console\.(log|warn|error|info|debug|trace)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (consoleRegex.test(line)) {
      violations.push({ line: i + 1, text: line.trim() });
    }
  }
  return violations;
}

function checkExportsAtBottom(sourceFile: ts.SourceFile): {
  compliant: boolean;
  violations: Array<{ line: number; text: string }>;
} {
  const violations: Array<{ line: number; text: string }> = [];
  const text = sourceFile.text;
  let sawNonExportStatementAfterExport = false;
  let firstGroupedExportIndex = -1;

  for (const statement of sourceFile.statements) {
    const isExportDeclaration = ts.isExportDeclaration(statement) || ts.isExportAssignment(statement);
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const hasExportModifier = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (hasExportModifier && !isExportDeclaration) {
      const line = getLineNumber(text, statement.getStart(sourceFile));
      violations.push({
        line,
        text: statement.getText(sourceFile).split('\n')[0].slice(0, 80),
      });
    }

    if (isExportDeclaration) {
      if (firstGroupedExportIndex === -1) {
        firstGroupedExportIndex = statement.getStart(sourceFile);
      }
    } else if (firstGroupedExportIndex !== -1) {
      sawNonExportStatementAfterExport = true;
      const line = getLineNumber(text, statement.getStart(sourceFile));
      violations.push({
        line,
        text: `Statement found after export block: ${statement.getText(sourceFile).split('\n')[0].slice(0, 80)}`,
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

interface ParsedHtmlTag {
  line: number;
  tagName: string;
  rawTag: string;
  attributes: Array<{ name: string; value: string }>;
  isSelfClosing: boolean;
}

function parseHtmlTags(htmlContent: string): ParsedHtmlTag[] {
  const results: ParsedHtmlTag[] = [];
  const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const line = getLineNumber(htmlContent, match.index);
    const tagName = match[1].toLowerCase();
    const rawTag = match[0];
    const attrString = match[2];
    const isSelfClosing = rawTag.endsWith('/>') || ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName);

    const attributes: Array<{ name: string; value: string }> = [];
    const attrRegex = /([a-zA-Z0-9-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const name = attrMatch[1];
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      attributes.push({ name, value });
    }

    results.push({
      attributes,
      isSelfClosing,
      line,
      rawTag,
      tagName,
    });
  }

  return results;
}

export {
  BOARDPDF_ROOT,
  CLIENT_DIR,
  CSS_DIR,
  IGNORED_DIRS,
  MONOREPO_ROOT,
  PUBLIC_VIEWS_DIR,
  SCRIPTS_DIR,
  SRC_DIR,
  TRANSLATIONS_DIR,
  checkExportsAtBottom,
  findDecorativeBanners,
  findFiles,
  findJsDocComments,
  findProcessEnvFallbacks,
  findRawConsoleStatements,
  flattenKeys,
  getAllHtmlFiles,
  getAllTypeScriptFiles,
  getLineNumber,
  parseHtmlTags,
  parseSourceFile,
  readJson,
  readUtf8,
};
