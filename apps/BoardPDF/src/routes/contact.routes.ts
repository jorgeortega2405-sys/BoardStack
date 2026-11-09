import { Router } from 'express';
import { getTicketHandler, replyTicketHandler, submitContactHandler } from '../controllers/contact.controller.js';
import { contactLimiter } from '../middlewares/rate-limit.middleware.js';
import { requireTurnstile } from '../middlewares/turnstile.middleware.js';

const router = Router();

router.post(
  '/contact/submit',
  contactLimiter,
  requireTurnstile({ bypassWhenDisabled: true }),
  submitContactHandler
);

router.get('/support/tickets/:token', getTicketHandler);

router.post(
  '/support/tickets/:token/reply',
  contactLimiter,
  replyTicketHandler
);

export default router;
