import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { cleanTextForWinAnsi, parseHexColor, sanitizePdfFilename } from '../../utils/pdf.util.js';
import { StoredWatermarkPdfResult, WatermarkOptions, WatermarkPdfResponse, WatermarkPosition } from './watermark-pdf.types.js';
import crypto from 'crypto';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function calculateCoords(
  pos: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  itemWidth: number,
  itemHeight: number,
  margin = 36
): { x: number; y: number } {
  let x = margin;
  let y = margin;

  if (pos.includes('left')) {
    x = margin;
  } else if (pos.includes('right')) {
    x = Math.max(margin, pageWidth - margin - itemWidth);
  } else {
    x = Math.max(margin, (pageWidth - itemWidth) / 2);
  }

  if (pos.startsWith('top')) {
    y = Math.max(margin, pageHeight - margin - itemHeight);
  } else if (pos.startsWith('bottom')) {
    y = margin;
  } else {
    y = Math.max(margin, (pageHeight - itemHeight) / 2);
  }

  return { x, y };
}

export async function addWatermarkToPdf(
  fileBuffer: Buffer,
  originalFilename: string,
  options: WatermarkOptions,
  imageBuffer?: Buffer
): Promise<WatermarkPdfResponse> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  } catch (err) {
    logger.app.error(`Error al cargar PDF para marca de agua: ${originalFilename}`, err);
    throw new Error('El archivo seleccionado no es un documento PDF válido o está protegido contra lectura.');
  }

  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    throw new Error('El documento no contiene páginas válidas.');
  }

  const isImageWatermark = options.type === 'image' && Boolean(imageBuffer);
  const transparencyPercent = Math.max(0, Math.min(95, Number(options.transparency) || 0));
  const opacity = Math.max(0.05, 1 - transparencyPercent / 100);
  const rotDegrees = Number(options.rotation) || 0;
  const rotAngle = degrees(rotDegrees);
  const fromPage = Math.max(1, Math.min(totalPages, Number(options.fromPage) || 1));
  const toPage = Math.max(fromPage, Math.min(totalPages, Number(options.toPage) || totalPages));
  const isMosaic = Boolean(options.mosaic);
  const basePos = options.position || 'center';

  let embeddedImage: any = null;
  let imgDims = { height: 100, width: 100 };

  if (isImageWatermark && imageBuffer) {
    const isPng = imageBuffer.length >= 8 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
    try {
      if (isPng) {
        embeddedImage = await doc.embedPng(new Uint8Array(imageBuffer));
      } else {
        embeddedImage = await doc.embedJpg(new Uint8Array(imageBuffer));
      }
    } catch {
      try {
        embeddedImage = isPng
          ? await doc.embedJpg(new Uint8Array(imageBuffer))
          : await doc.embedPng(new Uint8Array(imageBuffer));
      } catch {
        throw new Error('Formato de imagen no compatible para la marca de agua. Utiliza PNG o JPG.');
      }
    }
    const scaled = embeddedImage.scale(1);
    const maxDimension = 180;
    const scaleFactor = Math.min(maxDimension / scaled.width, maxDimension / scaled.height, 1);
    imgDims = {
      height: scaled.height * scaleFactor,
      width: scaled.width * scaleFactor,
    };
  }

  let font: any = null;
  let text = '';
  let fontSize = 36;
  let textColor = rgb(0.6, 0.6, 0.6);

  if (!isImageWatermark) {
    let fontName = StandardFonts.Helvetica;
    if (options.fontFamily === 'Helvetica-Bold' || options.isBold) fontName = StandardFonts.HelveticaBold;
    else if (options.fontFamily === 'Times-Roman') fontName = StandardFonts.TimesRoman;
    else if (options.fontFamily === 'Courier') fontName = StandardFonts.Courier;

    font = await doc.embedFont(fontName);
    fontSize = Math.max(12, Math.min(120, Number(options.fontSize) || 36));
    const c = parseHexColor(options.color);
    textColor = rgb(c.r, c.g, c.b);
    text = cleanTextForWinAnsi(options.text?.trim() || 'CONFIDENCIAL');
  }

  for (let i = fromPage - 1; i <= toPage - 1; i++) {
    const page = doc.getPage(i);
    const { height, width } = page.getSize();

    if (isImageWatermark && embeddedImage) {
      if (isMosaic) {
        const stepX = width / 3;
        const stepY = height / 3;
        for (let col = 0; col < 3; col++) {
          for (let row = 0; row < 3; row++) {
            const x = col * stepX + (stepX - imgDims.width) / 2;
            const y = row * stepY + (stepY - imgDims.height) / 2;
            page.drawImage(embeddedImage, {
              height: imgDims.height,
              opacity,
              rotate: rotAngle,
              width: imgDims.width,
              x,
              y,
            });
          }
        }
      } else {
        const coords = calculateCoords(basePos, width, height, imgDims.width, imgDims.height);
        page.drawImage(embeddedImage, {
          height: imgDims.height,
          opacity,
          rotate: rotAngle,
          width: imgDims.width,
          x: coords.x,
          y: coords.y,
        });
      }
    } else if (font && text) {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      if (isMosaic) {
        const stepX = width / 3;
        const stepY = height / 3;
        for (let col = 0; col < 3; col++) {
          for (let row = 0; row < 3; row++) {
            const x = col * stepX + (stepX - textWidth) / 2;
            const y = row * stepY + (stepY - textHeight) / 2;
            page.drawText(text, {
              color: textColor,
              font,
              opacity,
              rotate: rotAngle,
              size: fontSize,
              x,
              y,
            });
          }
        }
      } else {
        const coords = calculateCoords(basePos, width, height, textWidth, textHeight);
        page.drawText(text, {
          color: textColor,
          font,
          opacity,
          rotate: rotAngle,
          size: fontSize,
          x: coords.x,
          y: coords.y,
        });
      }
    }
  }

  const savedBytes = await doc.save();
  const finalBuffer = Buffer.from(savedBytes);
  const fileId = crypto.randomUUID();
  const filename = sanitizePdfFilename(options.filename, `${originalFilename.replace(/\.pdf$/i, '')}_marca_de_agua.pdf`);

  const storedItem: StoredWatermarkPdfResult = {
    buffer: finalBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename,
    id: fileId,
    pagesCount: totalPages,
    size: finalBuffer.length,
  };

  const tokenResult = await storeTempFile(fileId, storedItem);

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename,
    fileSize: finalBuffer.length,
    totalPages,
  };
}
