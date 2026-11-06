import { PurchaseRecord } from '../types/subscription.types.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateInvoicePdf(
  purchase: PurchaseRecord,
  user: { email: string; id: number; username: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const primary = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.4, 0.45, 0.55);
  const border = rgb(0.88, 0.9, 0.94);
  const bgLight = rgb(0.96, 0.97, 0.98);
  const green = rgb(0.09, 0.63, 0.36);

  page.drawRectangle({
    color: primary,
    height: 4,
    width: 515.28,
    x: 40,
    y: 800,
  });

  page.drawText('BoardPDF', {
    color: primary,
    font: bold,
    size: 22,
    x: 40,
    y: 755,
  });

  page.drawText('Plataforma y Herramientas Documentales', {
    color: muted,
    font: regular,
    size: 9,
    x: 40,
    y: 740,
  });

  page.drawText('COMPROBANTE DE PAGO', {
    color: primary,
    font: bold,
    size: 13,
    x: 360,
    y: 755,
  });

  const invoiceNumber = `INV-${String(purchase.id || 1).padStart(6, '0')}`;
  page.drawText(`Factura Nº: ${invoiceNumber}`, {
    color: primary,
    font: bold,
    size: 10,
    x: 360,
    y: 738,
  });

  let dateFormatted = '—';
  if (purchase.created_at) {
    try {
      const d = new Date(purchase.created_at);
      dateFormatted = d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (_) {}
  }

  page.drawText(`Fecha: ${dateFormatted}`, {
    color: muted,
    font: regular,
    size: 9,
    x: 360,
    y: 723,
  });

  page.drawLine({
    color: border,
    end: { x: 555.28, y: 705 },
    start: { x: 40, y: 705 },
    thickness: 1,
  });

  page.drawText('DATOS DEL CLIENTE', {
    color: primary,
    font: bold,
    size: 10,
    x: 40,
    y: 680,
  });
  page.drawText(`Nombre: ${user.username}`, {
    color: primary,
    font: regular,
    size: 9,
    x: 40,
    y: 663,
  });
  page.drawText(`Correo: ${user.email}`, {
    color: primary,
    font: regular,
    size: 9,
    x: 40,
    y: 649,
  });
  page.drawText(`ID Usuario: #${user.id}`, {
    color: muted,
    font: regular,
    size: 9,
    x: 40,
    y: 635,
  });

  page.drawText('EMISOR DEL SERVICIO', {
    color: primary,
    font: bold,
    size: 10,
    x: 320,
    y: 680,
  });
  page.drawText('BoardPDF Cloud Technologies', {
    color: primary,
    font: regular,
    size: 9,
    x: 320,
    y: 663,
  });
  page.drawText('contacto@boardpdf.app', {
    color: primary,
    font: regular,
    size: 9,
    x: 320,
    y: 649,
  });
  page.drawText('https://boardpdf.app', {
    color: muted,
    font: regular,
    size: 9,
    x: 320,
    y: 635,
  });

  page.drawRectangle({
    borderColor: border,
    borderWidth: 1,
    color: bgLight,
    height: 48,
    width: 515.28,
    x: 40,
    y: 565,
  });

  const refId = String(
    purchase.stripe_payment_intent_id ||
    purchase.stripe_session_id ||
    purchase.stripe_subscription_id ||
    `TRANS-${purchase.id}`
  );
  const shortRef = refId.length > 36 ? `${refId.slice(0, 33)}...` : refId;

  page.drawText('Referencia de pago:', {
    color: muted,
    font: bold,
    size: 8,
    x: 52,
    y: 593,
  });
  page.drawText(shortRef, {
    color: primary,
    font: regular,
    size: 8,
    x: 145,
    y: 593,
  });

  page.drawText('Pasarela de cobro:', {
    color: muted,
    font: bold,
    size: 8,
    x: 52,
    y: 577,
  });
  page.drawText('Stripe Payments (SSL 256-bit)', {
    color: primary,
    font: regular,
    size: 8,
    x: 145,
    y: 577,
  });

  page.drawText('Estado de compra:', {
    color: muted,
    font: bold,
    size: 8,
    x: 340,
    y: 585,
  });
  page.drawText('PAGADO / COMPLETADO', {
    color: green,
    font: bold,
    size: 8,
    x: 430,
    y: 585,
  });

  page.drawRectangle({
    color: primary,
    height: 24,
    width: 515.28,
    x: 40,
    y: 520,
  });

  page.drawText('Descripción del Plan', {
    color: rgb(1, 1, 1),
    font: bold,
    size: 8,
    x: 52,
    y: 529,
  });
  page.drawText('Modalidad', {
    color: rgb(1, 1, 1),
    font: bold,
    size: 8,
    x: 230,
    y: 529,
  });
  page.drawText('Estado', {
    color: rgb(1, 1, 1),
    font: bold,
    size: 8,
    x: 370,
    y: 529,
  });
  page.drawText('Importe', {
    color: rgb(1, 1, 1),
    font: bold,
    size: 8,
    x: 480,
    y: 529,
  });

  const planFormatted = `BoardPDF ${(purchase.plan_id || 'Pro').toUpperCase()}`;
  const bp = String(purchase.billing_period || '');
  let periodText = 'Suscripción Mensual';
  if (bp === 'one_time_monthly') {
    periodText = 'Pago único (1 mes)';
  } else if (bp === 'one_time_yearly') {
    periodText = 'Pago único (1 año)';
  } else if (bp === 'yearly') {
    periodText = 'Suscripción Anual';
  } else if (bp === 'one_time') {
    periodText = 'Pago único';
  }

  const amountStr = `${(purchase.currency || 'USD').toUpperCase()} $${Number(purchase.amount_total || 0).toFixed(2)}`;

  page.drawText(planFormatted, {
    color: primary,
    font: bold,
    size: 9,
    x: 52,
    y: 495,
  });
  page.drawText(periodText, {
    color: primary,
    font: regular,
    size: 9,
    x: 230,
    y: 495,
  });
  page.drawText('Completado', {
    color: green,
    font: bold,
    size: 9,
    x: 370,
    y: 495,
  });
  page.drawText(amountStr, {
    color: primary,
    font: bold,
    size: 9,
    x: 480,
    y: 495,
  });

  page.drawLine({
    color: border,
    end: { x: 555.28, y: 480 },
    start: { x: 40, y: 480 },
    thickness: 1,
  });

  page.drawText('Subtotal:', {
    color: muted,
    font: regular,
    size: 9,
    x: 380,
    y: 450,
  });
  page.drawText(amountStr, {
    color: primary,
    font: regular,
    size: 9,
    x: 480,
    y: 450,
  });

  page.drawText('Impuestos (0%):', {
    color: muted,
    font: regular,
    size: 9,
    x: 380,
    y: 432,
  });
  page.drawText(`${(purchase.currency || 'USD').toUpperCase()} $0.00`, {
    color: primary,
    font: regular,
    size: 9,
    x: 480,
    y: 432,
  });

  page.drawLine({
    color: border,
    end: { x: 555.28, y: 418 },
    start: { x: 370, y: 418 },
    thickness: 1,
  });

  page.drawText('Total Pagado:', {
    color: primary,
    font: bold,
    size: 11,
    x: 380,
    y: 400,
  });
  page.drawText(amountStr, {
    color: primary,
    font: bold,
    size: 11,
    x: 480,
    y: 400,
  });

  page.drawRectangle({
    borderColor: border,
    borderWidth: 1,
    color: bgLight,
    height: 70,
    width: 515.28,
    x: 40,
    y: 280,
  });

  page.drawText('COMPROBANTE ELECTRÓNICO OFICIAL', {
    color: primary,
    font: bold,
    size: 8,
    x: 52,
    y: 332,
  });
  page.drawText('Este documento certifica la recepción conforme del pago correspondiente a los servicios digitales de BoardPDF.', {
    color: muted,
    font: regular,
    size: 8,
    x: 52,
    y: 318,
  });
  page.drawText('Para dudas o asistencia respecto a tu cuenta o facturación, contacta a nuestro equipo en soporte@boardpdf.app.', {
    color: muted,
    font: regular,
    size: 8,
    x: 52,
    y: 304,
  });
  page.drawText(`Identificador fiscal de comprobante: ${invoiceNumber} • Transacción auditada.`, {
    color: muted,
    font: regular,
    size: 8,
    x: 52,
    y: 290,
  });

  page.drawLine({
    color: border,
    end: { x: 555.28, y: 80 },
    start: { x: 40, y: 80 },
    thickness: 1,
  });

  page.drawText('BoardPDF Technologies Inc. • www.boardpdf.app • Centro de Ayuda: soporte@boardpdf.app', {
    color: muted,
    font: regular,
    size: 8,
    x: 120,
    y: 65,
  });

  return doc.save();
}
