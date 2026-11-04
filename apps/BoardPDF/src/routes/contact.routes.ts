import { submitSalesInquiry } from '../controllers/contact.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/contact/sales', submitSalesInquiry);

export default router;
