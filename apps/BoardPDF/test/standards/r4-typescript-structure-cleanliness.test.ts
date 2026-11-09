import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import ts from 'typescript';
import {
  BOARDPDF_ROOT,
  CLIENT_DIR,
  MONOREPO_ROOT,
  SCRIPTS_DIR,
  SRC_DIR,
  checkExportsAtBottom,
  findDecorativeBanners,
  findFiles,
  findJsDocComments,
  getAllTypeScriptFiles,
  parseSourceFile,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R4: TypeScript Export Standardization & Annotation Stripping Standards', () => {
  const collabServerDir = path.join(BOARDPDF_ROOT, 'collab-server');
  const databaseDir = path.join(BOARDPDF_ROOT, 'database');

  describe('Tier 1: Feature Coverage (R4 Verification)', () => {
    it('verifies exports are placed at the bottom of TypeScript files in src/ and client/', () => {
      const tsFiles = [
        ...getAllTypeScriptFiles(SRC_DIR),
        ...getAllTypeScriptFiles(CLIENT_DIR),
      ];

      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of tsFiles) {
        const sf = parseSourceFile(file);
        const check = checkExportsAtBottom(sf);
        if (!check.compliant) {
          for (const v of check.violations) {
            violations.push({
              file: path.relative(BOARDPDF_ROOT, file),
              line: v.line,
              text: v.text,
            });
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `All exports must be grouped at the bottom of each file. Found ${violations.length} violations:\n${violations
          .slice(0, 30)
          .map((v) => `${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies zero JSDoc (/** ... */) annotations across production TypeScript files', () => {
      const tsFiles = [
        ...getAllTypeScriptFiles(SRC_DIR),
        ...getAllTypeScriptFiles(CLIENT_DIR),
      ];

      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of tsFiles) {
        const content = readUtf8(file);
        const jsdocs = findJsDocComments(content);
        for (const jd of jsdocs) {
          violations.push({
            file: path.relative(BOARDPDF_ROOT, file),
            line: jd.line,
            text: jd.text,
          });
        }
      }

      assert.equal(
        violations.length,
        0,
        `Zero JSDoc comments permitted. Found ${violations.length} violations:\n${violations
          .slice(0, 30)
          .map((v) => `${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies zero decorative comment banners in production TypeScript files', () => {
      const tsFiles = [
        ...getAllTypeScriptFiles(SRC_DIR),
        ...getAllTypeScriptFiles(CLIENT_DIR),
      ];

      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of tsFiles) {
        const content = readUtf8(file);
        const banners = findDecorativeBanners(content);
        for (const b of banners) {
          violations.push({
            file: path.relative(BOARDPDF_ROOT, file),
            line: b.line,
            text: b.text,
          });
        }
      }

      assert.equal(
        violations.length,
        0,
        `Zero decorative banners permitted in TypeScript files. Found ${violations.length}:\n${violations
          .slice(0, 30)
          .map((v) => `${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`
      );
    });

    it('verifies non-web code (Rust, Python, Dockerfiles) is 100% in English with zero Spanish', () => {
      const rustFiles = findFiles(collabServerDir, (p) => p.endsWith('.rs'));
      const pythonFiles = findFiles(SCRIPTS_DIR, (p) => p.endsWith('.py'));
      const dockerFiles = findFiles(BOARDPDF_ROOT, (p) => p.toLowerCase().includes('dockerfile'));

      const spanishKeywords = [
        'archivo',
        'usuario',
        'contraseña',
        'iniciando',
        'conexion',
        'fallo',
        'error al',
        'servidor iniciado',
        'cerrando conexion',
        'descargando',
        'procesando documento',
      ];

      const violations: string[] = [];

      for (const file of [...rustFiles, ...pythonFiles, ...dockerFiles]) {
        const content = readUtf8(file).toLowerCase();
        for (const word of spanishKeywords) {
          if (content.includes(word)) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)} contains Spanish word "${word}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Non-web code must be 100% in English. Found Spanish keywords:\n${violations.join('\n')}`
      );
    });

    it('verifies Python scripts in scripts/ do not contain Spanish comments or docstrings', () => {
      const pythonFiles = findFiles(SCRIPTS_DIR, (p) => p.endsWith('.py'));
      const spanishTokens = ['# error', '# funcion', '# procesar', '# archivo', 'descripción', 'parámetro'];
      const violations: string[] = [];

      for (const file of pythonFiles) {
        const content = readUtf8(file).toLowerCase();
        for (const token of spanishTokens) {
          if (content.includes(token)) {
            violations.push(`${path.basename(file)} contains Spanish comment token "${token}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Python scripts must not contain Spanish comments:\n${violations.join('\n')}`
      );
    });

    it('verifies Rust microservices in collab-server/ do not contain Spanish log messages or identifiers', () => {
      const rustFiles = findFiles(collabServerDir, (p) => p.endsWith('.rs'));
      const spanishLogTokens = ['error al', 'iniciando servidor', 'cerrando sesión', 'desconectado'];
      const violations: string[] = [];

      for (const file of rustFiles) {
        const content = readUtf8(file).toLowerCase();
        for (const token of spanishLogTokens) {
          if (content.includes(token)) {
            violations.push(`${path.basename(file)} contains Spanish log "${token}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Rust microservices must not contain Spanish logs:\n${violations.join('\n')}`
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies AST export checker handles files with type-only exports and default exports', () => {
      const sampleSnippet = `
        const a = 1;
        const b = 2;
        type Foo = string;
        export { a, b };
        export type { Foo };
      `;
      const sf = ts.createSourceFile('test.ts', sampleSnippet, ts.ScriptTarget.Latest, true);
      const res = checkExportsAtBottom(sf);
      assert.equal(res.compliant, true, 'Grouped exports and type exports at bottom must be compliant');
    });

    it('verifies AST export checker flags inline export class, export function, and export const', () => {
      const inlineExportClass = `export class MyService {}\nconst x = 1;`;
      const inlineExportFunc = `export function myFunc() {}\nconst x = 1;`;
      const inlineExportConst = `export const myConst = 1;\nconst x = 1;`;

      const sf1 = ts.createSourceFile('test1.ts', inlineExportClass, ts.ScriptTarget.Latest, true);
      const sf2 = ts.createSourceFile('test2.ts', inlineExportFunc, ts.ScriptTarget.Latest, true);
      const sf3 = ts.createSourceFile('test3.ts', inlineExportConst, ts.ScriptTarget.Latest, true);

      assert.equal(checkExportsAtBottom(sf1).compliant, false, 'export class must be flagged');
      assert.equal(checkExportsAtBottom(sf2).compliant, false, 'export function must be flagged');
      assert.equal(checkExportsAtBottom(sf3).compliant, false, 'export const must be flagged');
    });

    it('verifies comment checker does not falsely flag comment-like strings inside string literals', () => {
      const stringLiteralWithSlash = `const url = "http://example.com/*pattern*/";`;
      const jsdocs = findJsDocComments(stringLiteralWithSlash);
      assert.equal(jsdocs.length, 0, 'String literals with /* must not be treated as JSDoc');
    });

    it('verifies export default statement is positioned cleanly at the end of the file', () => {
      const sample = `
        class MyView {}
        export default MyView;
      `;
      const sf = ts.createSourceFile('test_def.ts', sample, ts.ScriptTarget.Latest, true);
      const check = checkExportsAtBottom(sf);
      assert.equal(check.compliant, true, 'export default at bottom must be compliant');
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies horizontal single-line import formatting across refactored files', () => {
      const tsFiles = getAllTypeScriptFiles(SRC_DIR).slice(0, 40);
      const violations: string[] = [];

      for (const file of tsFiles) {
        const content = readUtf8(file);
        const lines = content.split('\n');
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
          const line = lines[i];
          if (line.trim().startsWith('import {') && !line.includes('} from')) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${i + 1} multiline import`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `All import statements must be declared horizontally on a single line:\n${violations.join('\n')}`
      );
    });

    it('verifies all import declarations reside at the top of the file before executable logic', () => {
      const tsFiles = getAllTypeScriptFiles(SRC_DIR).slice(0, 30);
      const violations: string[] = [];

      for (const file of tsFiles) {
        const sf = parseSourceFile(file);
        let sawNonImportStatement = false;
        for (const statement of sf.statements) {
          if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
            if (sawNonImportStatement) {
              violations.push(`${path.relative(BOARDPDF_ROOT, file)} has import after executable code`);
              break;
            }
          } else {
            sawNonImportStatement = true;
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `All imports must be grouped at the top of the file:\n${violations.join('\n')}`
      );
    });
  });

  describe('Tier 4: Monorepo-Wide Real-World Application Scenarios', () => {
    it('verifies complete compliance of all TypeScript files in BoardPDF', () => {
      const allTsFiles = getAllTypeScriptFiles(BOARDPDF_ROOT);
      assert.ok(allTsFiles.length > 100, `Expected >100 TS files, scanned ${allTsFiles.length}`);

      let totalExportViolations = 0;
      let totalJsDocViolations = 0;

      for (const file of allTsFiles) {
        const sf = parseSourceFile(file);
        const expCheck = checkExportsAtBottom(sf);
        if (!expCheck.compliant) {
          totalExportViolations += expCheck.violations.length;
        }

        const jsdocs = findJsDocComments(sf.text);
        totalJsDocViolations += jsdocs.length;
      }

      assert.equal(
        totalExportViolations,
        0,
        `Monorepo has ${totalExportViolations} export-not-at-bottom violations across ${allTsFiles.length} files`
      );

      assert.equal(
        totalJsDocViolations,
        0,
        `Monorepo has ${totalJsDocViolations} JSDoc violations across ${allTsFiles.length} files`
      );
    });

    it('verifies SQL schema files in database/ contain zero Spanish comments or documentation', () => {
      const sqlFiles = findFiles(databaseDir, (p) => p.endsWith('.sql'));
      const spanishSqlTokens = ['tabla de', 'clave primaria', 'usuario', 'creado el', 'modificado el'];
      const violations: string[] = [];

      for (const file of sqlFiles) {
        const content = readUtf8(file).toLowerCase();
        for (const token of spanishSqlTokens) {
          if (content.includes(token)) {
            violations.push(`${path.basename(file)} contains Spanish comment "${token}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Database schemas must be documented in English:\n${violations.join('\n')}`
      );
    });
  });
});
