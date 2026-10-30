import { ZipArchive } from 'archiver';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../services/logger.service.js';
import { findPythonWorkerScript, getPythonCommand } from '../../../utils/process.util.js';
import { PdfConversionOptions } from '../pdf-converter.types.js';
import { EngineConversionParams, EngineConversionResult, IConverterEngine } from './converter-engine.interface.js';

export class LocalConverterEngine implements IConverterEngine {
  public async convert(params: EngineConversionParams): Promise<EngineConversionResult> {
    const { inputPath, options, originalFilename, outputDir, targetType } = params;
    const baseName = path.basename(originalFilename, path.extname(originalFilename));

    switch (targetType) {
      case 'pdf-to-jpg':
        return this.convertPdfToJpg(inputPath, outputDir, baseName, options);
      case 'pdf-to-word':
        return this.runPythonWorker('docx', inputPath, outputDir, `${baseName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', options);
      case 'pdf-to-powerpoint':
        return this.runPythonWorker('pptx', inputPath, outputDir, `${baseName}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', options);
      case 'pdf-to-excel':
        return this.runPythonWorker('xlsx', inputPath, outputDir, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', options);
      case 'pdf-to-pdfa':
        return this.convertPdfToPdfA(inputPath, outputDir, `${baseName}_pdfa.pdf`, options);
      default:
        throw new Error(`Tipo de conversión no soportado: ${targetType}`);
    }
  }

  private async convertPdfToJpg(
    inputPath: string,
    outputDir: string,
    baseName: string,
    options?: PdfConversionOptions
  ): Promise<EngineConversionResult> {
    const tempPrefix = path.join(outputDir, `page_${Date.now()}`);
    let converted = false;
    try {
      const pyCmd = await getPythonCommand();
      const scriptPath = findPythonWorkerScript('converter_worker.py', 'pdf-converter');
      const optionsStr = JSON.stringify(options || {});
      await this.execProcess(pyCmd, [scriptPath, 'jpg', inputPath, tempPrefix, optionsStr]);
      converted = true;
    } catch (pyErr) {
      logger.app.error('Error al convertir PDF a JPG con Python PyMuPDF', pyErr);
      try {
        const dpi = options?.jpgQuality === 'high' ? '300' : '150';
        await this.execProcess('pdftoppm', ['-jpeg', '-r', dpi, inputPath, tempPrefix]);
        converted = true;
      } catch {}
    }

    const generatedFiles = fs.readdirSync(outputDir)
      .filter((f) => f.startsWith(path.basename(tempPrefix)) && f.endsWith('.jpg'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => path.join(outputDir, f));

    if (generatedFiles.length === 0) {
      throw new Error('No se generaron imágenes desde el archivo PDF.');
    }

    if (generatedFiles.length === 1) {
      const finalJpgPath = path.join(outputDir, `${baseName}.jpg`);
      fs.renameSync(generatedFiles[0], finalJpgPath);
      return {
        filename: `${baseName}.jpg`,
        isZip: false,
        mimeType: 'image/jpeg',
        outputPath: finalJpgPath,
      };
    }

    const zipFilename = `${baseName}_imagenes.zip`;
    const zipPath = path.join(outputDir, zipFilename);
    await this.zipFiles(generatedFiles, zipPath);

    generatedFiles.forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch {}
    });

    return {
      filename: zipFilename,
      isZip: true,
      mimeType: 'application/zip',
      outputPath: zipPath,
    };
  }

  private async convertPdfToPdfA(
    inputPath: string,
    outputDir: string,
    filename: string,
    options?: PdfConversionOptions
  ): Promise<EngineConversionResult> {
    const outputPath = path.join(outputDir, filename);
    const rawLevel = String(options?.pdfaLevel || '1b').toLowerCase();
    const pdfaPart = rawLevel.startsWith('3') ? '3' : rawLevel.startsWith('2') ? '2' : '1';
    const allowDowngrade = options?.allowDowngrade !== false;
    const compatibilityPolicy = allowDowngrade ? '1' : '2';

    let gsSuccess = false;
    try {
      await this.execProcess('gs', [
        `-dPDFA=${pdfaPart}`,
        '-sColorConversionStrategy=UseDeviceIndependentColor',
        `-dPDFACompatibilityPolicy=${compatibilityPolicy}`,
        '-sDEVICE=pdfwrite',
        '-o',
        outputPath,
        inputPath,
      ]);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        gsSuccess = true;
      }
    } catch {}

    if (!gsSuccess) {
      await fs.promises.copyFile(inputPath, outputPath);
    }

    return {
      filename,
      isZip: false,
      mimeType: 'application/pdf',
      outputPath,
    };
  }

  private async runPythonWorker(
    format: string,
    inputPath: string,
    outputDir: string,
    filename: string,
    mimeType: string,
    options?: PdfConversionOptions
  ): Promise<EngineConversionResult> {
    const outputPath = path.join(outputDir, filename);
    const workerScript = findPythonWorkerScript('converter_worker.py', 'pdf-converter');
    const pythonCmd = await getPythonCommand();
    const optionsStr = JSON.stringify(options || {});
    await this.execProcess(pythonCmd, [workerScript, format, inputPath, outputPath, optionsStr]);

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Falló la generación del archivo ${format.toUpperCase()}.`);
    }

    return {
      filename,
      isZip: false,
      mimeType,
      outputPath,
    };
  }

  private execProcess(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          logger.app.error(`Error ejecutando comando ${command}`, { args, code, stderr });
          reject(new Error(`El proceso ${command} finalizó con código ${code}: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        logger.app.error(`Error al iniciar proceso ${command}`, err);
        reject(err);
      });
    });
  }

  private zipFiles(files: string[], zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: unknown) => reject(err));

      archive.pipe(output);
      files.forEach((file, idx) => {
        archive.file(file, { name: `pagina_${idx + 1}.jpg` });
      });
      void archive.finalize();
    });
  }
}
