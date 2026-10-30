import { getToolLimits } from '../../config/tools-limits.config.js';
import { logger } from '../../services/logger.service.js';
import { isPdfBuffer } from '../../utils/pdf.util.js';
import { repairPdfFile } from './repair-pdf.service.js';
import { Request, Response } from 'express';

export async function handleRepairPdf(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'Debes seleccionar un archivo PDF para poder repararlo.',
      success: false,
    });
    return;
  }

  const userPerms = ((req as any).user?.permissions as string[]) || [];
  const limits = getToolLimits('repair-pdf', userPerms);

  if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
    res.status(400).json({
      error: `El archivo supera el límite permitido de ${limits.maxFileSizeMB} MB para tu plan actual. Actualiza tu suscripción para procesar documentos de mayor tamaño.`,
      success: false,
    });
    return;
  }

  const isNamedPdf = file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdfBuffer(file.buffer) && !isNamedPdf) {
    res.status(400).json({
      error: `El archivo "${file.originalname}" no contiene una estructura identificable de PDF.`,
      success: false,
    });
    return;
  }

  const customFilename = typeof req.body?.filename === 'string' && req.body.filename.trim() ? req.body.filename.trim() : `${file.originalname.replace(/\.pdf$/i, '')}_reparado.pdf`;

  try {
    const result = await repairPdfFile({
      buffer: file.buffer,
      filename: customFilename,
      originalname: file.originalname,
    });

    res.status(200).json({
      data: result,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al reparar documento PDF', error);
    res.status(500).json({
      error: 'No se pudo reparar el archivo PDF seleccionado. El daño en el archivo puede ser irreversible.',
      success: false,
    });
  }
}

