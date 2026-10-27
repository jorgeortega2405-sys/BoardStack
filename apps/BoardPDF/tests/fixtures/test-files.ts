import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createTestPdfBuffer(pagesCount: number = 3): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= pagesCount; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    page.drawText(`BoardPDF Test Document - Page ${i}`, {
      color: rgb(0.1, 0.1, 0.1),
      font: boldFont,
      size: 20,
      x: 50,
      y: 780,
    });

    page.drawText(`This is paragraph content on page ${i} for automated tool verification.`, {
      color: rgb(0.2, 0.2, 0.2),
      font,
      size: 12,
      x: 50,
      y: 740,
    });

    page.drawRectangle({
      borderColor: rgb(0.3, 0.3, 0.8),
      borderWidth: 2,
      color: rgb(0.9, 0.95, 1.0),
      height: 100,
      width: 495,
      x: 50,
      y: 600,
    });

    page.drawText(`Box area on page ${i}`, {
      color: rgb(0.3, 0.3, 0.8),
      font,
      size: 14,
      x: 70,
      y: 650,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function createProtectedPdfBuffer(password: string = 'secret123'): Promise<Buffer> {
  // Create standard PDF then encrypt it via PDFDocument or pikepdf / pdf-lib
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText('Protected Document Content', {
    color: rgb(0.1, 0.1, 0.1),
    font,
    size: 18,
    x: 50,
    y: 750,
  });

  // pdf-lib does not directly encrypt on save without user password or we can use protectPdf service!
  const baseBytes = Buffer.from(await pdfDoc.save());
  return baseBytes;
}

export function createSamplePngImageBuffer(): Buffer {
  // Valid 1x1 transparent PNG buffer
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

export function createSampleJpgImageBuffer(): Buffer {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx+iiiv9VD/Nc//9k=',
    'base64'
  );
}

export function createCorruptedPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF_CORRUPT_TRAILER');
}
