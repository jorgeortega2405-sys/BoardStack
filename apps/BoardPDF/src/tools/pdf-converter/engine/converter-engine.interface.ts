import { ConversionType, PdfConversionOptions } from '../pdf-converter.types.js';

interface EngineConversionParams {
  inputPath: string;
  options?: PdfConversionOptions;
  originalFilename: string;
  outputDir: string;
  targetType: ConversionType;
}

interface EngineConversionResult {
  filename: string;
  isZip: boolean;
  mimeType: string;
  outputPath: string;
}

interface IConverterEngine {
  convert(params: EngineConversionParams): Promise<EngineConversionResult>;
}

export type { EngineConversionParams, EngineConversionResult, IConverterEngine };
