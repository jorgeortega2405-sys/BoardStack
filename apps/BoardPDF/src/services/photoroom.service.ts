import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export async function removeBackground(
  imageBuffer: Buffer,
  mimeType = 'image/png',
  filename = 'image.png'
): Promise<Buffer> {
  const apiKey = config.photoroom.apiKey;
  if (!apiKey) {
    logger.app.error('PhotoRoom API key no configurada');
    throw new Error('El servicio de eliminación de fondo no está configurado.');
  }

  const formData = new FormData();
  formData.append('image_file', new Blob([imageBuffer], { type: mimeType }), filename);

  const response = await fetch('https://sdk.photoroom.com/v1/segment', {
    body: formData,
    headers: {
      'x-api-key': apiKey,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    logger.app.error('Fallo en la API de PhotoRoom', {
      error: errorDetails,
      status: response.status,
    });
    throw new Error('No se pudo procesar la eliminación de fondo de la imagen.');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
