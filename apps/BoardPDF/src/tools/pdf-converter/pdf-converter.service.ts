import { storeTempFile } from '../../services/temp-storage.service.js';
import { IConverterEngine } from './engine/converter-engine.interface.js';
import { LocalConverterEngine } from './engine/local-converter.engine.js';
import { ConversionType, ConvertJobResult, PdfConversionOptions } from './pdf-converter.types.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONVERTER_DIR = path.join(os.tmpdir(), 'boardpdf-converter');
const UPLOADS_DIR = path.join(CONVERTER_DIR, 'uploads');
const OUTPUT_DIR = path.join(CONVERTER_DIR, 'output');

const activeEngine: IConverterEngine = new LocalConverterEngine();

async function convertPdfFile(
  file: Express.Multer.File,
  targetType: ConversionType,
  options?: PdfConversionOptions
): Promise<ConvertJobResult> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  let inputPath = file.path;
  if (!inputPath && file.buffer) {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    inputPath = path.join(UPLOADS_DIR, `temp_convert_${Date.now()}_${path.basename(file.originalname)}`);
    await fs.promises.writeFile(inputPath, file.buffer);
  }
  const originalFilename = file.originalname;
  let generatedOutputPath = '';

  try {
    const result = await activeEngine.convert({
      inputPath,
      options,
      originalFilename,
      outputDir: OUTPUT_DIR,
      targetType,
    });
    generatedOutputPath = result.outputPath;

    const buffer = await fs.promises.readFile(result.outputPath);
    const fileSize = buffer.length;
    const token = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const tokenResult = await storeTempFile(token, {
      buffer,
      contentType: result.mimeType,
      createdAt: Date.now(),
      filename: result.filename,
      isZip: result.isZip,
      mimeType: result.mimeType,
      token,
    });

    return {
      downloadToken: tokenResult.fullToken,
      downloadUrl: tokenResult.downloadUrl,
      fileSize,
      filename: result.filename,
      isZip: result.isZip,
      mimeType: result.mimeType,
      success: true,
    };
  } finally {
    if (generatedOutputPath) {
      await fs.promises.unlink(generatedOutputPath).catch(() => {});
    }
    if (inputPath && fs.existsSync(inputPath)) {
      await fs.promises.unlink(inputPath).catch(() => {});
    }
  }
}

export { UPLOADS_DIR, convertPdfFile };
