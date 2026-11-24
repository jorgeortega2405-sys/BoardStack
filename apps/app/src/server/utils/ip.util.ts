import type { Request } from 'express';

function getClientIp(req: Request): string {
  if (req.ip && typeof req.ip === 'string') {
    return req.ip.replace(/^::ffff:/, '').trim();
  }
  const socketIp = req.socket?.remoteAddress;
  if (socketIp && typeof socketIp === 'string') {
    return socketIp.replace(/^::ffff:/, '').trim();
  }
  return '127.0.0.1';
}

export {
  getClientIp
};
